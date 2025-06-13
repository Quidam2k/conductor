import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:http/http.dart' as http;

import 'auth_service.dart';
import 'event_service.dart';
import 'storage_service.dart';

enum SyncStatus {
  idle,
  syncing,
  success,
  error,
  offline,
}

class SyncService extends ChangeNotifier {
  final AuthService _authService;
  final EventService _eventService;
  
  SyncStatus _status = SyncStatus.idle;
  String? _lastError;
  DateTime? _lastSyncTime;
  bool _isOnline = true;
  bool _disposed = false;
  List<Map<String, dynamic>> _pendingActions = [];

  SyncService({
    AuthService? authService,
    EventService? eventService,
  }) : _authService = authService ?? AuthService(),
       _eventService = eventService ?? EventService() {
    _initializeConnectivity();
    _loadPendingActions();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  void _safeNotifyListeners() {
    if (!_disposed) {
      notifyListeners();
    }
  }

  void _loadPendingActions() {
    _pendingActions = StorageService.getPendingActions();
  }

  SyncStatus get status => _status;
  String? get lastError => _lastError;
  DateTime? get lastSyncTime => _lastSyncTime;
  bool get isOnline => _isOnline;
  bool get canSync => _isOnline && _authService.isAuthenticated;
  int get pendingActionsCount => _pendingActions.length;

  void _initializeConnectivity() {
    Connectivity().onConnectivityChanged.listen((ConnectivityResult result) {
      final wasOnline = _isOnline;
      _isOnline = result != ConnectivityResult.none;
      
      if (!wasOnline && _isOnline) {
        // We came back online, trigger sync and process pending actions
        syncAll();
        _processPendingActions();
      }
      
      _safeNotifyListeners();
    });
    
    // Check initial connectivity
    _checkConnectivity();
  }

  Future<void> _checkConnectivity() async {
    final result = await Connectivity().checkConnectivity();
    _isOnline = result != ConnectivityResult.none;
    _safeNotifyListeners();
  }

  Future<void> syncAll({bool force = false, int retryCount = 3}) async {
    if (!canSync) {
      _status = _isOnline ? SyncStatus.idle : SyncStatus.offline;
      _safeNotifyListeners();
      return;
    }

    // Don't sync too frequently unless forced
    if (!force && _lastSyncTime != null) {
      final timeSinceLastSync = DateTime.now().difference(_lastSyncTime!);
      if (timeSinceLastSync.inMinutes < 5) {
        return;
      }
    }

    _status = SyncStatus.syncing;
    _lastError = null;
    _safeNotifyListeners();

    Exception? lastException;
    
    for (int attempt = 0; attempt < retryCount; attempt++) {
      try {
        // Test server connection first
        if (!await testServerConnection()) {
          throw Exception('Server connection failed');
        }
        
        // Sync events with timeout
        await _eventService.loadEvents(forceRefresh: true).timeout(
          const Duration(seconds: 30),
          onTimeout: () => throw Exception('Sync timeout')
        );
        
        // Update last sync time
        _lastSyncTime = DateTime.now();
        await StorageService.saveLastSyncTime(_lastSyncTime!);
        
        // Process any pending actions while we're connected
        await _processPendingActions();
        
        _status = SyncStatus.success;
        _safeNotifyListeners();
        return; // Success, exit retry loop
        
      } catch (e) {
        lastException = e is Exception ? e : Exception(e.toString());
        debugPrint('Sync attempt ${attempt + 1} failed: $e');
        
        // Wait before retrying (exponential backoff)
        if (attempt < retryCount - 1) {
          await Future.delayed(Duration(seconds: (attempt + 1) * 2));
        }
      }
    }
    
    // All retries failed
    _lastError = 'Sync failed after $retryCount attempts: ${lastException?.toString()}';
    _status = SyncStatus.error;
    _safeNotifyListeners();
  }

  Future<bool> testServerConnection() async {
    if (!_isOnline || _authService.serverUrl == null) {
      return false;
    }

    try {
      final response = await http.get(
        Uri.parse('${_authService.serverUrl}/api/health'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(seconds: 5));

      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Server connection test failed: $e');
      return false;
    }
  }

  Future<Map<String, dynamic>> getSyncStatus() async {
    final lastSync = StorageService.getLastSyncTime();
    final storageStats = StorageService.getStorageStats();
    
    return {
      'lastSync': lastSync?.toIso8601String(),
      'isOnline': _isOnline,
      'canSync': canSync,
      'status': _status.toString(),
      'lastError': _lastError,
      'storageStats': storageStats,
      'serverConnected': await testServerConnection(),
    };
  }

  Future<void> forceSyncEvents() async {
    await syncAll(force: true);
  }

  Future<void> handleOfflineAction(String action, Map<String, dynamic> data) async {
    final actionItem = {
      'id': DateTime.now().millisecondsSinceEpoch.toString(),
      'action': action,
      'data': data,
      'timestamp': DateTime.now().toIso8601String(),
      'retryCount': 0,
    };
    
    _pendingActions.add(actionItem);
    await StorageService.savePendingActions(_pendingActions);
    
    debugPrint('Offline action queued: $action (${_pendingActions.length} pending)');
    _safeNotifyListeners();
    
    // Try to sync immediately if we're online
    if (_isOnline && canSync) {
      await _processPendingActions();
    }
  }

  Future<void> _processPendingActions() async {
    if (_pendingActions.isEmpty || !canSync) return;
    
    final actionsToProcess = List<Map<String, dynamic>>.from(_pendingActions);
    final processedActions = <String>[];
    
    for (final action in actionsToProcess) {
      try {
        final success = await _executeAction(action);
        if (success) {
          processedActions.add(action['id']);
        } else {
          // Increment retry count
          action['retryCount'] = (action['retryCount'] ?? 0) + 1;
          
          // Remove actions that have failed too many times
          if (action['retryCount'] > 3) {
            processedActions.add(action['id']);
            debugPrint('Dropping action ${action['action']} after ${action['retryCount']} retries');
          }
        }
      } catch (e) {
        debugPrint('Error processing action ${action['action']}: $e');
        action['retryCount'] = (action['retryCount'] ?? 0) + 1;
        
        if (action['retryCount'] > 3) {
          processedActions.add(action['id']);
        }
      }
    }
    
    // Remove processed actions
    _pendingActions.removeWhere((action) => processedActions.contains(action['id']));
    
    if (processedActions.isNotEmpty) {
      await StorageService.savePendingActions(_pendingActions);
      _safeNotifyListeners();
    }
  }

  Future<bool> _executeAction(Map<String, dynamic> action) async {
    try {
      switch (action['action']) {
        case 'create_event':
          // This would create an event on the server
          debugPrint('Executing pending create_event action');
          return true; // Placeholder - would implement actual API call
          
        case 'update_event':
          // This would update an event on the server
          debugPrint('Executing pending update_event action');
          return true; // Placeholder - would implement actual API call
          
        case 'join_event':
          // This would join an event on the server
          debugPrint('Executing pending join_event action');
          return true; // Placeholder - would implement actual API call
          
        case 'leave_event':
          // This would leave an event on the server
          debugPrint('Executing pending leave_event action');
          return true; // Placeholder - would implement actual API call
          
        default:
          debugPrint('Unknown action type: ${action['action']}');
          return false;
      }
    } catch (e) {
      debugPrint('Error executing action ${action['action']}: $e');
      return false;
    }
  }

  void clearError() {
    _lastError = null;
    _safeNotifyListeners();
  }

  void resetSync() {
    _status = SyncStatus.idle;
    _lastError = null;
    _lastSyncTime = null;
    _safeNotifyListeners();
  }

  // Auto-sync timer (called from main app)
  void startAutoSync() {
    // In a production app, you'd set up a periodic timer here
    // For now, we'll rely on manual triggers and connectivity changes
  }

  void stopAutoSync() {
    // Stop any running timers
  }
}