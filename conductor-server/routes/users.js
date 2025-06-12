const express = require('express');
const router = express.Router();

const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

// Get current user profile
router.get('/profile', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });
        }
        
        res.json({
            user: user.toJSON()
        });
        
    } catch (error) {
        res.status(500).json({
            error: {
                code: 'SERVER_ERROR',
                message: 'Failed to fetch profile'
            }
        });
    }
});

// Update user profile
router.put('/profile', authenticate, async (req, res) => {
    try {
        const { email, preferences } = req.body;
        
        const updates = {};
        if (email !== undefined) updates.email = email;
        
        // For now, we'll store preferences in a simple way
        // In a production system, you might want a separate preferences table
        if (preferences) {
            // Validate preferences structure
            const validPreferences = {};
            if (typeof preferences.notifications === 'boolean') {
                validPreferences.notifications = preferences.notifications;
            }
            if (typeof preferences.offlineMode === 'boolean') {
                validPreferences.offlineMode = preferences.offlineMode;
            }
            if (typeof preferences.language === 'string') {
                validPreferences.language = preferences.language;
            }
            
            // In a real implementation, you'd store this in the database
            // For now, we'll just acknowledge the update
        }
        
        const updatedUser = await req.user.updateProfile(updates);
        
        res.json({
            user: updatedUser.toJSON()
        });
        
    } catch (error) {
        res.status(400).json({
            error: {
                code: 'INVALID_INPUT',
                message: error.message
            }
        });
    }
});

module.exports = router;