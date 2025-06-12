# Conductor: Decentralized Protest Coordination App

> "Channeling your energy with minimal impedance"

Flash mob organization app for peaceful demonstrations and coordinated actions.

## Project Status

- [x] Add Collaborators to Project in GitHub
- [x] Create Task List in Readme in GitHub
- [ ] Add Project Checklist to Readme in Github

## Overview

Conductor is a decentralized flash mob protest coordination app enabling short, impactful, synchronized demonstrations. Users download events locally and follow precise timelines displayed on their device in airplane mode. The app prioritizes security, decentralization, and ease of use while providing powerful coordination features.

## Key Features

- **Brief, high-impact events** (5-10 minutes) designed for maximum visual impact
- **Fully offline operation** with Bluetooth mesh networking
- **Millisecond-accurate synchronization** for coordinated actions
- **Decentralized security** with no central servers
- **Quick dispersal protocols** to ensure participant safety

## Architecture

This project follows a progressive implementation approach:

1. **Phase 1**: Simple server-client architecture (current focus)
2. **Phase 2**: Bluetooth mesh networking and enhanced security
3. **Phase 3**: Synchronized actions and choreography tools
4. **Phase 4**: Multi-location coordination and advanced features

## Project Structure

```
conductor/
├── docs/                    # Comprehensive documentation
├── server/                  # Node.js server implementation
├── mobile/                  # Flutter mobile client
├── shared/                  # Shared protocols and specifications
├── tests/                   # Test suites and scenarios
├── scripts/                 # Build and deployment scripts
└── examples/                # Example configurations and events
```

## Step-by-Step Implementation Guide

### Phase 1: Basic Server Setup (Week 1)

#### Day 1-2: Environment Setup
1. **Prepare development environment:**
   - Install Node.js and npm (if not already installed)
   - Install VS Code or your preferred code editor
   - Install Git for version control

2. **Create project structure:**
   ```bash
   mkdir conductor-server
   cd conductor-server
   npm init -y
   ```

3. **Install basic dependencies:**
   ```bash
   npm install express cors body-parser
   ```

#### Day 3-4: Database Setup
1. **Install SQLite:**
   ```bash
   npm install sqlite3
   ```

2. **Create database module:**
   - Create a `db.js` file with basic initialization
   - Implement functions for:
     - Creating user table
     - Creating events table
     - Basic CRUD operations

3. **Test database operations:**
   - Write simple tests to verify database functions
   - Ensure tables are created correctly

#### Day 5-7: Basic API Implementation
1. **Create the server framework:**
   ```javascript
   // server.js
   const express = require('express');
   const cors = require('cors');
   const bodyParser = require('body-parser');
   const app = express();
   
   app.use(cors());
   app.use(bodyParser.json());
   
   app.get('/', (req, res) => {
     res.send('Conductor Server Running');
   });
   
   const PORT = process.env.PORT || 3000;
   app.listen(PORT, () => {
     console.log(`Server running on port ${PORT}`);
   });
   ```

2. **Add authentication endpoints:**
   - Implement `POST /auth/register` endpoint
   - Implement `POST /auth/login` endpoint
   - Add JWT token generation

3. **Add event management endpoints:**
   - Create `/events` endpoint for listing events
   - Create `/events/create` endpoint
   - Implement event retrieval by ID

### Phase 2: Server Enhancement (Week 2)

#### Day 1-2: Security Implementation
1. **Add password hashing:**
   ```bash
   npm install bcrypt
   ```
   - Implement password hashing in user registration
   - Add password verification in login process

2. **Enhance JWT implementation:**
   ```bash
   npm install jsonwebtoken
   ```
   - Add token verification middleware
   - Implement token refresh mechanism

#### Day 3-4: QR Code Generation
1. **Install QR code library:**
   ```bash
   npm install qrcode
   ```

2. **Create QR code generator:**
   - Implement function to generate server info QR code
   - Add endpoint to serve QR code as image
   - Create HTML page to display the QR code

#### Day 5-7: UPnP and External Access
1. **Implement port forwarding:**
   ```bash
   npm install nat-upnp
   ```
   - Add code to automatically find available port
   - Implement UPnP port forwarding
   - Add fallback for manual port forwarding

2. **Add server info display:**
   ```bash
   npm install ip
   ```
   - Show server IP and port on startup
   - Display connection instructions
   - Create web interface for server management

### Phase 3: Basic Client Setup (Week 3)

#### Day 1-2: Flutter Project Setup
1. **Install Flutter SDK** (if not already installed)

2. **Create Flutter project:**
   ```bash
   flutter create conductor_client
   cd conductor_client
   ```

3. **Add basic dependencies to pubspec.yaml:**
   ```yaml
   dependencies:
     flutter:
       sdk: flutter
     http: ^0.13.5
     flutter_secure_storage: ^8.0.0
     provider: ^6.0.5
   ```

#### Day 3-4: Client App Structure
1. **Create app architecture:**
   - Implement basic app structure with navigation
   - Create screens for:
     - Login
     - Registration
     - Events list
     - Event details

2. **Implement theme and styling:**
   - Create app theme with consistent colors
   - Add core UI components (buttons, cards, etc.)
   - Implement responsive layouts

#### Day 5-7: Authentication Implementation
1. **Create authentication service:**
   - Implement login functionality
   - Add registration
   - Store authentication token securely

2. **Add authentication UI:**
   - Create login screen with validation
   - Implement registration flow
   - Add authentication state management

### Phase 4: Client Enhancement (Week 4)

#### Day 1-2: Event Management
1. **Create event services:**
   - Implement event fetching
   - Add event creation functionality
   - Create data models for events

2. **Build event UI:**
   - Create event list screen
   - Implement event detail view
   - Add event creation form

#### Day 3-4: QR Code Scanning
1. **Add QR code scanner:**
   ```bash
   flutter pub add qr_code_scanner
   ```
   - Implement camera access for scanning
   - Create QR code scanning screen
   - Process server connection information

2. **Server connection flow:**
   - Add connection manager
   - Implement server URL validation
   - Store connection information locally

#### Day 5-7: Offline Functionality
1. **Implement local storage:**
   ```bash
   flutter pub add hive_flutter
   ```
   - Create local database for events
   - Implement offline event caching
   - Add background sync functionality

2. **Add connectivity management:**
   ```bash
   flutter pub add connectivity_plus
   ```
   - Detect online/offline status
   - Implement graceful offline handling
   - Add sync indicators

### Phase 5: Integration and Testing (Week 5)

#### Day 1-2: End-to-End Testing
1. **Test server-client communication:**
   - Verify authentication flow
   - Test event synchronization
   - Verify offline functionality

2. **Fix integration issues:**
   - Address API inconsistencies
   - Fix data synchronization issues
   - Ensure proper error handling

#### Day 3-4: UI Refinement
1. **Improve overall UX:**
   - Add loading indicators
   - Implement error messages
   - Enhance navigation experience

2. **Accessibility improvements:**
   - Add high contrast mode
   - Ensure screen reader compatibility
   - Implement large text support

#### Day 5-7: Basic Deployment
1. **Prepare for distribution:**
   - Create installation instructions
   - Document server setup process
   - Package Android APK for sharing

2. **Final testing:**
   - Test on multiple devices
   - Verify server installation process
   - Document any known issues

## Quick Start

1. **Set up the development environment**:
   ```bash
   # Install Node.js dependencies for server
   cd server && npm install
   
   # Install Flutter dependencies for mobile client
   cd mobile && flutter pub get
   ```

2. **Start the server**:
   ```bash
   cd server && npm start
   ```

3. **Run the mobile client**:
   ```bash
   cd mobile && flutter run
   ```

4. **Connect the client to server** using the QR code displayed by the server

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for detailed setup instructions.

## Next Steps After Phase 5
- Begin implementing Bluetooth mesh networking
- Add end-to-end encryption
- Enhance offline capabilities
- Develop synchronized action features

## Development Tips
1. **Focus on one feature at a time:** Complete each step before moving to the next.
2. **Test frequently:** Verify each component works before building on top of it.
3. **Use version control:** Commit changes regularly to track progress.
4. **Document as you go:** Add comments and documentation while the code is fresh.
5. **Start simple:** Basic functionality first, then enhance progressively.

## Security & Legal Notice

This application is designed for peaceful, legal assembly and coordination. It emphasizes:

- **Privacy protection** with minimal data collection
- **Decentralized architecture** to prevent single points of failure
- **Legal compliance** with assembly and protest rights
- **Safety protocols** for participant protection

Users are responsible for ensuring their activities comply with local laws and regulations.

## Contributing

1. Check [ROADMAP.md](./ROADMAP.md) for current development priorities
2. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines
3. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for technical specifications
4. Follow the Git workflow outlined in [DEVELOPMENT.md](./DEVELOPMENT.md)

## Documentation

- [Technical Roadmap](./ROADMAP.md) - Complete feature development plan
- [Implementation Guide](./IMPLEMENTATION.md) - Step-by-step setup instructions
- [Architecture Overview](./ARCHITECTURE.md) - System design and protocols
- [API Documentation](./API.md) - Server endpoints and data formats
- [Security Model](./SECURITY.md) - Threat model and mitigation strategies
- [Testing Strategy](./TESTING.md) - Quality assurance approach
- [Contributing Guidelines](./CONTRIBUTING.md) - How to contribute
- [Development Workflow](./DEVELOPMENT.md) - Development processes

## License

This project is open source and available under the [MIT License](./LICENSE).

## Status

**Current Phase**: Initial Implementation (Phase 1)
- ✅ Project structure and documentation
- 🔄 Basic server-client architecture
- ⏳ Mobile client foundation
- ⏳ Event creation and management
- ⏳ Basic synchronization

See [ROADMAP.md](./ROADMAP.md) for detailed progress tracking.

By following this step-by-step approach, you can build the Conductor app incrementally without feeling overwhelmed by the entire project scope.