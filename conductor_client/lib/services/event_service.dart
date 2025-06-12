import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/event.dart';
import 'auth_service.dart';
import 'storage_service.dart';

class EventService extends ChangeNotifier {
  final AuthService _authService;
  List<Event> _events = [];
  bool _isLoading = false;
  String? _error;

  EventService({AuthService? authService}) : _authService = authService ?? AuthService();

  List<Event> get events => _events;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> loadEvents({bool forceRefresh = false}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Load from local storage first
      if (!forceRefresh) {
        final localEvents = StorageService.getEventsAsList();
        if (localEvents.isNotEmpty) {
          _events = localEvents;
          notifyListeners();
        }
      }

      // Then sync with server if we have connection
      if (_authService.isAuthenticated && _authService.serverUrl != null) {
        await _syncWithServer();
      }
    } catch (e) {
      _error = e.toString();
      debugPrint('Error loading events: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _syncWithServer() async {
    final headers = await _authService.getAuthHeaders();
    final response = await http.get(
      Uri.parse('${_authService.serverUrl}/api/events'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final eventList = (data['events'] as List)
          .map((eventJson) => Event.fromJson(eventJson))
          .toList();

      _events = eventList;
      await StorageService.saveEvents(eventList);
      notifyListeners();
    } else if (response.statusCode == 401) {
      // Token expired, try to refresh
      final refreshed = await _authService.refreshToken();
      if (refreshed) {
        await _syncWithServer(); // Retry with new token
      } else {
        throw Exception('Authentication failed');
      }
    } else {
      final data = jsonDecode(response.body);
      throw Exception(data['error']['message'] ?? 'Failed to load events');
    }
  }

  Future<Event?> getEvent(String eventId, {bool forceRefresh = false}) async {
    try {
      // Check local storage first
      if (!forceRefresh) {
        final localEvent = StorageService.getEvent(eventId);
        if (localEvent != null) {
          return localEvent;
        }
      }

      // Fetch from server
      if (_authService.isAuthenticated && _authService.serverUrl != null) {
        final headers = await _authService.getAuthHeaders();
        final response = await http.get(
          Uri.parse('${_authService.serverUrl}/api/events/$eventId'),
          headers: headers,
        );

        if (response.statusCode == 200) {
          final data = jsonDecode(response.body);
          final event = Event.fromJson(data['event']);
          await StorageService.saveEvent(event);
          
          // Update local events list
          final index = _events.indexWhere((e) => e.id == eventId);
          if (index >= 0) {
            _events[index] = event;
          } else {
            _events.add(event);
          }
          notifyListeners();
          
          return event;
        } else if (response.statusCode == 401) {
          final refreshed = await _authService.refreshToken();
          if (refreshed) {
            return await getEvent(eventId, forceRefresh: true);
          } else {
            throw Exception('Authentication failed');
          }
        } else {
          final data = jsonDecode(response.body);
          throw Exception(data['error']['message'] ?? 'Failed to load event');
        }
      }

      return null;
    } catch (e) {
      debugPrint('Error getting event: $e');
      rethrow;
    }
  }

  Future<Event?> createEvent({
    required String title,
    String? description,
    EventLocation? location,
    DateTime? startTime,
    DateTime? endTime,
    EventData? eventData,
  }) async {
    if (!_authService.isAuthenticated || _authService.serverUrl == null) {
      throw Exception('Not authenticated or no server connection');
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final headers = await _authService.getAuthHeaders();
      final body = {
        'title': title,
        'description': description,
        'location': location?.toJson(),
        'startTime': startTime?.toIso8601String(),
        'endTime': endTime?.toIso8601String(),
        'timeline': eventData?.timeline?.toJson(),
        'roles': eventData?.roles?.map((key, value) => MapEntry(key, value.toJson())),
        'safety': eventData?.safety?.toJson(),
      };

      final response = await http.post(
        Uri.parse('${_authService.serverUrl}/api/events'),
        headers: headers,
        body: jsonEncode(body),
      );

      if (response.statusCode == 201) {
        final data = jsonDecode(response.body);
        final event = Event.fromJson(data['event']);
        
        _events.add(event);
        await StorageService.saveEvent(event);
        notifyListeners();
        
        return event;
      } else if (response.statusCode == 401) {
        final refreshed = await _authService.refreshToken();
        if (refreshed) {
          return await createEvent(
            title: title,
            description: description,
            location: location,
            startTime: startTime,
            endTime: endTime,
            eventData: eventData,
          );
        } else {
          throw Exception('Authentication failed');
        }
      } else {
        final data = jsonDecode(response.body);
        throw Exception(data['error']['message'] ?? 'Failed to create event');
      }
    } catch (e) {
      _error = e.toString();
      debugPrint('Error creating event: $e');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Event?> updateEvent(String eventId, Map<String, dynamic> updates) async {
    if (!_authService.isAuthenticated || _authService.serverUrl == null) {
      throw Exception('Not authenticated or no server connection');
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final headers = await _authService.getAuthHeaders();
      final response = await http.put(
        Uri.parse('${_authService.serverUrl}/api/events/$eventId'),
        headers: headers,
        body: jsonEncode(updates),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final event = Event.fromJson(data['event']);
        
        final index = _events.indexWhere((e) => e.id == eventId);
        if (index >= 0) {
          _events[index] = event;
        }
        
        await StorageService.saveEvent(event);
        notifyListeners();
        
        return event;
      } else if (response.statusCode == 401) {
        final refreshed = await _authService.refreshToken();
        if (refreshed) {
          return await updateEvent(eventId, updates);
        } else {
          throw Exception('Authentication failed');
        }
      } else {
        final data = jsonDecode(response.body);
        throw Exception(data['error']['message'] ?? 'Failed to update event');
      }
    } catch (e) {
      _error = e.toString();
      debugPrint('Error updating event: $e');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> deleteEvent(String eventId) async {
    if (!_authService.isAuthenticated || _authService.serverUrl == null) {
      throw Exception('Not authenticated or no server connection');
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final headers = await _authService.getAuthHeaders();
      final response = await http.delete(
        Uri.parse('${_authService.serverUrl}/api/events/$eventId'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        _events.removeWhere((e) => e.id == eventId);
        await StorageService.deleteEvent(eventId);
        notifyListeners();
        return true;
      } else if (response.statusCode == 401) {
        final refreshed = await _authService.refreshToken();
        if (refreshed) {
          return await deleteEvent(eventId);
        } else {
          throw Exception('Authentication failed');
        }
      } else {
        final data = jsonDecode(response.body);
        throw Exception(data['error']['message'] ?? 'Failed to delete event');
      }
    } catch (e) {
      _error = e.toString();
      debugPrint('Error deleting event: $e');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> joinEvent(String eventId, {String role = 'participant'}) async {
    if (!_authService.isAuthenticated || _authService.serverUrl == null) {
      throw Exception('Not authenticated or no server connection');
    }

    try {
      final headers = await _authService.getAuthHeaders();
      final response = await http.post(
        Uri.parse('${_authService.serverUrl}/api/events/$eventId/join'),
        headers: headers,
        body: jsonEncode({'role': role}),
      );

      if (response.statusCode == 200) {
        // Refresh the event to get updated participant list
        await getEvent(eventId, forceRefresh: true);
        return true;
      } else if (response.statusCode == 401) {
        final refreshed = await _authService.refreshToken();
        if (refreshed) {
          return await joinEvent(eventId, role: role);
        } else {
          throw Exception('Authentication failed');
        }
      } else {
        final data = jsonDecode(response.body);
        throw Exception(data['error']['message'] ?? 'Failed to join event');
      }
    } catch (e) {
      debugPrint('Error joining event: $e');
      rethrow;
    }
  }

  Future<bool> leaveEvent(String eventId) async {
    if (!_authService.isAuthenticated || _authService.serverUrl == null) {
      throw Exception('Not authenticated or no server connection');
    }

    try {
      final headers = await _authService.getAuthHeaders();
      final response = await http.delete(
        Uri.parse('${_authService.serverUrl}/api/events/$eventId/leave'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        // Refresh the event to get updated participant list
        await getEvent(eventId, forceRefresh: true);
        return true;
      } else if (response.statusCode == 401) {
        final refreshed = await _authService.refreshToken();
        if (refreshed) {
          return await leaveEvent(eventId);
        } else {
          throw Exception('Authentication failed');
        }
      } else {
        final data = jsonDecode(response.body);
        throw Exception(data['error']['message'] ?? 'Failed to leave event');
      }
    } catch (e) {
      debugPrint('Error leaving event: $e');
      rethrow;
    }
  }

  Event? getLocalEvent(String eventId) {
    try {
      return _events.firstWhere((event) => event.id == eventId);
    } catch (e) {
      return null;
    }
  }

  List<Event> getEventsByStatus(String status) {
    return _events.where((event) => event.status == status).toList();
  }

  List<Event> getUpcomingEvents() {
    final now = DateTime.now();
    return _events
        .where((event) => 
            event.startTime != null && 
            event.startTime!.isAfter(now) &&
            (event.status == 'published' || event.status == 'active'))
        .toList()
      ..sort((a, b) => a.startTime!.compareTo(b.startTime!));
  }

  List<Event> getMyEvents() {
    final currentUserId = _authService.currentUser?.id;
    if (currentUserId == null) return [];
    
    return _events
        .where((event) => 
            event.creatorId == currentUserId ||
            (event.participants?.any((p) => p.userId == currentUserId) ?? false))
        .toList();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}