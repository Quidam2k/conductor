import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/user.dart';
import 'storage_service.dart';

class AuthService extends ChangeNotifier {
  User? _currentUser;
  String? _authToken;
  String? _serverUrl;
  bool _isLoading = false;

  User? get currentUser => _currentUser;
  String? get authToken => _authToken;
  String? get serverUrl => _serverUrl;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _currentUser != null && _authToken != null;
  bool get hasServerConnection => _serverUrl != null;

  Future<void> initializeAuth() async {
    _isLoading = true;
    notifyListeners();

    try {
      // Load server connection
      final serverConnection = StorageService.getServerConnection();
      if (serverConnection != null) {
        _serverUrl = serverConnection['serverUrl'];
      }

      // Load auth token
      _authToken = await StorageService.getAuthToken();

      // Load current user
      _currentUser = StorageService.getCurrentUser();

      // Verify token if we have one
      if (_authToken != null && _serverUrl != null) {
        try {
          await verifyToken();
        } catch (e) {
          // Token is invalid, clear auth data
          await logout();
        }
      }
    } catch (e) {
      debugPrint('Error initializing auth: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> connectToServer(String serverUrl) async {
    _isLoading = true;
    notifyListeners();

    try {
      // Ensure URL format is correct
      if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
        serverUrl = 'http://$serverUrl';
      }

      // Test connection with health check
      final response = await http.get(
        Uri.parse('$serverUrl/api/health'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        _serverUrl = serverUrl;
        
        // Save connection info
        await StorageService.saveServerConnection({
          'serverUrl': serverUrl,
          'connectedAt': DateTime.now().toIso8601String(),
        });

        notifyListeners();
        return true;
      } else {
        throw Exception('Server returned status ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('Error connecting to server: $e');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> connectWithQRData(Map<String, dynamic> qrData) async {
    try {
      final serverUrl = qrData['serverUrl'];
      if (serverUrl == null) {
        throw Exception('Invalid QR code data');
      }

      return await connectToServer(serverUrl);
    } catch (e) {
      debugPrint('Error connecting with QR data: $e');
      return false;
    }
  }

  Future<bool> register({
    required String username,
    required String password,
    required String inviteCode,
    String? email,
  }) async {
    if (_serverUrl == null) {
      throw Exception('No server connection');
    }

    _isLoading = true;
    notifyListeners();

    try {
      final response = await http.post(
        Uri.parse('$_serverUrl/api/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': username,
          'password': password,
          'inviteCode': inviteCode,
          'email': email,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201) {
        _authToken = data['token'];
        _currentUser = User.fromJson(data['user']);

        // Save auth data
        await StorageService.saveAuthToken(_authToken!);
        await StorageService.saveCurrentUser(_currentUser!);

        notifyListeners();
        return true;
      } else {
        throw Exception(data['error']['message'] ?? 'Registration failed');
      }
    } catch (e) {
      debugPrint('Registration error: $e');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> login({
    required String username,
    required String password,
  }) async {
    if (_serverUrl == null) {
      throw Exception('No server connection');
    }

    _isLoading = true;
    notifyListeners();

    try {
      final response = await http.post(
        Uri.parse('$_serverUrl/api/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': username,
          'password': password,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        _authToken = data['token'];
        _currentUser = User.fromJson(data['user']);

        // Save auth data
        await StorageService.saveAuthToken(_authToken!);
        await StorageService.saveCurrentUser(_currentUser!);

        notifyListeners();
        return true;
      } else {
        throw Exception(data['error']['message'] ?? 'Login failed');
      }
    } catch (e) {
      debugPrint('Login error: $e');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      // Call server logout if we have a token
      if (_authToken != null && _serverUrl != null) {
        try {
          await http.post(
            Uri.parse('$_serverUrl/api/auth/logout'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $_authToken',
            },
          );
        } catch (e) {
          debugPrint('Server logout error: $e');
        }
      }

      // Clear local auth data
      _authToken = null;
      _currentUser = null;

      await StorageService.clearAuthToken();
      await StorageService.clearCurrentUser();

      notifyListeners();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> verifyToken() async {
    if (_authToken == null || _serverUrl == null) {
      throw Exception('No token or server connection');
    }

    final response = await http.get(
      Uri.parse('$_serverUrl/api/auth/verify'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $_authToken',
      },
    );

    if (response.statusCode != 200) {
      throw Exception('Token verification failed');
    }

    final data = jsonDecode(response.body);
    _currentUser = User.fromJson(data['user']);
    await StorageService.saveCurrentUser(_currentUser!);
    notifyListeners();
  }

  Future<bool> refreshToken() async {
    if (_authToken == null || _serverUrl == null) {
      return false;
    }

    try {
      final response = await http.post(
        Uri.parse('$_serverUrl/api/auth/refresh'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_authToken',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _authToken = data['token'];
        await StorageService.saveAuthToken(_authToken!);
        notifyListeners();
        return true;
      } else {
        await logout();
        return false;
      }
    } catch (e) {
      debugPrint('Token refresh error: $e');
      await logout();
      return false;
    }
  }

  Future<Map<String, String>> getAuthHeaders() async {
    if (_authToken == null) {
      throw Exception('No auth token available');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $_authToken',
    };
  }

  Future<void> clearAllData() async {
    _isLoading = true;
    notifyListeners();

    try {
      _authToken = null;
      _currentUser = null;
      _serverUrl = null;

      await StorageService.clearAllData();

      notifyListeners();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}