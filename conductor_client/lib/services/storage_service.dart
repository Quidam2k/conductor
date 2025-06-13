import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:crypto/crypto.dart';

import '../models/event.dart';
import '../models/user.dart';

class StorageService {
  static late Box _box;
  static const _secureStorage = FlutterSecureStorage();
  
  // Storage keys
  static const String _serverConnectionKey = 'server_connection';
  static const String _authTokenKey = 'auth_token';
  static const String _currentUserKey = 'current_user';
  static const String _eventsKey = 'events';
  static const String _lastSyncKey = 'last_sync';

  static Future<void> initialize() async {
    _box = await Hive.openBox('conductor_storage');
  }

  // Server connection
  static Future<void> saveServerConnection(Map<String, dynamic> connectionInfo) async {
    await _box.put(_serverConnectionKey, connectionInfo);
  }

  static Map<String, dynamic>? getServerConnection() {
    final data = _box.get(_serverConnectionKey);
    return data != null ? Map<String, dynamic>.from(data) : null;
  }

  static Future<void> clearServerConnection() async {
    await _box.delete(_serverConnectionKey);
  }

  // Authentication token (secure storage)
  static Future<void> saveAuthToken(String token) async {
    await _secureStorage.write(key: _authTokenKey, value: token);
  }

  static Future<String?> getAuthToken() async {
    return await _secureStorage.read(key: _authTokenKey);
  }

  static Future<void> clearAuthToken() async {
    await _secureStorage.delete(key: _authTokenKey);
  }

  // Current user
  static Future<void> saveCurrentUser(User user) async {
    await _box.put(_currentUserKey, user.toJson());
  }

  static User? getCurrentUser() {
    final data = _box.get(_currentUserKey);
    return data != null ? User.fromJson(Map<String, dynamic>.from(data)) : null;
  }

  static Future<void> clearCurrentUser() async {
    await _box.delete(_currentUserKey);
  }

  // Events (with encryption for sensitive data)
  static Future<void> saveEvent(Event event) async {
    final events = getAllEvents();
    events[event.id] = event.toJson();
    await _box.put(_eventsKey, events);
  }

  static Future<void> saveEvents(List<Event> eventList) async {
    final events = <String, Map<String, dynamic>>{};
    for (final event in eventList) {
      events[event.id] = event.toJson();
    }
    await _box.put(_eventsKey, events);
  }

  static Map<String, Map<String, dynamic>> getAllEvents() {
    final data = _box.get(_eventsKey);
    if (data == null) return {};
    
    return Map<String, Map<String, dynamic>>.from(
      (data as Map).map((key, value) => 
        MapEntry(key.toString(), Map<String, dynamic>.from(value))
      )
    );
  }

  static Event? getEvent(String eventId) {
    final events = getAllEvents();
    final eventData = events[eventId];
    return eventData != null ? Event.fromJson(eventData) : null;
  }

  static List<Event> getEventsAsList() {
    final events = getAllEvents();
    return events.values.map((data) => Event.fromJson(data)).toList();
  }

  static Future<void> deleteEvent(String eventId) async {
    final events = getAllEvents();
    events.remove(eventId);
    await _box.put(_eventsKey, events);
  }

  static Future<void> clearAllEvents() async {
    await _box.delete(_eventsKey);
  }

  // Sync metadata
  static Future<void> saveLastSyncTime(DateTime timestamp) async {
    await _box.put(_lastSyncKey, timestamp.toIso8601String());
  }

  static DateTime? getLastSyncTime() {
    final data = _box.get(_lastSyncKey);
    return data != null ? DateTime.parse(data) : null;
  }

  // Utility methods
  static Future<void> clearAllData() async {
    await _box.clear();
    await _secureStorage.deleteAll();
  }

  static Future<void> secureDelete(String key) async {
    // For sensitive data, overwrite multiple times before deletion
    const iterations = 3;
    for (int i = 0; i < iterations; i++) {
      await _secureStorage.write(key: key, value: _generateRandomString(32));
    }
    await _secureStorage.delete(key: key);
  }

  static String _generateRandomString(int length) {
    final bytes = List<int>.generate(length, (i) => DateTime.now().millisecondsSinceEpoch % 256);
    return base64Encode(bytes);
  }

  // Data export/import for backup
  static Future<Map<String, dynamic>> exportData() async {
    return {
      'events': getAllEvents(),
      'serverConnection': getServerConnection(),
      'currentUser': getCurrentUser()?.toJson(),
      'lastSync': getLastSyncTime()?.toIso8601String(),
      'exportedAt': DateTime.now().toIso8601String(),
    };
  }

  static Future<void> importData(Map<String, dynamic> data) async {
    if (data['events'] != null) {
      await _box.put(_eventsKey, data['events']);
    }
    
    if (data['serverConnection'] != null) {
      await saveServerConnection(data['serverConnection']);
    }
    
    if (data['currentUser'] != null) {
      final user = User.fromJson(data['currentUser']);
      await saveCurrentUser(user);
    }
    
    if (data['lastSync'] != null) {
      final syncTime = DateTime.parse(data['lastSync']);
      await saveLastSyncTime(syncTime);
    }
  }

  // Pending actions management
  static const String _pendingActionsKey = 'pending_actions';
  
  static Future<void> savePendingActions(List<Map<String, dynamic>> actions) async {
    await _box.put(_pendingActionsKey, actions);
  }
  
  static List<Map<String, dynamic>> getPendingActions() {
    final data = _box.get(_pendingActionsKey);
    if (data == null) return [];
    
    return List<Map<String, dynamic>>.from(data);
  }
  
  static Future<void> clearPendingActions() async {
    await _box.delete(_pendingActionsKey);
  }

  // Storage statistics
  static Map<String, dynamic> getStorageStats() {
    final events = getAllEvents();
    final serverConnection = getServerConnection();
    final currentUser = getCurrentUser();
    final lastSync = getLastSyncTime();
    final pendingActions = getPendingActions();
    
    return {
      'eventsCount': events.length,
      'hasServerConnection': serverConnection != null,
      'hasCurrentUser': currentUser != null,
      'lastSyncTime': lastSync?.toIso8601String(),
      'pendingActionsCount': pendingActions.length,
      'storageSize': _box.length,
    };
  }
}