# Conductor Setup Guide

Complete setup instructions for the Conductor flash mob organization app.

## Quick Start

### Option 1: Manual Setup (Recommended for Development)

1. **Install Prerequisites**
   ```bash
   # Node.js 16+ required
   node --version  # Should be 16.0.0 or higher
   
   # Flutter 3.0+ required (for mobile client)
   flutter --version  # Should be 3.0.0 or higher
   ```

2. **Server Setup**
   ```bash
   cd conductor-server
   
   # Run interactive setup (recommended)
   npm run setup
   
   # Or copy environment template
   cp .env.example .env
   # Edit .env with your preferences
   
   # Install dependencies and start
   npm install
   npm start
   ```

3. **Client Setup** 
   ```bash
   cd conductor_client
   
   # Install dependencies
   flutter pub get
   
   # Run on device/emulator
   flutter run
   ```

### Option 2: Docker Setup (Recommended for Production)

1. **Using Docker Compose**
   ```bash
   # Start server with Docker
   docker-compose up -d
   
   # View logs
   docker-compose logs -f conductor-server
   
   # Stop
   docker-compose down
   ```

2. **Using Docker Build**
   ```bash
   # Build image
   docker build -t conductor-server .
   
   # Run container
   docker run -p 3000:3000 \
     -e ADMIN_PASSWORD=your-secure-password \
     -e JWT_SECRET=your-secure-secret \
     conductor-server
   ```

## Detailed Setup Instructions

### Server Configuration

The server can be configured using environment variables:

```bash
# Core Configuration
NODE_ENV=development          # development/production
PORT=3000                    # Server port
DB_PATH=./conductor.db       # SQLite database file

# Security
JWT_SECRET=your-secret-here  # JWT signing secret (32+ chars)
ADMIN_USERNAME=admin         # Default admin username
ADMIN_PASSWORD=secure-pass   # Default admin password
INVITE_CODE=conductor2024    # Registration invite code

# Optional
CORS_ORIGIN=http://localhost:3000  # Allowed CORS origins
LOG_LEVEL=info              # Logging level
RATE_LIMIT_MAX_REQUESTS=100 # Rate limiting
```

### Server Scripts

```bash
# Interactive setup wizard
npm run setup

# Start with automatic dependency installation
npm start

# Development mode with auto-reload
npm run dev

# View logs
npm run logs
npm run logs:error

# Test API endpoints
npm run test:api

# Clear logs
npm run logs:clear

# Health check
npm run healthcheck
```

### Flutter Client Setup

1. **Install Flutter SDK**
   - Follow instructions at: https://docs.flutter.dev/get-started/install
   - Ensure `flutter doctor` shows no critical issues

2. **Configure Development Environment**
   ```bash
   # For Android
   flutter doctor --android-licenses  # Accept licenses
   
   # For iOS (macOS only)
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -runFirstLaunch
   ```

3. **Install Dependencies**
   ```bash
   cd conductor_client
   flutter pub get
   ```

4. **Run Application**
   ```bash
   # List available devices
   flutter devices
   
   # Run on specific device
   flutter run -d <device-id>
   
   # Build for release
   flutter build apk  # Android
   flutter build ios  # iOS (macOS only)
   ```

## Network Configuration

### Local Development

- Server runs on `http://localhost:3000`
- QR code available at `http://localhost:3000/qr`
- API endpoints at `http://localhost:3000/api/*`

### Testing on Real Devices

1. **Find your computer's IP address:**
   ```bash
   # Windows
   ipconfig
   
   # macOS/Linux
   ifconfig
   ```

2. **Use IP address in mobile app:**
   - Instead of `localhost`, use your IP (e.g., `http://192.168.1.100:3000`)
   - Ensure firewall allows connections on port 3000

3. **Update CORS configuration:**
   ```bash
   # In .env file, add your IP to CORS_ORIGIN
   CORS_ORIGIN=http://localhost:3000,http://192.168.1.100:3000
   ```

## Testing the Setup

### Server Tests

```bash
# Run API test suite
cd conductor-server
npm run test:api

# Manual testing
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"conductor2024"}'
```

### Client Testing

1. **Server Connection Test:**
   - Launch mobile app
   - Go to server setup screen
   - Enter server URL: `http://YOUR-IP:3000`
   - Should show "Connected" status

2. **Authentication Test:**
   - Register new account with invite code: `conductor2024`
   - Or login with admin credentials: `admin` / `conductor2024`

3. **Basic Flow Test:**
   - Welcome → Server Setup → Login → Events List
   - All screens should load without errors

## Troubleshooting

### Common Server Issues

**Port already in use:**
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process or change PORT in .env
```

**Database errors:**
```bash
# Check database file permissions
ls -la conductor.db

# Delete and recreate database
rm conductor.db
npm start  # Will recreate with default admin user
```

**npm install failures:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Common Flutter Issues

**Flutter doctor issues:**
```bash
flutter doctor -v  # Detailed diagnostic info
flutter doctor --android-licenses  # Accept Android licenses
```

**Build failures:**
```bash
# Clean build cache
flutter clean
flutter pub get

# Clear Flutter cache
flutter pub cache repair
```

**Device connection issues:**
```bash
# Android: Enable USB debugging in Developer Options
# iOS: Trust computer when prompted

# List connected devices
flutter devices

# Restart ADB (Android)
adb kill-server
adb start-server
```

### Network Issues

**Can't connect from mobile device:**
1. Check firewall settings (allow port 3000)
2. Verify both devices on same network
3. Use IP address instead of localhost
4. Check CORS configuration in server

**QR code not loading:**
1. Ensure server is running
2. Visit `http://localhost:3000/qr` in browser
3. Check server logs for errors

## Production Deployment

### Security Checklist

- [ ] Change default admin password
- [ ] Use secure JWT secret (32+ random characters)
- [ ] Use custom invite code
- [ ] Enable HTTPS (use reverse proxy)
- [ ] Configure proper CORS origins
- [ ] Set up log rotation
- [ ] Regular database backups
- [ ] Monitor server logs

### Docker Production

```bash
# Create production environment file
cat > .env << EOF
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_PASSWORD=$(openssl rand -base64 12)
INVITE_CODE=your-custom-code
EOF

# Deploy with Docker Compose
docker-compose up -d

# Monitor
docker-compose logs -f
```

### Backup and Monitoring

```bash
# Backup database
cp conductor-server/conductor.db backup-$(date +%Y%m%d).db

# Monitor logs
tail -f conductor-server/logs/app.log

# Check disk space
df -h

# Monitor processes
top
```

## Getting Help

- **Setup Issues:** See [`HUMAN_HANDOFF.md`](./HUMAN_HANDOFF.md)
- **API Documentation:** See [`api_md.md`](./api_md.md)  
- **Architecture:** See [`architecture_md.md`](./architecture_md.md)
- **Server Logs:** `npm run logs` or check `logs/` directory
- **Health Check:** Visit `http://localhost:3000/api/health`

## Next Steps

Once basic setup is working:

1. **Test complete user flow** (registration → login → events)
2. **Test on multiple devices** to verify network setup
3. **Customize configuration** (passwords, codes, etc.)
4. **Set up production deployment** if needed
5. **Review security settings** for production use

The system is now ready for Phase 2 development (Bluetooth mesh networking) once basic functionality is confirmed working.