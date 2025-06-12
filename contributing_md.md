# Contributing to Conductor

## Welcome Contributors

Thank you for your interest in contributing to Conductor! This project aims to create secure, decentralized tools for peaceful protest coordination. Your contributions help build technology that supports democratic participation and civil rights.

## Code of Conduct

### Our Commitment

We are committed to providing a welcoming, inclusive environment for all contributors regardless of background, identity, or experience level. This project explicitly supports:

- **Peaceful Assembly**: All contributions must align with peaceful, legal protest coordination
- **Privacy Rights**: Protecting participant privacy and security is paramount
- **Inclusive Participation**: Welcoming contributors from diverse backgrounds and skill levels
- **Democratic Values**: Supporting democratic participation and civil liberties

### Expected Behavior

- Use welcoming and inclusive language
- Respect differing viewpoints and experiences
- Accept constructive criticism gracefully
- Focus on what is best for the community and project goals
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, trolling, or discriminatory language
- Personal attacks or inflammatory comments
- Publishing others' private information without consent
- Contributing code that could facilitate violence or illegal activities
- Any conduct that undermines the project's mission of peaceful coordination

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Technical Skills**: Basic knowledge of Node.js, Flutter, or relevant technologies
- **Development Environment**: Set up according to [IMPLEMENTATION.md](./IMPLEMENTATION.md)
- **Understanding of Project Goals**: Read [README.md](./README.md) and [ROADMAP.md](./ROADMAP.md)

### Setting Up Your Development Environment

1. **Fork the Repository**
   ```bash
   # Clone your fork
   git clone https://github.com/your-username/conductor.git
   cd conductor
   
   # Add upstream remote
   git remote add upstream https://github.com/original-repo/conductor.git
   ```

2. **Install Dependencies**
   ```bash
   # Server dependencies
   cd server && npm install
   
   # Mobile client dependencies
   cd ../mobile && flutter pub get
   ```

3. **Run Tests**
   ```bash
   # Verify your environment
   cd server && npm test
   cd ../mobile && flutter test
   ```

4. **Start Development Servers**
   ```bash
   # In separate terminals
   cd server && npm run dev
   cd mobile && flutter run
   ```

## How to Contribute

### Types of Contributions Needed

#### 🔒 Security & Privacy
- Security auditing and vulnerability testing
- Cryptographic implementation review
- Privacy-preserving feature development
- Threat modeling and risk assessment

#### 🔧 Core Development
- Server-side API development (Node.js)
- Mobile client development (Flutter)
- Database design and optimization
- Real-time communication protocols

#### 🌐 Mesh Networking
- Bluetooth Low Energy implementation
- Peer-to-peer networking protocols
- Mesh network topology optimization
- Offline synchronization mechanisms

#### 🎨 User Experience
- UI/UX design and implementation
- Accessibility improvements
- User research and testing
- Documentation and tutorials

#### 📱 Platform Support
- Cross-platform compatibility
- Device-specific optimizations
- Performance improvements
- Battery usage optimization

#### 🧪 Testing & Quality Assurance
- Test case development
- Automated testing infrastructure
- Performance testing
- Field testing coordination

#### 📖 Documentation
- Technical documentation
- User guides and tutorials
- API documentation
- Translation and localization

### Contribution Workflow

#### 1. Planning Your Contribution

Before starting work:

1. **Check Existing Issues**: Look for related issues or feature requests
2. **Create an Issue**: If none exists, create one describing your proposed contribution
3. **Discuss Approach**: Comment on the issue to discuss your planned approach
4. **Get Approval**: Wait for maintainer feedback before starting significant work

#### 2. Development Process

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Follow the coding standards outlined below
   - Write tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   # Run all tests
   npm run test:all
   flutter test
   
   # Run security checks
   npm run security:scan
   
   # Run linting
   npm run lint
   flutter analyze
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add bluetooth device discovery protocol
   
   - Implement BLE scanning for nearby devices
   - Add device verification and trust establishment
   - Include comprehensive test coverage
   - Update API documentation
   
   Closes #123"
   ```

#### 3. Submitting Your Contribution

1. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request**
   - Use the pull request template
   - Provide clear description of changes
   - Link to related issues
   - Include screenshots for UI changes

3. **Respond to Feedback**
   - Address review comments promptly
   - Make requested changes
   - Keep the discussion constructive

## Coding Standards

### General Principles

- **Security First**: All code must prioritize security and privacy
- **Clean Code**: Write readable, maintainable code with clear naming
- **Documentation**: Document complex logic and public APIs
- **Testing**: Include comprehensive tests for new functionality
- **Performance**: Consider performance implications, especially for mobile

### Server Code (Node.js)

#### Style Guidelines
```javascript
// Use modern JavaScript features
const createUser = async (userData) => {
  try {
    // Validate input
    const validatedData = await validateUserInput(userData);
    
    // Hash password securely
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);
    
    // Create user
    const user = await User.create({
      ...validatedData,
      password: hashedPassword
    });
    
    return user;
  } catch (error) {
    logger.error('User creation failed', { error: error.message, userData: { username: userData.username } });
    throw new Error('Failed to create user');
  }
};
```

#### Security Requirements
- Always validate and sanitize input
- Use parameterized queries for database operations
- Implement proper error handling without leaking sensitive information
- Log security events for monitoring

#### Testing Requirements
```javascript
describe('AuthService', () => {
  test('should hash passwords securely', async () => {
    const password = 'TestPassword123!';
    const hashedPassword = await authService.hashPassword(password);
    
    expect(hashedPassword).not.toBe(password);
    expect(hashedPassword.length).toBeGreaterThan(50);
    
    const isValid = await bcrypt.compare(password, hashedPassword);
    expect(isValid).toBe(true);
  });
});
```

### Mobile Code (Flutter/Dart)

#### Style Guidelines
```dart
// Use clear, descriptive names
class EventService extends ChangeNotifier {
  final AuthService _authService;
  final StorageService _storageService;
  List<Event> _events = [];
  
  EventService({
    required AuthService authService,
    required StorageService storageService,
  }) : _authService = authService,
       _storageService = storageService;
  
  /// Fetches events from server or local storage
  Future<List<Event>> getEvents({bool forceRefresh = false}) async {
    try {
      if (forceRefresh || _events.isEmpty) {
        await _fetchEventsFromServer();
      }
      return List.unmodifiable(_events);
    } catch (e) {
      _logger.error('Failed to fetch events', e);
      return _getEventsFromCache();
    }
  }
}
```

#### Widget Guidelines
```dart
class EventCard extends StatelessWidget {
  const EventCard({
    Key? key,
    required this.event,
    this.onTap,
  }) : super(key: key);
  
  final Event event;
  final VoidCallback? onTap;
  
  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(
          event.title,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        subtitle: Text(event.description),
        trailing: Icon(Icons.arrow_forward_ios),
        onTap: onTap,
      ),
    );
  }
}
```

### Documentation Standards

#### Code Comments
```dart
/// Manages Bluetooth Low Energy connections for mesh networking.
/// 
/// This service handles device discovery, connection establishment,
/// and message routing within the mesh network. It automatically
/// maintains connections to nearby devices and provides reliable
/// message delivery.
class BluetoothMeshService {
  /// Discovers nearby devices advertising the Conductor service.
  /// 
  /// Returns a list of [BluetoothDevice] objects representing
  /// discoverable peers. Devices must be running Conductor and
  /// be within Bluetooth range.
  /// 
  /// Throws [BluetoothException] if Bluetooth is disabled or
  /// if discovery fails due to permission issues.
  Future<List<BluetoothDevice>> discoverNearbyDevices() async {
    // Implementation
  }
}
```

#### API Documentation
```javascript
/**
 * Creates a new event
 * 
 * @route POST /api/events
 * @param {Object} eventData - Event information
 * @param {string} eventData.title - Event title (3-200 characters)
 * @param {string} eventData.description - Event description (optional)
 * @param {Object} eventData.location - Event location
 * @param {number} eventData.location.latitude - Latitude (-90 to 90)
 * @param {number} eventData.location.longitude - Longitude (-180 to 180)
 * @param {string} eventData.startTime - ISO 8601 datetime
 * @param {string} eventData.endTime - ISO 8601 datetime
 * @returns {Object} Created event object
 * @throws {ValidationError} When input data is invalid
 * @throws {AuthenticationError} When user is not authenticated
 * @example
 * 
 * POST /api/events
 * {
 *   "title": "Climate Action Rally",
 *   "description": "Peaceful demonstration for climate action",
 *   "location": {
 *     "latitude": 40.7589,
 *     "longitude": -73.9851,
 *     "address": "Times Square, NYC"
 *   },
 *   "startTime": "2024-03-15T15:00:00Z",
 *   "endTime": "2024-03-15T16:00:00Z"
 * }
 */
```

## Issue Guidelines

### Reporting Bugs

When reporting bugs, please include:

1. **Environment Information**
   - Operating system and version
   - Device model (for mobile issues)
   - App version
   - Node.js version (for server issues)

2. **Steps to Reproduce**
   - Clear, numbered steps
   - Expected behavior
   - Actual behavior
   - Screenshots if applicable

3. **Security Considerations**
   - For security issues, email security@conductor-project.org instead of creating public issues
   - Do not include sensitive information in bug reports

### Feature Requests

When requesting features:

1. **Problem Description**: Clearly describe the problem or need
2. **Proposed Solution**: Suggest how the feature might work
3. **Use Cases**: Provide specific scenarios where this would be useful
4. **Security Implications**: Consider privacy and security impacts
5. **Alternative Solutions**: Mention any alternative approaches

### Priority Labels

Issues are labeled by priority:

- **P0 - Critical**: Security vulnerabilities, data loss, app crashes
- **P1 - High**: Core functionality broken, major performance issues
- **P2 - Medium**: Important features, minor bugs, improvements
- **P3 - Low**: Nice to have features, cosmetic issues

## Security Guidelines

### Responsible Disclosure

If you discover security vulnerabilities:

1. **Do Not** create public issues for security vulnerabilities
2. **Email** security@conductor-project.org with details
3. **Wait** for response before public disclosure
4. **Allow** 90 days for fix implementation
5. **Coordinate** public disclosure timing

### Security Review Process

All security-related contributions undergo additional review:

- Code review by security-experienced maintainers
- Automated security scanning
- Manual security testing
- Documentation review for security implications

### Cryptographic Guidelines

When working with cryptography:

- Use well-established libraries (libsodium, Signal Protocol, etc.)
- Never implement cryptographic primitives from scratch
- Follow current best practices for key management
- Include comprehensive tests for cryptographic functions

## Community Guidelines

### Communication Channels

- **GitHub Issues**: Bug reports, feature requests, technical discussions
- **GitHub Discussions**: General questions, ideas, community chat
- **Matrix/Discord**: Real-time chat (links in README)
- **Mailing List**: Important announcements and security notices

### Getting Help

If you need help:

1. Search existing issues and documentation
2. Ask in GitHub Discussions for general questions
3. Create detailed issues for bugs or feature requests
4. Join community chat for real-time assistance

### Mentorship

New contributors can request mentorship:

- Comment on issues with "I'd like to work on this but need guidance"
- Maintainers will provide technical guidance and code review
- Pair programming sessions available for complex features
- Documentation contributions are a great way to start

## Recognition

Contributors are recognized through:

- **Contributors file**: All contributors listed in CONTRIBUTORS.md
- **Release notes**: Significant contributions highlighted in releases
- **Community showcase**: Outstanding contributions featured in project updates
- **Maintainer nomination**: Active contributors may be invited to become maintainers

## Legal Considerations

### License Agreement

By contributing, you agree that:

- Your contributions will be licensed under the project's MIT license
- You have the right to submit your contributions
- Your contributions don't violate any third-party rights

### Content Guidelines

All contributions must:

- Support peaceful, legal assembly and protest
- Respect privacy and civil liberties
- Comply with applicable laws and regulations
- Avoid content that could facilitate violence or illegal activities

## Questions?

If you have questions about contributing:

- Review this document and other project documentation
- Search existing GitHub issues and discussions
- Create a new discussion in the "Q&A" category
- Email the maintainers at maintainers@conductor-project.org

Thank you for contributing to Conductor and supporting democratic participation through technology!