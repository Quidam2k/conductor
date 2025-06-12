function validateUser(req, res, next) {
    const { username, password, email, inviteCode } = req.body;
    
    if (!username || username.length < 3 || username.length > 50) {
        return res.status(400).json({
            error: {
                code: 'INVALID_INPUT',
                message: 'Username must be between 3 and 50 characters'
            }
        });
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({
            error: {
                code: 'INVALID_INPUT',
                message: 'Username can only contain letters, numbers, and underscores'
            }
        });
    }
    
    if (!password || password.length < 8) {
        return res.status(400).json({
            error: {
                code: 'INVALID_INPUT',
                message: 'Password must be at least 8 characters long'
            }
        });
    }
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
            error: {
                code: 'INVALID_INPUT',
                message: 'Invalid email format'
            }
        });
    }
    
    if (req.route.path === '/register' && inviteCode !== process.env.INVITE_CODE) {
        return res.status(403).json({
            error: {
                code: 'FORBIDDEN',
                message: 'Valid invite code required'
            }
        });
    }
    
    next();
}

function validateEvent(req, res, next) {
    const { title, description, location, startTime, endTime } = req.body;
    
    if (!title || title.length < 3 || title.length > 200) {
        return res.status(400).json({
            error: {
                code: 'INVALID_INPUT',
                message: 'Title must be between 3 and 200 characters'
            }
        });
    }
    
    if (description && description.length > 2000) {
        return res.status(400).json({
            error: {
                code: 'INVALID_INPUT',
                message: 'Description cannot exceed 2000 characters'
            }
        });
    }
    
    if (startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Invalid date format'
                }
            });
        }
        
        if (start >= end) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Start time must be before end time'
                }
            });
        }
        
        if (start < new Date()) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Start time cannot be in the past'
                }
            });
        }
    }
    
    if (location && typeof location === 'object') {
        if (location.latitude && (location.latitude < -90 || location.latitude > 90)) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Latitude must be between -90 and 90'
                }
            });
        }
        
        if (location.longitude && (location.longitude < -180 || location.longitude > 180)) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Longitude must be between -180 and 180'
                }
            });
        }
    }
    
    next();
}

module.exports = {
    validateUser,
    validateEvent
};