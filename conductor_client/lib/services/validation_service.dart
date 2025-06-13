class ValidationService {
  // Email validation
  static bool isValidEmail(String email) {
    if (email.isEmpty) return false;
    
    final emailRegex = RegExp(
      r'^[a-zA-Z0-9.!#$%&*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'
    );
    
    return emailRegex.hasMatch(email) && email.length <= 254;
  }

  // Username validation
  static ValidationResult validateUsername(String username) {
    if (username.isEmpty) {
      return ValidationResult(false, 'Username is required');
    }
    
    if (username.length < 3) {
      return ValidationResult(false, 'Username must be at least 3 characters');
    }
    
    if (username.length > 30) {
      return ValidationResult(false, 'Username must be 30 characters or less');
    }
    
    final usernameRegex = RegExp(r'^[a-zA-Z0-9_-]+$');
    if (!usernameRegex.hasMatch(username)) {
      return ValidationResult(false, 'Username can only contain letters, numbers, underscores, and hyphens');
    }
    
    return ValidationResult(true, null);
  }

  // Password validation
  static ValidationResult validatePassword(String password) {
    if (password.isEmpty) {
      return ValidationResult(false, 'Password is required');
    }
    
    if (password.length < 8) {
      return ValidationResult(false, 'Password must be at least 8 characters');
    }
    
    if (password.length > 128) {
      return ValidationResult(false, 'Password must be 128 characters or less');
    }
    
    // Check for at least one uppercase letter
    if (!RegExp(r'[A-Z]').hasMatch(password)) {
      return ValidationResult(false, 'Password must contain at least one uppercase letter');
    }
    
    // Check for at least one lowercase letter
    if (!RegExp(r'[a-z]').hasMatch(password)) {
      return ValidationResult(false, 'Password must contain at least one lowercase letter');
    }
    
    // Check for at least one digit
    if (!RegExp(r'[0-9]').hasMatch(password)) {
      return ValidationResult(false, 'Password must contain at least one number');
    }
    
    // Check for at least one special character
    if (!RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(password)) {
      return ValidationResult(false, 'Password must contain at least one special character');
    }
    
    return ValidationResult(true, null);
  }

  // Event title validation
  static ValidationResult validateEventTitle(String title) {
    if (title.trim().isEmpty) {
      return ValidationResult(false, 'Event title is required');
    }
    
    if (title.length < 3) {
      return ValidationResult(false, 'Event title must be at least 3 characters');
    }
    
    if (title.length > 100) {
      return ValidationResult(false, 'Event title must be 100 characters or less');
    }
    
    // Check for only printable characters
    if (!RegExp(r'^[\x20-\x7E]+$').hasMatch(title)) {
      return ValidationResult(false, 'Event title contains invalid characters');
    }
    
    return ValidationResult(true, null);
  }

  // Event description validation
  static ValidationResult validateEventDescription(String? description) {
    if (description == null || description.trim().isEmpty) {
      return ValidationResult(true, null); // Description is optional
    }
    
    if (description.length > 1000) {
      return ValidationResult(false, 'Event description must be 1000 characters or less');
    }
    
    return ValidationResult(true, null);
  }

  // URL validation (for server URLs)
  static ValidationResult validateServerUrl(String url) {
    if (url.trim().isEmpty) {
      return ValidationResult(false, 'Server URL is required');
    }
    
    try {
      final uri = Uri.parse(url);
      
      if (!uri.hasScheme || (!uri.scheme.startsWith('http') && !uri.scheme.startsWith('https'))) {
        return ValidationResult(false, 'Server URL must start with http:// or https://');
      }
      
      if (!uri.hasAuthority || uri.host.isEmpty) {
        return ValidationResult(false, 'Server URL must have a valid host');
      }
      
      // Check for common localhost patterns
      if (uri.host == 'localhost' || uri.host == '127.0.0.1') {
        return ValidationResult(true, null);
      }
      
      // Basic IP address validation
      final ipRegex = RegExp(r'^(\d{1,3}\.){3}\d{1,3}$');
      if (ipRegex.hasMatch(uri.host)) {
        final parts = uri.host.split('.');
        for (final part in parts) {
          final num = int.tryParse(part);
          if (num == null || num < 0 || num > 255) {
            return ValidationResult(false, 'Invalid IP address in server URL');
          }
        }
        return ValidationResult(true, null);
      }
      
      // Basic domain validation
      final domainRegex = RegExp(r'^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$');
      if (!domainRegex.hasMatch(uri.host)) {
        return ValidationResult(false, 'Invalid domain name in server URL');
      }
      
      return ValidationResult(true, null);
      
    } catch (e) {
      return ValidationResult(false, 'Invalid server URL format');
    }
  }

  // Invite code validation
  static ValidationResult validateInviteCode(String code) {
    if (code.trim().isEmpty) {
      return ValidationResult(false, 'Invite code is required');
    }
    
    // Invite codes should be alphanumeric and between 6-20 characters
    if (code.length < 6 || code.length > 20) {
      return ValidationResult(false, 'Invite code must be between 6 and 20 characters');
    }
    
    final codeRegex = RegExp(r'^[a-zA-Z0-9]+$');
    if (!codeRegex.hasMatch(code)) {
      return ValidationResult(false, 'Invite code can only contain letters and numbers');
    }
    
    return ValidationResult(true, null);
  }

  // Date/time validation
  static ValidationResult validateEventDateTime(DateTime? startTime, DateTime? endTime) {
    if (startTime == null) {
      return ValidationResult(false, 'Start time is required');
    }
    
    final now = DateTime.now();
    if (startTime.isBefore(now.subtract(const Duration(minutes: 5)))) {
      return ValidationResult(false, 'Start time cannot be in the past');
    }
    
    if (endTime != null) {
      if (endTime.isBefore(startTime)) {
        return ValidationResult(false, 'End time must be after start time');
      }
      
      final duration = endTime.difference(startTime);
      if (duration.inDays > 30) {
        return ValidationResult(false, 'Event duration cannot exceed 30 days');
      }
    }
    
    return ValidationResult(true, null);
  }

  // Generic text length validation
  static ValidationResult validateTextLength(String text, String fieldName, {int minLength = 0, int maxLength = 1000}) {
    if (text.length < minLength) {
      return ValidationResult(false, '$fieldName must be at least $minLength characters');
    }
    
    if (text.length > maxLength) {
      return ValidationResult(false, '$fieldName must be $maxLength characters or less');
    }
    
    return ValidationResult(true, null);
  }

  // Sanitize input (remove potentially harmful characters)
  static String sanitizeInput(String input) {
    // Remove null bytes and control characters except newlines and tabs
    return input.replaceAll(RegExp(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'), '');
  }

  // Validate file upload (for future use)
  static ValidationResult validateFileUpload(String fileName, int fileSize, {int maxSize = 10 * 1024 * 1024}) {
    if (fileName.isEmpty) {
      return ValidationResult(false, 'File name is required');
    }
    
    if (fileSize > maxSize) {
      final maxSizeMB = (maxSize / (1024 * 1024)).round();
      return ValidationResult(false, 'File size cannot exceed ${maxSizeMB}MB');
    }
    
    // Check for safe file extensions (whitelist approach)
    final allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.md'];
    final extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    
    if (!allowedExtensions.contains(extension)) {
      return ValidationResult(false, 'File type not allowed. Allowed types: ${allowedExtensions.join(', ')}');
    }
    
    return ValidationResult(true, null);
  }

  // Validate coordinate (for location data)
  static ValidationResult validateCoordinate(double? latitude, double? longitude) {
    if (latitude == null || longitude == null) {
      return ValidationResult(true, null); // Coordinates are optional
    }
    
    if (latitude < -90 || latitude > 90) {
      return ValidationResult(false, 'Latitude must be between -90 and 90 degrees');
    }
    
    if (longitude < -180 || longitude > 180) {
      return ValidationResult(false, 'Longitude must be between -180 and 180 degrees');
    }
    
    return ValidationResult(true, null);
  }

  // Comprehensive form validation
  static Map<String, String> validateRegistrationForm({
    required String username,
    required String password,
    required String inviteCode,
    String? email,
  }) {
    final errors = <String, String>{};
    
    final usernameResult = validateUsername(username);
    if (!usernameResult.isValid) {
      errors['username'] = usernameResult.error!;
    }
    
    final passwordResult = validatePassword(password);
    if (!passwordResult.isValid) {
      errors['password'] = passwordResult.error!;
    }
    
    final inviteResult = validateInviteCode(inviteCode);
    if (!inviteResult.isValid) {
      errors['inviteCode'] = inviteResult.error!;
    }
    
    if (email != null && email.isNotEmpty && !isValidEmail(email)) {
      errors['email'] = 'Please enter a valid email address';
    }
    
    return errors;
  }

  static Map<String, String> validateLoginForm({
    required String username,
    required String password,
  }) {
    final errors = <String, String>{};
    
    if (username.trim().isEmpty) {
      errors['username'] = 'Username is required';
    }
    
    if (password.isEmpty) {
      errors['password'] = 'Password is required';
    }
    
    return errors;
  }

  static Map<String, String> validateEventForm({
    required String title,
    String? description,
    DateTime? startTime,
    DateTime? endTime,
  }) {
    final errors = <String, String>{};
    
    final titleResult = validateEventTitle(title);
    if (!titleResult.isValid) {
      errors['title'] = titleResult.error!;
    }
    
    final descResult = validateEventDescription(description);
    if (!descResult.isValid) {
      errors['description'] = descResult.error!;
    }
    
    final dateResult = validateEventDateTime(startTime, endTime);
    if (!dateResult.isValid) {
      errors['dateTime'] = dateResult.error!;
    }
    
    return errors;
  }
}

class ValidationResult {
  final bool isValid;
  final String? error;

  ValidationResult(this.isValid, this.error);
}