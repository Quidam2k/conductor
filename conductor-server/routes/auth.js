const express = require('express');
const router = express.Router();

const User = require('../models/User');
const authConfig = require('../config/auth');
const { authenticate } = require('../middleware/auth');
const { validateUser } = require('../middleware/validation');
const { sanitizeAuthInputs } = require('../middleware/sanitization');

// Register new user
router.post('/register', sanitizeAuthInputs, validateUser, async (req, res) => {
    try {
        const { username, password, email } = req.body;
        
        const user = await User.create({
            username,
            password,
            email,
            role: 'participant'
        });
        
        const token = authConfig.generateToken({ userId: user.id });
        
        res.status(201).json({
            user: user.toJSON(),
            token,
            expiresIn: '7d'
        });
        
    } catch (error) {
        if (error.message === 'Username already exists') {
            res.status(409).json({
                error: {
                    code: 'CONFLICT',
                    message: error.message
                }
            });
        } else {
            res.status(400).json({
                error: {
                    code: 'INVALID_INPUT',
                    message: error.message
                }
            });
        }
    }
});

// Login user
router.post('/login', sanitizeAuthInputs, validateUser, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await User.authenticate(username, password);
        
        if (!user) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid credentials'
                }
            });
        }
        
        const token = authConfig.generateToken({ userId: user.id });
        
        res.json({
            user: user.toJSON(),
            token,
            expiresIn: '7d'
        });
        
    } catch (error) {
        res.status(500).json({
            error: {
                code: 'SERVER_ERROR',
                message: 'Login failed'
            }
        });
    }
});

// Logout user
router.post('/logout', authenticate, async (req, res) => {
    // With JWT, logout is handled client-side by discarding the token
    // In a production system, you might want to maintain a blacklist
    res.json({
        message: 'Logged out successfully'
    });
});

// Refresh token
router.post('/refresh', authenticate, async (req, res) => {
    try {
        const token = authConfig.generateToken({ userId: req.user.id });
        
        res.json({
            token,
            expiresIn: '7d'
        });
        
    } catch (error) {
        res.status(500).json({
            error: {
                code: 'SERVER_ERROR',
                message: 'Token refresh failed'
            }
        });
    }
});

// Verify token (useful for client-side validation)
router.get('/verify', authenticate, async (req, res) => {
    res.json({
        valid: true,
        user: req.user.toJSON()
    });
});

module.exports = router;