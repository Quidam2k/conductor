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

  SyncService({
    AuthService? authService,
    EventService? eventService,
  }) : _authService = authService ?? AuthService(),
       _eventService = eventService ?? EventService() {
    _initializeConnectivity();
  }

  SyncStatus get status => _status;
  String? get lastError => _lastError;
  DateTime? get lastSyncTime => _lastSyncTime;
  bool get isOnline => _isOnline;
  bool get canSync => _isOnline && _authService.isAuthenticated;

  void _initializeConnectivity() {
    Connectivity().onConnectivityChanged.listen((ConnectivityResult result) {
      final wasOnline = _isOnline;
      _isOnline = result != ConnectivityResult.none;
      
      if (!wasOnline && _isOnline) {
        // We came back online, trigger sync
        syncAll();
      }
      
      notifyListeners();
    });
    
    // Check initial connectivity
    _checkConnectivity();
  }

  Future<void> _checkConnectivity() async {
    final result = await Connectivity().checkConnectivity();
    _isOnline = result != ConnectivityResult.none;
    notifyListeners();
  }

  Future<void> syncAll({bool force = false}) async {
    if (!canSync) {
      _status = _isOnline ? SyncStatus.idle : SyncStatus.offline;
      notifyListeners();
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
    notifyListeners();

    try {
      // Sync events
      await _eventService.loadEvents(forceRefresh: true);
      
      // Update last sync time
      _lastSyncTime = DateTime.now();
      await StorageService.saveLastSyncTime(_lastSyncTime!);
      
      _status = SyncStatus.success;
    } catch (e) {
      _lastError = e.toString();
      _status = SyncStatus.error;
      debugPrint('Sync error: $e');
    }
    
    notifyListeners();
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
    // In a full implementation, you would queue offline actions
    // and sync them when connection is restored
    debugPrint('Offline action queued: $action');
    
    // For now, we'll just store it locally
    // In Phase 2, this would integrate with the mesh networking
  }

  void clearError() {
    _lastError = null;
    notifyListeners();
  }

  void resetSync() {
    _status = SyncStatus.idle;
    _lastError = null;
    _lastSyncTime = null;
    notifyListeners();
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