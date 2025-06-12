# Conductor API Documentation

## Overview

The Conductor API provides RESTful endpoints for client-server communication during Phase 1, with plans to extend to peer-to-peer protocols in later phases. All endpoints use JSON for request/response payloads and require authentication where specified.

## Base Configuration

- **Base URL**: `http://[server-ip]:[port]/api`
- **Content-Type**: `application/json`
- **Authentication**: Bearer token in Authorization header
- **Rate Limiting**: 100 requests per minute per client

## Authentication

### POST /auth/register
Create a new user account.

**Request Body:**
```json
{
  "username": "string (3-50 chars, alphanumeric + underscore)",
  "password": "string (8+ chars, mixed case + numbers + symbols)",
  "email": "string (optional, valid email)",
  "inviteCode": "string (required for registration)"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid",
    "username": "string",
    "role": "participant",
    "createdAt": "ISO 8601 datetime"
  },
  "token": "JWT token string"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input data
- `409 Conflict`: Username already exists
- `403 Forbidden`: Invalid invite code

### POST /auth/login
Authenticate existing user.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "username": "string",
    "role": "participant|organizer|admin",
    "lastLogin": "ISO 8601 datetime"
  },
  "token": "JWT token string",
  "expiresIn": "7d"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `429 Too Many Requests`: Rate limit exceeded

### POST /auth/logout
Invalidate current session.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

### POST /auth/refresh
Refresh authentication token.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "token": "new JWT token string",
  "expiresIn": "7d"
}
```

## User Management

### GET /users/profile
Get current user profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "username": "string",
    "role": "string",
    "email": "string",
    "createdAt": "ISO 8601 datetime",
    "lastLogin": "ISO 8601 datetime",
    "preferences": {
      "notifications": true,
      "offlineMode": false,
      "language": "en"
    }
  }
}
```

### PUT /users/profile
Update user profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "email": "string (optional)",
  "preferences": {
    "notifications": "boolean (optional)",
    "offlineMode": "boolean (optional)",
    "language": "string (optional)"
  }
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "username": "string",
    "role": "string",
    "email": "string",
    "preferences": {}
  }
}
```

## Event Management

### GET /events
List events for current user.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `status`: `draft|published|active|completed` (optional)
- `limit`: integer, default 50, max 100
- `offset`: integer, default 0
- `search`: string (optional, searches title and description)

**Response (200 OK):**
```json
{
  "events": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string",
      "location": {
        "address": "string",
        "latitude": "number",
        "longitude": "number"
      },
      "startTime": "ISO 8601 datetime",
      "endTime": "ISO 8601 datetime",
      "status": "string",
      "participantCount": "integer",
      "creatorId": "uuid",
      "createdAt": "ISO 8601 datetime",
      "updatedAt": "ISO 8601 datetime"
    }
  ],
  "total": "integer",
  "limit": "integer",
  "offset": "integer"
}
```

### GET /events/:id
Get detailed event information.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "event": {
    "id": "uuid",
    "title": "string",
    "description": "string",
    "location": {
      "address": "string",
      "latitude": "number",
      "longitude": "number",
      "boundaries": [
        {"lat": "number", "lng": "number"}
      ]
    },
    "startTime": "ISO 8601 datetime",
    "endTime": "ISO 8601 datetime",
    "timeline": {
      "duration": "integer (seconds)",
      "actions": [
        {
          "time": "integer (seconds from start)",
          "type": "string",
          "description": "string",
          "roles": ["string"],
          "synchronization": {
            "precision": "millisecond|second|manual",
            "cue": "visual|audio|haptic"
          }
        }
      ]
    },
    "roles": {
      "role-name": {
        "capacity": "integer",
        "positions": "string",
        "equipment": ["string"]
      }
    },
    "safety": {
      "emergencyExits": [
        {
          "direction": "string",
          "description": "string"
        }
      ],
      "dispersalSignal": "string",
      "maxDuration": "integer (seconds)",
      "weatherLimits": {}
    },
    "status": "string",
    "participantCount": "integer",
    "creatorId": "uuid",
    "participants": [
      {
        "userId": "uuid",
        "username": "string",
        "role": "string",
        "joinedAt": "ISO 8601 datetime"
      }
    ],
    "createdAt": "ISO 8601 datetime",
    "updatedAt": "ISO 8601 datetime"
  }
}
```

**Error Responses:**
- `404 Not Found`: Event does not exist
- `403 Forbidden`: User not authorized to view event

### POST /events
Create a new event.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "string (required, 3-200 chars)",
  "description": "string (optional, max 2000 chars)",
  "location": {
    "address": "string (required)",
    "latitude": "number (required, -90 to 90)",
    "longitude": "number (required, -180 to 180)",
    "boundaries": [
      {"lat": "number", "lng": "number"}
    ]
  },
  "startTime": "ISO 8601 datetime (required)",
  "endTime": "ISO 8601 datetime (required)",
  "timeline": {
    "duration": "integer (required, 60-3600 seconds)",
    "actions": [
      {
        "time": "integer (seconds from start)",
        "type": "string (required)",
        "description": "string (required)",
        "roles": ["string"],
        "synchronization": {
          "precision": "millisecond|second|manual",
          "cue": "visual|audio|haptic"
        }
      }
    ]
  },
  "roles": {
    "role-name": {
      "capacity": "integer",
      "positions": "string",
      "equipment": ["string"]
    }
  },
  "safety": {
    "emergencyExits": [
      {
        "direction": "string",
        "description": "string"
      }
    ],
    "dispersalSignal": "string",
    "maxDuration": "integer (seconds)",
    "weatherLimits": {}
  }
}
```

**Response (201 Created):**
```json
{
  "event": {
    "id": "uuid",
    "title": "string",
    "status": "draft",
    "createdAt": "ISO 8601 datetime",
    // ... full event object
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input data
- `403 Forbidden`: User not authorized to create events

### PUT /events/:id
Update existing event.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:** Same as POST /events (all fields optional)

**Response (200 OK):**
```json
{
  "event": {
    // ... updated event object
  }
}
```

**Error Responses:**
- `404 Not Found`: Event does not exist
- `403 Forbidden`: User not authorized to edit event
- `409 Conflict`: Event cannot be modified (e.g., already started)

### DELETE /events/:id
Delete an event.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Event deleted successfully"
}
```

**Error Responses:**
- `404 Not Found`: Event does not exist
- `403 Forbidden`: User not authorized to delete event
- `409 Conflict`: Event cannot be deleted (e.g., has participants)

### POST /events/:id/join
Join an event as a participant.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "role": "string (optional, defaults to 'participant')"
}
```

**Response (200 OK):**
```json
{
  "message": "Successfully joined event",
  "participant": {
    "userId": "uuid",
    "username": "string",
    "role": "string",
    "joinedAt": "ISO 8601 datetime"
  }
}
```

**Error Responses:**
- `404 Not Found`: Event does not exist
- `409 Conflict`: Already joined or event full

### DELETE /events/:id/leave
Leave an event.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Successfully left event"
}
```

## Device Management

### GET /devices
List registered devices for current user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "devices": [
    {
      "id": "uuid",
      "deviceName": "string",
      "deviceType": "android|ios|desktop",
      "lastSeen": "ISO 8601 datetime",
      "trusted": "boolean",
      "publicKey": "string (base64 encoded)"
    }
  ]
}
```

### POST /devices
Register a new device.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "deviceName": "string (required)",
  "deviceType": "android|ios|desktop (required)",
  "publicKey": "string (required, base64 encoded public key)"
}
```

**Response (201 Created):**
```json
{
  "device": {
    "id": "uuid",
    "deviceName": "string",
    "deviceType": "string",
    "trusted": false,
    "createdAt": "ISO 8601 datetime"
  }
}
```

### PUT /devices/:id/trust
Mark a device as trusted.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "device": {
    "id": "uuid",
    "trusted": true,
    "updatedAt": "ISO 8601 datetime"
  }
}
```

## Synchronization

### GET /sync/status
Get synchronization status.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "lastSync": "ISO 8601 datetime",
  "pendingChanges": "integer",
  "conflictCount": "integer",
  "networkStatus": "online|offline|limited"
}
```

### POST /sync/events
Synchronize event data.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "lastSyncTimestamp": "ISO 8601 datetime",
  "localChanges": [
    {
      "eventId": "uuid",
      "action": "create|update|delete",
      "data": {},
      "timestamp": "ISO 8601 datetime"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "serverChanges": [
    {
      "eventId": "uuid",
      "action": "create|update|delete",
      "data": {},
      "timestamp": "ISO 8601 datetime"
    }
  ],
  "conflicts": [
    {
      "eventId": "uuid",
      "field": "string",
      "localValue": "any",
      "serverValue": "any",
      "localTimestamp": "ISO 8601 datetime",
      "serverTimestamp": "ISO 8601 datetime"
    }
  ],
  "syncTimestamp": "ISO 8601 datetime"
}
```

## Real-time Communication (WebSocket)

### Connection
```
wss://[server-ip]:[port]/ws
```

**Authentication:**
Send JWT token as first message after connection.

### Message Format
```json
{
  "type": "string",
  "eventId": "uuid (optional)",
  "payload": {},
  "timestamp": "ISO 8601 datetime"
}
```

### Message Types

#### event-update
Real-time event updates.
```json
{
  "type": "event-update",
  "eventId": "uuid",
  "payload": {
    "field": "string",
    "oldValue": "any",
    "newValue": "any",
    "updatedBy": "uuid"
  }
}
```

#### participant-joined
User joined event.
```json
{
  "type": "participant-joined",
  "eventId": "uuid",
  "payload": {
    "userId": "uuid",
    "username": "string",
    "role": "string"
  }
}
```

#### coordination-signal
Real-time coordination during event.
```json
{
  "type": "coordination-signal",
  "eventId": "uuid",
  "payload": {
    "signal": "start|stop|emergency|custom",
    "data": {},
    "authorizedBy": "uuid"
  }
}
```

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {},
    "timestamp": "ISO 8601 datetime",
    "requestId": "uuid"
  }
}
```

### Common Error Codes
- `INVALID_INPUT`: Request validation failed
- `UNAUTHORIZED`: Authentication required or invalid
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource does not exist
- `CONFLICT`: Operation conflicts with current state
- `RATE_LIMITED`: Too many requests
- `SERVER_ERROR`: Internal server error

## Rate Limiting

All endpoints are subject to rate limiting:
- **Default**: 100 requests per minute per IP
- **Authentication**: 10 attempts per minute per IP
- **WebSocket**: 1000 messages per minute per connection

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## API Versioning

The API uses URL versioning:
- Current version: `/api/v1/`
- Future versions: `/api/v2/`, etc.

Version compatibility is maintained for at least 6 months after a new version is released.

## Security Considerations

1. **HTTPS Only**: All production traffic must use HTTPS
2. **Token Expiration**: JWT tokens expire after 7 days
3. **Input Validation**: All inputs are validated and sanitized
4. **SQL Injection Protection**: Parameterized queries only
5. **CORS**: Restricted to authorized origins
6. **Content Security Policy**: Strict CSP headers
7. **Rate Limiting**: Protection against abuse
8. **Audit Logging**: All API calls are logged for security monitoring

## Phase 2 Extensions

Future API extensions will include:

- **Mesh Networking**: Device-to-device communication protocols
- **Encryption**: End-to-end encrypted message passing
- **Offline Sync**: Conflict resolution and merge strategies
- **Multi-location**: Global coordination endpoints
- **Real-time**: WebRTC for direct peer communication

These extensions will maintain backward compatibility with Phase 1 implementations.