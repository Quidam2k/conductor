# Conductor Testing Strategy

## Testing Philosophy

Conductor's testing approach prioritizes **safety**, **reliability**, and **security** through comprehensive validation at every level. Given the critical nature of protest coordination, the testing strategy emphasizes real-world scenario validation and edge case handling.

## Testing Pyramid

```
┌─────────────────────────────────────────────────────────┐
│                End-to-End Tests                         │
│              Security & Field Tests                     │
├─────────────────────────────────────────────────────────┤
│              Integration Tests                          │
│           Service & API Integration                     │
├─────────────────────────────────────────────────────────┤
│                 Unit Tests                              │
│          Component & Function Tests                     │
└─────────────────────────────────────────────────────────┘
```

## Unit Testing

### Server Testing (Node.js/Jest)

#### Test Structure
```javascript
// tests/unit/services/AuthService.test.js
const AuthService = require('../../../src/services/AuthService');
const bcrypt = require('bcrypt');

describe('AuthService', () => {
  let authService;
  
  beforeEach(() => {
    authService = new AuthService();
  });
  
  describe('password validation', () => {
    test('should accept strong passwords', async () => {
      const password = 'StrongP@ssw0rd123';
      const result = await authService.validatePassword(password);
      expect(result.isValid).toBe(true);
    });
    
    test('should reject weak passwords', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'abc',
        'PASSWORD',
        'p@ssw0rd'
      ];
      
      for (const password of weakPasswords) {
        const result = await authService.validatePassword(password);
        expect(result.isValid).toBe(false);
      }
    });
  });
  
  describe('token generation', () => {
    test('should generate valid JWT tokens', async () => {
      const user = { id: 'user123', username: 'testuser', role: 'participant' };
      const token = await authService.generateToken(user);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = await authService.verifyToken(token);
      expect(decoded.id).toBe(user.id);
      expect(decoded.username).toBe(user.username);
    });
    
    test('should handle token expiration', async () => {
      const user = { id: 'user123', username: 'testuser', role: 'participant' };
      const token = await authService.generateToken(user, '1ms');
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await expect(authService.verifyToken(token)).rejects.toThrow('Token expired');
    });
  });
});
```

#### Coverage Requirements
- **Minimum Coverage**: 80% line coverage
- **Critical Paths**: 100% coverage for security functions
- **Edge Cases**: All error conditions must be tested

```javascript
// package.json test scripts
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration"
  },
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      },
      "src/services/AuthService.js": {
        "branches": 100,
        "functions": 100,
        "lines": 100,
        "statements": 100
      }
    }
  }
}
```

### Mobile Testing (Flutter/Dart)

#### Widget Testing
```dart
// test/widgets/event_card_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:conductor_client/widgets/event_card.dart';
import 'package:conductor_client/models/event.dart';

void main() {
  group('EventCard Widget', () {
    late Event testEvent;
    
    setUp(() {
      testEvent = Event(
        id: 'test-event-1',
        title: 'Test Event',
        description: 'Test Description',
        location: 'Test Location',
        startTime: DateTime.now().add(Duration(hours: 1)),
        endTime: DateTime.now().add(Duration(hours: 2)),
        creatorId: 'test-user',
      );
    });
    
    testWidgets('displays event information correctly', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EventCard(event: testEvent),
          ),
        ),
      );
      
      expect(find.text('Test Event'), findsOneWidget);
      expect(find.text('Test Description'), findsOneWidget);
      expect(find.text('Test Location'), findsOneWidget);
    });
    
    testWidgets('handles tap events', (WidgetTester tester) async {
      bool tapped = false;
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EventCard(
              event: testEvent,
              onTap: () => tapped = true,
            ),
          ),
        ),
      );
      
      await tester.tap(find.byType(EventCard));
      expect(tapped, isTrue);
    });
  });
}
```

#### Service Testing
```dart
// test/services/event_service_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:conductor_client/services/event_service.dart';
import 'package:conductor_client/services/auth_service.dart';

class MockAuthService extends Mock implements AuthService {}

void main() {
  group('EventService', () => {
    late EventService eventService;
    late MockAuthService mockAuthService;
    
    setUp(() {
      mockAuthService = MockAuthService();
      eventService = EventService(mockAuthService);
    });
    
    test('fetches events successfully', () async {
      when(mockAuthService.getServerUrl())
          .thenAnswer((_) async => 'http://test-server:3000');
      when(mockAuthService.getToken())
          .thenAnswer((_) async => 'valid-token');
      
      // Mock HTTP response
      final events = await eventService.getEvents();
      
      expect(events, isA<List<Event>>());
      verify(mockAuthService.getToken()).called(1);
    });
    
    test('handles network errors gracefully', () async {
      when(mockAuthService.getServerUrl())
          .thenAnswer((_) async => null);
      
      final events = await eventService.getEvents();
      
      expect(events, isEmpty);
    });
  });
}
```

## Integration Testing

### API Integration Tests
```javascript
// tests/integration/api.test.js
const request = require('supertest');
const app = require('../../src/app');
const { setupTestDatabase, cleanupTestDatabase } = require('../helpers/database');

describe('API Integration Tests', () => {
  let authToken;
  let testUser;
  
  beforeAll(async () => {
    await setupTestDatabase();
  });
  
  afterAll(async () => {
    await cleanupTestDatabase();
  });
  
  beforeEach(async () => {
    // Create test user and get auth token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        password: 'TestPassword123!',
        inviteCode: 'TEST_INVITE'
      });
    
    testUser = registerResponse.body.user;
    authToken = registerResponse.body.token;
  });
  
  describe('Event Management', () => {
    test('should create and retrieve events', async () => {
      const eventData = {
        title: 'Test Event',
        description: 'Integration test event',
        location: {
          address: 'Test Location',
          latitude: 40.7589,
          longitude: -73.9851
        },
        startTime: new Date(Date.now() + 3600000).toISOString(),
        endTime: new Date(Date.now() + 7200000).toISOString(),
        timeline: {
          duration: 600,
          actions: [
            {
              time: 0,
              type: 'gather',
              description: 'Participants arrive',
              roles: ['all']
            }
          ]
        }
      };
      
      // Create event
      const createResponse = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send(eventData);
      
      expect(createResponse.status).toBe(201);
      expect(createResponse.body.event.title).toBe(eventData.title);
      
      const eventId = createResponse.body.event.id;
      
      // Retrieve event
      const getResponse = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(getResponse.status).toBe(200);
      expect(getResponse.body.event.id).toBe(eventId);
      expect(getResponse.body.event.title).toBe(eventData.title);
    });
    
    test('should handle event participation', async () => {
      // Create event first
      const event = await createTestEvent(authToken);
      
      // Join event
      const joinResponse = await request(app)
        .post(`/api/events/${event.id}/join`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: 'participant' });
      
      expect(joinResponse.status).toBe(200);
      
      // Verify participation
      const eventResponse = await request(app)
        .get(`/api/events/${event.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      const participants = eventResponse.body.event.participants;
      expect(participants).toHaveLength(1);
      expect(participants[0].userId).toBe(testUser.id);
    });
  });
});
```

### Database Integration Tests
```javascript
// tests/integration/database.test.js
const Database = require('../../src/config/database');
const User = require('../../src/models/User');
const Event = require('../../src/models/Event');

describe('Database Integration', () => {
  let db;
  
  beforeAll(async () => {
    db = new Database(':memory:'); // Use in-memory database for tests
    await db.initialize();
  });
  
  afterAll(async () => {
    await db.close();
  });
  
  test('should maintain referential integrity', async () => {
    // Create user
    const user = await User.create({
      username: 'testuser',
      password: 'hashedpassword',
      role: 'participant'
    });
    
    // Create event
    const event = await Event.create({
      title: 'Test Event',
      description: 'Test Description',
      creatorId: user.id,
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000)
    });
    
    // Verify foreign key relationship
    const retrievedEvent = await Event.findById(event.id);
    expect(retrievedEvent.creatorId).toBe(user.id);
    
    // Test cascade deletion
    await User.delete(user.id);
    const orphanedEvent = await Event.findById(event.id);
    expect(orphanedEvent).toBeNull();
  });
});
```

## System Testing

### End-to-End Testing
```dart
// integration_test/app_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:conductor_client/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  
  group('End-to-End App Tests', () {
    testWidgets('complete user flow', (WidgetTester tester) async {
      app.main();
      await tester.pumpAndSettle();
      
      // Test server setup
      await tester.enterText(
        find.byKey(Key('server_url_field')),
        'http://localhost:3000'
      );
      await tester.tap(find.byKey(Key('connect_button')));
      await tester.pumpAndSettle();
      
      // Test login
      await tester.enterText(
        find.byKey(Key('username_field')),
        'testuser'
      );
      await tester.enterText(
        find.byKey(Key('password_field')),
        'testpassword'
      );
      await tester.tap(find.byKey(Key('login_button')));
      await tester.pumpAndSettle();
      
      // Verify navigation to event list
      expect(find.byKey(Key('event_list_screen')), findsOneWidget);
      
      // Test event creation
      await tester.tap(find.byKey(Key('create_event_fab')));
      await tester.pumpAndSettle();
      
      await tester.enterText(
        find.byKey(Key('event_title_field')),
        'Test Event'
      );
      await tester.enterText(
        find.byKey(Key('event_description_field')),
        'End-to-end test event'
      );
      
      await tester.tap(find.byKey(Key('save_event_button')));
      await tester.pumpAndSettle();
      
      // Verify event appears in list
      expect(find.text('Test Event'), findsOneWidget);
    });
  });
}
```

### Performance Testing
```javascript
// tests/performance/load_test.js
const autocannon = require('autocannon');
const app = require('../../src/app');

describe('Performance Tests', () => {
  let server;
  
  beforeAll(() => {
    server = app.listen(3001);
  });
  
  afterAll(() => {
    server.close();
  });
  
  test('API should handle concurrent requests', async () => {
    const result = await autocannon({
      url: 'http://localhost:3001/api/events',
      connections: 100,
      duration: 30,
      headers: {
        'Authorization': 'Bearer valid-test-token'
      }
    });
    
    expect(result.non2xx).toBe(0);
    expect(result.latency.average).toBeLessThan(100);
    expect(result.requests.average).toBeGreaterThan(1000);
  });
});
```

## Security Testing

### Vulnerability Testing
```javascript
// tests/security/vulnerability.test.js
const request = require('supertest');
const app = require('../../src/app');

describe('Security Vulnerability Tests', () => {
  test('should prevent SQL injection', async () => {
    const maliciousInput = "'; DROP TABLE users; --";
    
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: maliciousInput,
        password: 'password'
      });
    
    expect(response.status).toBe(401);
    
    // Verify database integrity
    const userCheck = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'Bearer valid-token');
    
    expect(userCheck.status).not.toBe(500);
  });
  
  test('should prevent XSS attacks', async () => {
    const xssPayload = '<script>alert("xss")</script>';
    
    const response = await request(app)
      .post('/api/events')
      .set('Authorization', 'Bearer valid-token')
      .send({
        title: xssPayload,
        description: 'Test event',
        location: { address: 'Test Location', latitude: 0, longitude: 0 },
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString()
      });
    
    expect(response.status).toBe(201);
    expect(response.body.event.title).not.toContain('<script>');
  });
  
  test('should enforce rate limiting', async () => {
    const promises = [];
    
    // Send 20 rapid requests
    for (let i = 0; i < 20; i++) {
      promises.push(
        request(app)
          .post('/api/auth/login')
          .send({ username: 'test', password: 'test' })
      );
    }
    
    const responses = await Promise.all(promises);
    const rateLimited = responses.filter(r => r.status === 429);
    
    expect(rateLimited.length).toBeGreaterThan(0);
  });
  
  test('should validate JWT tokens properly', async () => {
    const invalidTokens = [
      'invalid.token.here',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
      '',
      null,
      undefined
    ];
    
    for (const token of invalidTokens) {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', token ? `Bearer ${token}` : '');
      
      expect(response.status).toBe(401);
    }
  });
});
```

### Penetration Testing Scripts
```bash
#!/bin/bash
# tests/security/pentest.sh

echo "Running automated penetration tests..."

# OWASP ZAP baseline scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:3000 \
  -J zap-report.json

# Nikto web vulnerability scanner
nikto -h http://localhost:3000 -o nikto-report.txt

# SSL/TLS testing
testssl.sh --jsonfile=ssl-report.json localhost:3000

# Directory traversal testing
curl -i "http://localhost:3000/api/../../../etc/passwd"
curl -i "http://localhost:3000/api/events/../admin"

echo "Penetration testing complete. Check reports for vulnerabilities."
```

## Field Testing

### Real-World Scenario Testing
```dart
// test/field_tests/scenario_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:conductor_client/services/bluetooth_service.dart';
import 'package:conductor_client/services/sync_service.dart';

void main() {
  group('Field Test Scenarios', () {
    test('high-density environment simulation', () async {
      // Simulate 100+ devices in close proximity
      final bluetoothService = BluetoothService();
      final devices = <String>[];
      
      // Create mock devices
      for (int i = 0; i < 100; i++) {
        devices.add('device_$i');
      }
      
      // Test device discovery performance
      final startTime = DateTime.now();
      await bluetoothService.discoverDevices(devices);
      final discoveryTime = DateTime.now().difference(startTime);
      
      expect(discoveryTime.inSeconds).toBeLessThan(30);
      expect(bluetoothService.connectedDevices.length).toBeGreaterThan(50);
    });
    
    test('poor network conditions simulation', () async {
      final syncService = SyncService();
      
      // Simulate intermittent connectivity
      await syncService.simulateNetworkConditions(
        latency: Duration(milliseconds: 2000),
        packetLoss: 0.3,
        bandwidth: 64 // kbps
      );
      
      final events = await syncService.synchronizeEvents();
      
      // Should still function with degraded performance
      expect(events).isNotNull;
      expect(syncService.syncStatus).toBe(SyncStatus.degraded);
    });
    
    test('battery optimization under load', () async {
      final batteryMonitor = BatteryMonitor();
      
      await batteryMonitor.startMonitoring();
      
      // Simulate 4-hour event participation
      await simulateEventParticipation(
        duration: Duration(hours: 4),
        activities: [
          'bluetooth_scanning',
          'mesh_networking',
          'screen_display',
          'location_tracking'
        ]
      );
      
      final batteryUsage = await batteryMonitor.getBatteryUsage();
      
      // Should not drain more than 60% battery
      expect(batteryUsage.percentageUsed).toBeLessThan(60);
    });
  });
}
```

### Multi-Device Testing
```yaml
# .github/workflows/device-testing.yml
name: Multi-Device Testing

on: [push, pull_request]

jobs:
  android-testing:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        api-level: [21, 23, 26, 29, 30]
        arch: [x86, x86_64]
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Android SDK
        uses: android-actions/setup-android@v2
        
      - name: Run Android Emulator
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: ${{ matrix.api-level }}
          arch: ${{ matrix.arch }}
          script: |
            flutter drive --target=integration_test/app_test.dart
            
  ios-testing:
    runs-on: macos-latest
    strategy:
      matrix:
        device: ['iPhone 8', 'iPhone 12', 'iPad Air']
        
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup iOS Simulator
        run: |
          xcrun simctl create test-device "${{ matrix.device }}" 
          xcrun simctl boot test-device
          
      - name: Run Flutter Tests
        run: flutter drive --target=integration_test/app_test.dart
```

## Continuous Testing

### Automated Test Pipeline
```yaml
# .github/workflows/testing.yml
name: Comprehensive Testing

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run unit tests
        run: npm run test:coverage
        
      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          file: ./coverage/lcov.info
          
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
          
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup test database
        run: |
          npm run db:setup:test
          npm run db:migrate:test
          
      - name: Run integration tests
        run: npm run test:integration
        
  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Run security scan
        uses: securecodewarrior/github-action-add-sarif@v1
        with:
          sarif-file: security-scan-results.sarif
          
      - name: Run dependency check
        run: npm audit --audit-level moderate
        
  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Start application
        run: |
          npm start &
          sleep 10
          
      - name: Run load tests
        run: npm run test:performance
        
      - name: Analyze results
        run: |
          if [ $(cat performance-results.json | jq '.latency.average') -gt 100 ]; then
            echo "Performance regression detected"
            exit 1
          fi
```

### Test Data Management
```javascript
// tests/helpers/fixtures.js
class TestDataManager {
  static async createTestUser(overrides = {}) {
    const defaultUser = {
      username: `testuser_${Date.now()}`,
      password: 'TestPassword123!',
      role: 'participant',
      ...overrides
    };
    
    return await User.create(defaultUser);
  }
  
  static async createTestEvent(creatorId, overrides = {}) {
    const defaultEvent = {
      title: `Test Event ${Date.now()}`,
      description: 'Automated test event',
      location: {
        address: 'Test Location',
        latitude: 40.7589,
        longitude: -73.9851
      },
      startTime: new Date(Date.now() + 3600000),
      endTime: new Date(Date.now() + 7200000),
      creatorId,
      timeline: {
        duration: 600,
        actions: [
          {
            time: 0,
            type: 'gather',
            description: 'Test action',
            roles: ['all']
          }
        ]
      },
      ...overrides
    };
    
    return await Event.create(defaultEvent);
  }
  
  static async cleanupTestData() {
    await Event.deleteMany({ title: { $regex: /^Test Event/ } });
    await User.deleteMany({ username: { $regex: /^testuser_/ } });
  }
}
```

## Test Environment Management

### Environment Configuration
```javascript
// config/test.js
module.exports = {
  database: {
    type: 'sqlite',
    database: ':memory:',
    synchronize: true,
    logging: false
  },
  
  server: {
    port: 0, // Random available port
    host: 'localhost'
  },
  
  security: {
    jwtSecret: 'test-secret-key',
    bcryptRounds: 1 // Faster for tests
  },
  
  bluetooth: {
    mockMode: true,
    simulatedDevices: 10
  },
  
  features: {
    enableLogging: false,
    enableAnalytics: false,
    enableRealTimeSync: false
  }
};
```

### Test Doubles and Mocks
```dart
// test/mocks/mock_services.dart
import 'package:mockito/annotations.dart';
import 'package:conductor_client/services/auth_service.dart';
import 'package:conductor_client/services/bluetooth_service.dart';
import 'package:conductor_client/services/location_service.dart';

@GenerateMocks([
  AuthService,
  BluetoothService,
  LocationService,
])
void main() {}

// Generated mocks will be in mock_services.mocks.dart
```

## Quality Gates

### Definition of Done Checklist
- [ ] All unit tests pass with >80% coverage
- [ ] Integration tests pass for all API endpoints
- [ ] Security scan shows no high/critical vulnerabilities
- [ ] Performance tests meet latency requirements (<100ms API response)
- [ ] Manual testing completed on 3+ device types
- [ ] Documentation updated for new features
- [ ] Code review completed by 2+ developers
- [ ] Accessibility testing passed
- [ ] Cross-platform compatibility verified

### Release Testing Checklist
- [ ] Full regression test suite passes
- [ ] Security penetration testing completed
- [ ] Performance benchmarks meet targets
- [ ] Field testing with 10+ participants completed
- [ ] Multi-device compatibility verified
- [ ] Battery usage optimization validated
- [ ] Emergency protocols tested
- [ ] Data backup/recovery procedures verified
- [ ] User acceptance testing completed
- [ ] Legal compliance review passed

## Test Metrics and Reporting

### Key Metrics
```javascript
// Test metrics collection
const testMetrics = {
  coverage: {
    lines: 85.2,
    functions: 88.7,
    branches: 82.1,
    statements: 85.8
  },
  
  performance: {
    apiLatencyP95: 95, // milliseconds
    pageLoadTime: 1.2, // seconds
    batteryUsagePer4Hours: 45 // percentage
  },
  
  reliability: {
    testPassRate: 98.5, // percentage
    flakeRate: 1.2, // percentage
    meanTimeToRecovery: 15 // minutes
  },
  
  security: {
    vulnerabilities: {
      critical: 0,
      high: 0,
      medium: 2,
      low: 5
    },
    lastPenetrationTest: '2024-01-15'
  }
};
```

### Automated Reporting
```javascript
// scripts/generate-test-report.js
const generateTestReport = async () => {
  const report = {
    timestamp: new Date().toISOString(),
    buildNumber: process.env.BUILD_NUMBER,
    testResults: await collectTestResults(),
    coverage: await generateCoverageReport(),
    performance: await analyzePerformanceMetrics(),
    security: await getSecurityScanResults()
  };
  
  await generateHTMLReport(report);
  await sendSlackNotification(report);
  await updateDashboard(report);
};
```

This comprehensive testing strategy ensures that Conductor maintains high quality, security, and reliability standards throughout development and deployment, with special attention to the unique requirements of protest coordination software.
  