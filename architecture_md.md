# Conductor Architecture Overview

## System Design Philosophy

Conductor follows a **decentralized-first** architecture that prioritizes participant safety, data privacy, and operational resilience. The system is designed to function completely offline while providing sophisticated coordination capabilities.

## Architectural Principles

### 1. Progressive Decentralization
- **Phase 1**: Simple client-server for rapid prototyping
- **Phase 2**: Hybrid server + mesh networking
- **Phase 3**: Fully decentralized mesh with optional server support
- **Phase 4**: Serverless operation with distributed coordination

### 2. Security by Design
- **Zero Trust**: All communications encrypted end-to-end
- **Minimal Data**: Collect only what's absolutely necessary
- **Compartmentalization**: Limit blast radius of any compromise
- **Plausible Deniability**: Multiple legitimate use cases

### 3. Offline-First Operation
- **Local Storage**: All critical data stored locally
- **Eventual Consistency**: Graceful handling of network partitions
- **Conflict Resolution**: Automated merge strategies for concurrent edits
- **Graceful Degradation**: Core functionality works without network

## Phase 1: Client-Server Architecture

### System Overview
```
┌─────────────────┐    HTTP/HTTPS     ┌─────────────────┐
│                 │ ◄────────────────► │                 │
│  Mobile Client  │                   │   Server        │
│  (Flutter)      │                   │   (Node.js)     │
│                 │                   │                 │
└─────────────────┘                   └─────────────────┘
        │                                       │
        ▼                                       ▼
┌─────────────────┐                   ┌─────────────────┐
│ Local Storage   │                   │ SQLite Database │
│ (Hive + Secure) │                   │ + File System   │
└─────────────────┘                   └─────────────────┘
```

### Server Component (Node.js)

#### Core Services
```javascript
// Database Layer
├── models/
│   ├── User.js          // User account management
│   ├── Event.js         // Event definitions and metadata
│   ├── Session.js       // Active session tracking
│   └── Device.js        // Device registration and trust

// Business Logic Layer
├── services/
│   ├── AuthService.js   // Authentication and authorization
│   ├── EventService.js  // Event CRUD operations
│   ├── SyncService.js   // Data synchronization logic
│   └── NetworkService.js // Network discovery and setup

// API Layer
├── routes/
│   ├── auth.js          // /api/auth/*
│   ├── events.js        // /api/events/*
│   ├── users.js         // /api/users/*
│   └── sync.js          // /api/sync/*
```

#### Database Schema
```sql
-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'participant',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    public_key TEXT
);

-- Events table
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_time DATETIME,
    end_time DATETIME,
    creator_id TEXT,
    event_data JSON,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users (id)
);

-- Event participants
CREATE TABLE event_participants (
    event_id TEXT,
    user_id TEXT,
    role TEXT DEFAULT 'participant',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES events (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Device registration
CREATE TABLE devices (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    device_name TEXT,
    device_type TEXT,
    public_key TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    trusted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users (id)
);
```

### Mobile Client (Flutter)

#### Application Architecture
```
┌─────────────────────────────────────────────────────────┐
│                     Presentation Layer                 │
├─────────────────────────────────────────────────────────┤
│  Screens/          │  Widgets/        │  Themes/       │
│  - Onboarding      │  - EventCard     │  - AppTheme    │
│  - Authentication  │  - SyncIndicator │  - Colors      │
│  - Events          │  - MetronomeView │  - Typography  │
│  - Settings        │  - MapView       │                │
└─────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────┐
│                     Business Logic Layer               │
├─────────────────────────────────────────────────────────┤
│  Services/                    │  Models/               │
│  - AuthService               │  - User                │
│  - EventService              │  - Event               │
│  - StorageService            │  - SyncStatus          │
│  - SyncService               │  - Device              │
│  - BluetoothService (Phase 2) │  - NetworkInfo         │
└─────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────┐
│                     Data Layer                         │
├─────────────────────────────────────────────────────────┤
│  Local Storage/              │  Network/               │
│  - Hive (structured data)    │  - HTTP Client          │
│  - Secure Storage (keys)     │  - WebSocket (Phase 2)  │
│  - File System (events)      │  - Bluetooth (Phase 2)  │
└─────────────────────────────────────────────────────────┘
```

#### Key Services

**AuthService**: Manages authentication state and tokens
```dart
class AuthService extends ChangeNotifier {
  Future<bool> login(String username, String password);
  Future<void> logout();
  Future<String?> getToken();
  User? get currentUser;
  bool get isAuthenticated;
}
```

**EventService**: Handles event operations and caching
```dart
class EventService extends ChangeNotifier {
  Future<List<Event>> getEvents({bool forceRefresh = false});
  Future<Event?> createEvent(Event event);
  Future<Event?> updateEvent(Event event);
  Future<bool> deleteEvent(String eventId);
  Future<bool> joinEvent(String eventId);
}
```

**StorageService**: Manages local data persistence
```dart
class StorageService {
  Future<void> saveEvent(Event event);
  Future<Event?> getEvent(String eventId);
  Future<List<Event>> getAllEvents();
  Future<void> clearAllData();
  Future<void> secureDelete(String key);
}
```

## Phase 2: Mesh Networking Architecture

### Network Topology
```
    ┌─────────────┐         ┌─────────────┐
    │   Device A  │◄───────►│   Device B  │
    │             │         │             │
    └─────────────┘         └─────────────┘
           │                       │
           │                       │
           ▼                       ▼
    ┌─────────────┐         ┌─────────────┐
    │   Device C  │◄───────►│   Device D  │
    │             │         │             │
    └─────────────┘         └─────────────┘
           │                       │
           └───────────────────────┘
```

### Bluetooth Mesh Protocol Stack
```
┌─────────────────────────────────────────┐
│           Application Layer             │ ← Event coordination, messaging
├─────────────────────────────────────────┤
│            Routing Layer                │ ← Message forwarding, topology
├─────────────────────────────────────────┤
│            Network Layer                │ ← Device discovery, addressing
├─────────────────────────────────────────┤
│           Transport Layer               │ ← Reliable delivery, encryption
├─────────────────────────────────────────┤
│      Bluetooth Low Energy (BLE)        │ ← Physical communication
└─────────────────────────────────────────┘
```

### Message Types
```dart
enum MessageType {
  deviceDiscovery,    // Announce presence and capabilities
  eventBroadcast,     // Distribute event information
  syncRequest,        // Request data synchronization
  syncResponse,       // Respond with requested data
  coordination,       // Real-time coordination during events
  emergency,          // Emergency dispersal signals
}

class NetworkMessage {
  String id;
  MessageType type;
  String senderId;
  String? recipientId;  // null for broadcast
  Map<String, dynamic> payload;
  DateTime timestamp;
  int ttl;  // Time to live for forwarding
  String signature;  // Message authentication
}
```

## Phase 3: Synchronized Action Architecture

### Timing System
```
┌─────────────────────────────────────────────────────────┐
│                 Master Clock Service                   │
├─────────────────────────────────────────────────────────┤
│  NTP Sync  │  Local Crystal  │  Network Consensus      │
│  ±50ms     │  ±1ms          │  ±10ms                   │
└─────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────┐
│                Event Timeline Engine                    │
├─────────────────────────────────────────────────────────┤
│  Timeline     │  Action Queue   │  Sync Coordinator    │
│  Definition   │  Management     │  Network Time        │
└─────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────┐
│                 Metronome Display                       │
├─────────────────────────────────────────────────────────┤
│  Visual Cues  │  Audio Signals  │  Haptic Feedback     │
│  Screen Flash │  Tone/Beep      │  Vibration Pattern   │
└─────────────────────────────────────────────────────────┘
```

### Event Definition Format
```json
{
  "eventId": "event-123",
  "title": "Peaceful Assembly for Climate Action",
  "location": {
    "latitude": 40.7589,
    "longitude": -73.9851,
    "address": "Times Square, NYC",
    "boundaries": [
      {"lat": 40.7580, "lng": -73.9860},
      {"lat": 40.7598, "lng": -73.9842}
    ]
  },
  "timeline": {
    "startTime": "2024-03-15T15:00:00Z",
    "duration": 600,  // seconds
    "actions": [
      {
        "time": 0,
        "type": "gather",
        "description": "Participants arrive and position",
        "roles": ["all"]
      },
      {
        "time": 120,
        "type": "display",
        "description": "Raise signs simultaneously",
        "roles": ["sign-holders"],
        "synchronization": {
          "precision": "second",
          "cue": "visual"
        }
      },
      {
        "time": 180,
        "type": "chant",
        "description": "Coordinated chanting begins",
        "roles": ["chanters"],
        "audio": {
          "pattern": "call-response",
          "duration": 60
        }
      }
    ]
  },
  "roles": {
    "sign-holders": {
      "capacity": 50,
      "positions": "front-rows",
      "equipment": ["signs", "smartphones"]
    },
    "chanters": {
      "capacity": 200,
      "positions": "center-mass",
      "equipment": ["smartphones"]
    }
  },
  "safety": {
    "emergencyExits": [
      {"direction": "north", "description": "42nd Street"},
      {"direction": "south", "description": "Broadway"},
      {"direction": "east", "description": "7th Avenue"}
    ],
    "dispersalSignal": "emergency-tone-pattern",
    "maxDuration": 900,
    "weatherLimits": {
      "minTemp": -10,
      "maxTemp": 40,
      "maxWindSpeed": 25
    }
  }
}
```

## Phase 4: Multi-Location Architecture

### Global Coordination Network
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   City A    │    │   City B    │    │   City C    │
│   Mesh      │◄──►│   Mesh      │◄──►│   Mesh      │
│   Network   │    │   Network   │    │   Network   │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                ┌─────────────────┐
                │ Global Sync     │
                │ Coordination    │
                │ (Optional)      │
                └─────────────────┘
```

### Cross-Location Message Protocol
```dart
class GlobalMessage {
  String globalEventId;
  String originCity;
  List<String> targetCities;
  DateTime globalTimestamp;
  SyncAction action;
  Map<String, dynamic> locationSpecificData;
}

enum SyncAction {
  countdown,      // Global countdown synchronization
  start,          // Begin coordinated action
  update,         // Real-time status updates
  complete,       // Signal completion
  emergency       // Emergency coordination
}
```

## Security Architecture

### Encryption Layers
```
┌─────────────────────────────────────────────────────────┐
│                Application Layer Encryption             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │ Event Data  │ │ User Data   │ │ Messages    │      │
│  │ AES-256-GCM │ │ ChaCha20    │ │ Signal Proto│      │
│  └─────────────┘ └─────────────┘ └─────────────┘      │
└─────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────┐
│                Transport Layer Encryption               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │ TLS 1.3     │ │ Bluetooth   │ │ Noise       │      │
│  │ (HTTPS)     │ │ Security    │ │ Protocol    │      │
│  └─────────────┘ └─────────────┘ └─────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### Key Management
```dart
class CryptoManager {
  // Device identity keys
  late KeyPair deviceKeyPair;
  
  // Event-specific encryption
  Map<String, Uint8List> eventKeys = {};
  
  // Mesh network security
  late Uint8List meshNetworkKey;
  
  // Forward secrecy
  Map<String, KeyPair> ephemeralKeys = {};
  
  Future<void> initializeKeys();
  Future<void> rotateKeys();
  Future<void> secureDelete();
}
```

### Trust and Verification Model
```
┌─────────────────────────────────────────────────────────┐
│                Web of Trust Network                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │ Organizer   │───►│ Trusted     │───►│ Participant │ │
│  │ (Root)      │    │ Conductor   │    │             │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│         │                   │                   │       │
│         └───────────────────┼───────────────────┘       │
│                             │                           │
│                    ┌─────────────┐                     │
│                    │ Verification│                     │
│                    │ Network     │                     │
│                    └─────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

## Data Flow Architecture

### Synchronization Strategy
```
┌─────────────────────────────────────────────────────────┐
│                 Event Lifecycle                         │
├─────────────────────────────────────────────────────────┤
│  Create → Review → Approve → Distribute → Execute       │
│     │        │        │          │           │         │
│     ▼        ▼        ▼          ▼           ▼         │
│  Local   Conductor  Trusted   All Devices  Real-time   │
│  Draft   Review     Network   Download     Sync        │
└─────────────────────────────────────────────────────────┘
```

### Conflict Resolution
```dart
enum ConflictResolution {
  lastWriteWins,      // Simple timestamp-based
  organizer Trumps,    // Organizer changes override
  majorityRule,       // Democratic consensus
  manualReview        // Human intervention required
}

class SyncConflict {
  String eventId;
  String fieldName;
  dynamic localValue;
  dynamic remoteValue;
  DateTime localTimestamp;
  DateTime remoteTimestamp;
  String? organizerId;
  ConflictResolution strategy;
}
```

## Performance Architecture

### Scalability Targets
- **Participants**: 10,000+ simultaneous users per event
- **Events**: 1,000+ concurrent events globally
- **Latency**: <100ms synchronization accuracy
- **Battery**: 4+ hours continuous operation
- **Storage**: <50MB per device for 100 events

### Optimization Strategies
```dart
class PerformanceManager {
  // Battery optimization
  void enablePowerSavingMode();
  void optimizeBluetoothScanning();
  void reduceScreenBrightness();
  
  // Network optimization
  void prioritizeEssentialMessages();
  void compressDataPayloads();
  void batchNonCriticalUpdates();
  
  // Memory optimization
  void limitEventHistory();
  void cleanupExpiredData();
  void useMemoryEfficientStructures();
}
```

## Deployment Architecture

### Distribution Strategy
```
┌─────────────────────────────────────────────────────────┐
│                Installation Methods                     │
├─────────────────────────────────────────────────────────┤
│  QR Code     │  Bluetooth    │  USB Transfer │  Web     │
│  Scanning    │  APK Share    │  Sideload     │  Download│
└─────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────┐
│                Verification Chain                       │
├─────────────────────────────────────────────────────────┤
│  Code        │  Digital      │  Checksum     │  Trust   │
│  Signing     │  Signature    │  Verification │  Network │
└─────────────────────────────────────────────────────────┘
```

### Update Mechanism
```dart
class UpdateManager {
  // Check for updates via multiple channels
  Future<bool> checkForUpdates();
  
  // Verify update authenticity
  Future<bool> verifyUpdateSignature(UpdatePackage package);
  
  // Progressive update rollout
  Future<void> downloadAndInstall();
  
  // Rollback capability
  Future<void> rollbackToLastVersion();
}
```

## Monitoring and Analytics

### Privacy-Preserving Metrics
```dart
class PrivacyMetrics {
  // Performance metrics (no personal data)
  void recordBatteryUsage(Duration duration);
  void recordNetworkLatency(int milliseconds);
  void recordEventParticipation(int count); // aggregated only
  
  // Error tracking (sanitized)
  void recordError(String errorType, String? sanitizedContext);
  
  // Feature usage (anonymous)
  void recordFeatureUsage(String feature);
}
```

### Health Monitoring
```dart
class SystemHealth {
  // Network connectivity status
  ConnectionStatus get networkStatus;
  
  // Mesh network health
  MeshHealth get meshStatus;
  
  // Device resource usage
  ResourceUsage get resourceUsage;
  
  // Synchronization status
  SyncStatus get syncStatus;
}
```

## Extension Points

### Plugin Architecture
```dart
abstract class ConductorPlugin {
  String get name;
  String get version;
  List<Permission> get requiredPermissions;
  
  Future<void> initialize();
  Future<void> onEventStart(Event event);
  Future<void> onEventEnd(Event event);
  Future<void> onEmergency();
}

// Example plugins
class LightShowPlugin extends ConductorPlugin {
  // Coordinate phone screen displays
}

class SoundPlugin extends ConductorPlugin {
  // Manage audio cues and coordination
}

class LocationPlugin extends ConductorPlugin {
  // Handle position-specific instructions
}
```

This architecture provides a solid foundation for the Conductor app while maintaining flexibility for future enhancements and ensuring security, privacy, and performance requirements are met throughout all phases of development.