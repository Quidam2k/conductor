const security = require('../utils/security');
const logger = require('../utils/logger');

// Input sanitization middleware
function sanitizeInputs(req, res, next) {
    const startTime = Date.now();
    
    try {
        // Sanitize request body
        if (req.body && typeof req.body === 'object') {
            req.body = sanitizeObject(req.body);
        }
        
        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
            req.query = sanitizeObject(req.query);
        }
        
        // Sanitize URL parameters
        if (req.params && typeof req.params === 'object') {
            req.params = sanitizeObject(req.params);
        }
        
        // Log sanitization time if it takes too long
        const duration = Date.now() - startTime;
        if (duration > 50) {
            logger.performance('Input sanitization', duration, {
                url: req.originalUrl,
                method: req.method
            });
        }
        
        next();
    } catch (error) {
        logger.error('Input sanitization failed', error, {
            url: req.originalUrl,
            method: req.method,
            body: req.body
        });
        
        res.status(400).json({
            error: {
                code: 'INVALID_INPUT',
                message: 'Request data could not be processed',
                timestamp: new Date().toISOString()
            }
        });
    }
}

function sanitizeObject(obj, depth = 0) {
    // Prevent deep recursion attacks
    if (depth > 10) {
        throw new Error('Object nesting too deep');
    }
    
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
        // Sanitize the key itself
        const cleanKey = security.sanitizeInput(key, 'general');
        
        if (value === null || value === undefined) {
            sanitized[cleanKey] = value;
        } else if (typeof value === 'string') {
            sanitized[cleanKey] = sanitizeStringValue(key, value);
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            sanitized[cleanKey] = value;
        } else if (Array.isArray(value)) {
            sanitized[cleanKey] = value.map(item => 
                typeof item === 'string' ? sanitizeStringValue(key, item) :
                typeof item === 'object' ? sanitizeObject(item, depth + 1) : 
                item
            );
        } else if (typeof value === 'object') {
            sanitized[cleanKey] = sanitizeObject(value, depth + 1);
        } else {
            // For other types, convert to string and sanitize
            sanitized[cleanKey] = security.sanitizeInput(String(value), 'general');
        }
    }
    
    return sanitized;
}

function sanitizeStringValue(key, value) {
    // Different sanitization rules based on field name
    const fieldType = getFieldType(key);
    return security.sanitizeInput(value, fieldType);
}

function getFieldType(fieldName) {
    const field = fieldName.toLowerCase();
    
    if (field.includes('username') || field === 'user') {
        return 'username';
    } else if (field.includes('email')) {
        return 'email';
    } else if (field.includes('password')) {
        return 'general'; // Don't over-sanitize passwords
    } else if (field.includes('html') || field.includes('content') || field.includes('description')) {
        return 'html';
    } else if (field.includes('sql') || field.includes('query')) {
        return 'sql';
    } else {
        return 'general';
    }
}

// Specific sanitization for different route types
function sanitizeAuthInputs(req, res, next) {
    if (req.body) {
        // Sanitize username specifically
        if (req.body.username) {
            req.body.username = security.sanitizeInput(req.body.username, 'username');
        }
        
        // Sanitize email if present
        if (req.body.email) {
            req.body.email = security.sanitizeInput(req.body.email, 'email');
        }
        
        // Don't sanitize password too aggressively - just basic safety
        if (req.body.password && typeof req.body.password === 'string') {
            // Remove null bytes and control characters but preserve other characters
            req.body.password = req.body.password.replace(/[\x00-\x1F\x7F]/g, '');
        }
        
        // Sanitize invite code
        if (req.body.inviteCode) {
            req.body.inviteCode = security.sanitizeInput(req.body.inviteCode, 'general');
        }
    }
    
    next();
}

function sanitizeEventInputs(req, res, next) {
    if (req.body) {
        // Sanitize event-specific fields
        if (req.body.title) {
            req.body.title = security.sanitizeInput(req.body.title, 'html');
        }
        
        if (req.body.description) {
            req.body.description = security.sanitizeInput(req.body.description, 'html');
        }
        
        // Sanitize location data
        if (req.body.location && typeof req.body.location === 'object') {
            if (req.body.location.address) {
                req.body.location.address = security.sanitizeInput(req.body.location.address, 'html');
            }
        }
        
        // Validate and sanitize coordinates
        if (req.body.location) {
            if (req.body.location.latitude !== undefined) {
                const lat = parseFloat(req.body.location.latitude);
                if (isNaN(lat) || lat < -90 || lat > 90) {
                    return res.status(400).json({
                        error: {
                            code: 'INVALID_INPUT',
                            message: 'Invalid latitude value'
                        }
                    });
                }
                req.body.location.latitude = lat;
            }
            
            if (req.body.location.longitude !== undefined) {
                const lng = parseFloat(req.body.location.longitude);
                if (isNaN(lng) || lng < -180 || lng > 180) {
                    return res.status(400).json({
                        error: {
                            code: 'INVALID_INPUT',
                            message: 'Invalid longitude value'
                        }
                    });
                }
                req.body.location.longitude = lng;
            }
        }
    }
    
    next();
}

// Detect and log suspicious input patterns
function detectSuspiciousInput(req, res, next) {
    const suspiciousPatterns = [
        // SQL injection patterns
        /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
        /(--|\/\*|\*\/|;|'|"|\b(or|and)\b.*=)/i,
        
        // XSS patterns
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /javascript:/i,
        /on\w+\s*=/i,
        
        // Path traversal
        /\.\.\//g,
        /\.\.\\/g,
        /\/etc\/passwd/i,
        /\/proc\//i,
        
        // Command injection
        /(\||;|&|`|\$\(|\${)/,
        /\b(curl|wget|nc|netcat|telnet|ssh)\b/i,
    ];
    
    const inputText = JSON.stringify(req.body) + JSON.stringify(req.query) + JSON.stringify(req.params);
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(inputText)) {
            logger.security('Suspicious input pattern detected', 'high', {
                pattern: pattern.toString(),
                url: req.originalUrl,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                body: req.body,
                query: req.query
            });
            
            // In production, you might want to block the request
            if (process.env.NODE_ENV === 'production') {
                return res.status(400).json({
                    error: {
                        code: 'INVALID_INPUT',
                        message: 'Request contains invalid data'
                    }
                });
            }
            break;
        }
    }
    
    next();
}

module.exports = {
    sanitizeInputs,
    sanitizeAuthInputs,
    sanitizeEventInputs,
    detectSuspiciousInput
};