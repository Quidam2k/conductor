require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const database = require('./config/database');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const userRoutes = require('./routes/users');
const networkUtils = require('./utils/network');
const qrGenerator = require('./utils/qr');
const User = require('./models/User');

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiting (basic implementation)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

app.use((req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requestCounts.has(clientIp)) {
        requestCounts.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    } else {
        const clientData = requestCounts.get(clientIp);
        if (now > clientData.resetTime) {
            clientData.count = 1;
            clientData.resetTime = now + RATE_LIMIT_WINDOW;
        } else {
            clientData.count++;
        }
        
        if (clientData.count > RATE_LIMIT_MAX_REQUESTS) {
            return res.status(429).json({
                error: {
                    code: 'RATE_LIMITED',
                    message: 'Too many requests, please try again later',
                    resetTime: clientData.resetTime
                }
            });
        }
    }
    
    // Add rate limit headers
    res.set({
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS,
        'X-RateLimit-Remaining': Math.max(0, RATE_LIMIT_MAX_REQUESTS - (requestCounts.get(clientIp)?.count || 0)),
        'X-RateLimit-Reset': Math.floor((requestCounts.get(clientIp)?.resetTime || now) / 1000)
    });
    
    next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);

// Serve QR code page
app.get('/qr', async (req, res) => {
    try {
        const serverInfo = await networkUtils.getServerInfo();
        const qrData = await qrGenerator.generateServerQR(serverInfo);
        const html = qrGenerator.generateQRHTML(qrData);
        res.send(html);
    } catch (error) {
        res.status(500).send('Error generating QR code');
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    const errorResponse = {
        error: {
            code: err.code || 'SERVER_ERROR',
            message: err.message || 'Internal server error',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
        }
    };
    
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json(errorResponse);
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: {
            code: 'NOT_FOUND',
            message: 'Endpoint not found',
            path: req.originalUrl
        }
    });
});

// Server initialization
async function startServer() {
    try {
        // Initialize database
        await database.connect();
        
        // Create admin user if it doesn't exist
        await User.createAdminUser();
        
        // Get available port and network info
        const serverInfo = await networkUtils.getServerInfo();
        const port = serverInfo.port;
        
        // Start server
        const server = app.listen(port, '0.0.0.0', () => {
            console.log('\n=================================');
            console.log('🎭 Conductor Server Started');
            console.log('=================================');
            console.log(`Server running on port: ${port}`);
            console.log(`Local URL: http://localhost:${port}`);
            
            if (serverInfo.localIP) {
                console.log(`Network URL: http://${serverInfo.localIP}:${port}`);
            }
            
            if (serverInfo.externalIP) {
                console.log(`External URL: http://${serverInfo.externalIP}:${port}`);
            }
            
            if (serverInfo.qrUrl) {
                console.log(`QR Code: ${serverInfo.qrUrl}/qr`);
                console.log('\n📱 Scan QR code with mobile app to connect');
            }
            
            console.log('=================================\n');
        });

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('Received SIGTERM, shutting down gracefully...');
            server.close(async () => {
                await database.close();
                process.exit(0);
            });
        });

        process.on('SIGINT', async () => {
            console.log('\nReceived SIGINT, shutting down gracefully...');
            server.close(async () => {
                await database.close();
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();