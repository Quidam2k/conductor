class Validators {
  static String? validateUsername(String? value) {
    if (value == null || value.isEmpty) {
      return 'Username is required';
    }
    
    if (value.length < 3) {
      return 'Username must be at least 3 characters';
    }
    
    if (value.length > 50) {
      return 'Username cannot exceed 50 characters';
    }
    
    if (!RegExp(r'^[a-zA-Z0-9_]+$').hasMatch(value)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    
    return null;
  }

  static String? validatePassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Password is required';
    }
    
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    
    if (value.length > 128) {
      return 'Password cannot exceed 128 characters';
    }
    
    // Check for at least one letter and one number
    if (!RegExp(r'^(?=.*[a-zA-Z])(?=.*\d)').hasMatch(value)) {
      return 'Password must contain at least one letter and one number';
    }
    
    return null;
  }

  static String? validateEmail(String? value) {
    if (value == null || value.isEmpty) {
      return null; // Email is optional
    }
    
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value)) {
      return 'Please enter a valid email address';
    }
    
    return null;
  }

  static String? validateServerUrl(String? value) {
    if (value == null || value.isEmpty) {
      return 'Server URL is required';
    }
    
    // Add protocol if missing
    String url = value;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://$url';
    }
    
    try {
      final uri = Uri.parse(url);
      if (uri.host.isEmpty) {
        return 'Please enter a valid server URL';
      }
    } catch (e) {
      return 'Please enter a valid server URL';
    }
    
    return null;
  }

  static String? validateRequired(String? value, String fieldName) {
    if (value == null || value.trim().isEmpty) {
      return '$fieldName is required';
    }
    return null;
  }

  static String? validateEventTitle(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Event title is required';
    }
    
    if (value.trim().length < 3) {
      return 'Event title must be at least 3 characters';
    }
    
    if (value.length > 200) {
      return 'Event title cannot exceed 200 characters';
    }
    
    return null;
  }

  static String? validateEventDescription(String? value) {
    if (value != null && value.length > 2000) {
      return 'Description cannot exceed 2000 characters';
    }
    return null;
  }

  static String? validateInviteCode(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Invite code is required';
    }
    
    if (value.trim().length < 3) {
      return 'Invite code must be at least 3 characters';
    }
    
    return null;
  }

  static String? validateConfirmPassword(String? value, String? originalPassword) {
    if (value == null || value.isEmpty) {
      return 'Please confirm your password';
    }
    
    if (value != originalPassword) {
      return 'Passwords do not match';
    }
    
    return null;
  }

  static String? validateDateTime(DateTime? value, {DateTime? minDate, DateTime? maxDate}) {
    if (value == null) {
      return 'Date and time are required';
    }
    
    if (minDate != null && value.isBefore(minDate)) {
      return 'Date cannot be in the past';
    }
    
    if (maxDate != null && value.isAfter(maxDate)) {
      return 'Date is too far in the future';
    }
    
    return null;
  }

  static String? validateTimeRange(DateTime? startTime, DateTime? endTime) {
    if (startTime == null || endTime == null) {
      return null; // Individual validation will catch null values
    }
    
    if (endTime.isBefore(startTime)) {
      return 'End time must be after start time';
    }
    
    final duration = endTime.difference(startTime);
    if (duration.inMinutes < 5) {
      return 'Event must be at least 5 minutes long';
    }
    
    if (duration.inHours > 24) {
      return 'Event cannot be longer than 24 hours';
    }
    
    return null;
  }

  static String? validateLatitude(double? value) {
    if (value == null) {
      return null; // Location is optional
    }
    
    if (value < -90 || value > 90) {
      return 'Latitude must be between -90 and 90';
    }
    
    return null;
  }

  static String? validateLongitude(double? value) {
    if (value == null) {
      return null; // Location is optional
    }
    
    if (value < -180 || value > 180) {
      return 'Longitude must be between -180 and 180';
    }
    
    return null;
  }

  static String formatValidationErrors(List<String> errors) {
    if (errors.isEmpty) return '';
    if (errors.length == 1) return errors.first;
    
    final buffer = StringBuffer();
    for (int i = 0; i < errors.length; i++) {
      buffer.write('• ${errors[i]}');
      if (i < errors.length - 1) {
        buffer.write('\n');
      }
    }
    return buffer.toString();
  }

  // Helper method to validate all fields and return a summary
  static Map<String, String> validateRegistrationForm({
    required String username,
    required String password,
    required String confirmPassword,
    required String inviteCode,
    String? email,
  }) {
    final Map<String, String> errors = {};
    
    final usernameError = validateUsername(username);
    if (usernameError != null) errors['username'] = usernameError;
    
    final passwordError = validatePassword(password);
    if (passwordError != null) errors['password'] = passwordError;
    
    final confirmPasswordError = validateConfirmPassword(confirmPassword, password);
    if (confirmPasswordError != null) errors['confirmPassword'] = confirmPasswordError;
    
    final inviteCodeError = validateInviteCode(inviteCode);
    if (inviteCodeError != null) errors['inviteCode'] = inviteCodeError;
    
    if (email != null && email.isNotEmpty) {
      final emailError = validateEmail(email);
      if (emailError != null) errors['email'] = emailError;
    }
    
    return errors;
  }

  static Map<String, String> validateLoginForm({
    required String username,
    required String password,
  }) {
    final Map<String, String> errors = {};
    
    if (username.trim().isEmpty) {
      errors['username'] = 'Username is required';
    }
    
    if (password.isEmpty) {
      errors['password'] = 'Password is required';
    }
    
    return errors;
  }
}