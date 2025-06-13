const { body, param, query, validationResult } = require('express-validator');
const responseFormatter = require('../utils/response_formatter');

class ValidationMiddleware {
    // User validation rules
    static userRegistrationRules() {
        return [
            body('username')
                .isLength({ min: 3, max: 30 })
                .withMessage('Username must be between 3 and 30 characters')
                .matches(/^[a-zA-Z0-9_-]+$/)
                .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
                .trim()
                .escape(),
            
            body('password')
                .isLength({ min: 8, max: 128 })
                .withMessage('Password must be between 8 and 128 characters')
                .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
                .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
            
            body('inviteCode')
                .isLength({ min: 6, max: 20 })
                .withMessage('Invite code must be between 6 and 20 characters')
                .matches(/^[a-zA-Z0-9]+$/)
                .withMessage('Invite code can only contain letters and numbers')
                .trim(),
            
            body('email')
                .optional({ nullable: true, checkFalsy: true })
                .isEmail()
                .withMessage('Please provide a valid email address')
                .isLength({ max: 254 })
                .withMessage('Email address is too long')
                .normalizeEmail()
        ];
    }

    static userLoginRules() {
        return [
            body('username')
                .notEmpty()
                .withMessage('Username is required')
                .trim()
                .escape(),
            
            body('password')
                .notEmpty()
                .withMessage('Password is required')
        ];
    }

    // Event validation rules
    static eventCreationRules() {
        return [
            body('title')
                .isLength({ min: 3, max: 100 })
                .withMessage('Event title must be between 3 and 100 characters')
                .matches(/^[\x20-\x7E]+$/)
                .withMessage('Event title contains invalid characters')
                .trim(),
            
            body('description')
                .optional({ nullable: true, checkFalsy: true })
                .isLength({ max: 1000 })
                .withMessage('Event description must be 1000 characters or less')
                .trim(),
            
            body('startTime')
                .optional({ nullable: true })
                .isISO8601()
                .withMessage('Start time must be a valid ISO date')
                .custom((value) => {
                    if (value && new Date(value) < new Date()) {
                        throw new Error('Start time cannot be in the past');
                    }
                    return true;
                }),
            
            body('endTime')
                .optional({ nullable: true })
                .isISO8601()
                .withMessage('End time must be a valid ISO date')
                .custom((value, { req }) => {
                    if (value && req.body.startTime) {
                        const startTime = new Date(req.body.startTime);
                        const endTime = new Date(value);
                        
                        if (endTime <= startTime) {
                            throw new Error('End time must be after start time');
                        }
                        
                        const duration = endTime - startTime;
                        const maxDuration = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
                        
                        if (duration > maxDuration) {
                            throw new Error('Event duration cannot exceed 30 days');
                        }
                    }
                    return true;
                }),
            
            body('location')
                .optional({ nullable: true })
                .isObject()
                .withMessage('Location must be an object')
                .custom((value) => {
                    if (value) {
                        if (value.latitude !== undefined && value.latitude !== null) {
                            if (typeof value.latitude !== 'number' || value.latitude < -90 || value.latitude > 90) {
                                throw new Error('Latitude must be a number between -90 and 90');
                            }
                        }
                        
                        if (value.longitude !== undefined && value.longitude !== null) {
                            if (typeof value.longitude !== 'number' || value.longitude < -180 || value.longitude > 180) {
                                throw new Error('Longitude must be a number between -180 and 180');
                            }
                        }
                        
                        if (value.address && typeof value.address !== 'string') {
                            throw new Error('Address must be a string');
                        }
                        
                        if (value.address && value.address.length > 500) {
                            throw new Error('Address must be 500 characters or less');
                        }
                    }
                    return true;
                })
        ];
    }

    static eventUpdateRules() {
        return [
            body('title')
                .optional()
                .isLength({ min: 3, max: 100 })
                .withMessage('Event title must be between 3 and 100 characters')
                .matches(/^[\x20-\x7E]+$/)
                .withMessage('Event title contains invalid characters')
                .trim(),
            
            body('description')
                .optional({ nullable: true, checkFalsy: true })
                .isLength({ max: 1000 })
                .withMessage('Event description must be 1000 characters or less')
                .trim(),
            
            body('status')
                .optional()
                .isIn(['draft', 'published', 'active', 'completed', 'cancelled'])
                .withMessage('Invalid event status'),
            
            body('startTime')
                .optional({ nullable: true })
                .isISO8601()
                .withMessage('Start time must be a valid ISO date'),
            
            body('endTime')
                .optional({ nullable: true })
                .isISO8601()
                .withMessage('End time must be a valid ISO date')
        ];
    }

    // Parameter validation
    static idParamRules(paramName = 'id') {
        return [
            param(paramName)
                .notEmpty()
                .withMessage(`${paramName} is required`)
                .isLength({ min: 1, max: 50 })
                .withMessage(`${paramName} must be between 1 and 50 characters`)
                .matches(/^[a-zA-Z0-9_-]+$/)
                .withMessage(`${paramName} contains invalid characters`)
        ];
    }

    // Query parameter validation
    static paginationRules() {
        return [
            query('limit')
                .optional()
                .isInt({ min: 1, max: 100 })
                .withMessage('Limit must be an integer between 1 and 100')
                .toInt(),
            
            query('offset')
                .optional()
                .isInt({ min: 0 })
                .withMessage('Offset must be a non-negative integer')
                .toInt(),
            
            query('page')
                .optional()
                .isInt({ min: 1 })
                .withMessage('Page must be a positive integer')
                .toInt()
        ];
    }

    static searchRules() {
        return [
            query('q')
                .optional()
                .isLength({ min: 1, max: 100 })
                .withMessage('Search query must be between 1 and 100 characters')
                .trim()
                .escape(),
            
            query('status')
                .optional()
                .isIn(['draft', 'published', 'active', 'completed', 'cancelled'])
                .withMessage('Invalid status filter'),
            
            query('sortBy')
                .optional()
                .isIn(['createdAt', 'updatedAt', 'startTime', 'title'])
                .withMessage('Invalid sort field'),
            
            query('sortOrder')
                .optional()
                .isIn(['asc', 'desc'])
                .withMessage('Sort order must be asc or desc')
        ];
    }

    // Role validation
    static roleValidationRules() {
        return [
            body('role')
                .optional()
                .isIn(['participant', 'organizer', 'coordinator', 'admin'])
                .withMessage('Invalid role specified')
        ];
    }

    // Custom validation for nested objects
    static timelineValidationRules() {
        return [
            body('timeline')
                .optional()
                .isObject()
                .withMessage('Timeline must be an object')
                .custom((timeline) => {
                    if (timeline && timeline.phases) {
                        if (!Array.isArray(timeline.phases)) {
                            throw new Error('Timeline phases must be an array');
                        }
                        
                        for (const phase of timeline.phases) {
                            if (!phase.name || typeof phase.name !== 'string' || phase.name.length > 100) {
                                throw new Error('Each phase must have a valid name (max 100 characters)');
                            }
                            
                            if (!phase.duration || typeof phase.duration !== 'number' || phase.duration <= 0) {
                                throw new Error('Each phase must have a positive duration');
                            }
                            
                            if (phase.description && (typeof phase.description !== 'string' || phase.description.length > 500)) {
                                throw new Error('Phase description must be a string (max 500 characters)');
                            }
                        }
                    }
                    return true;
                })
        ];
    }

    // Main validation handler
    static handleValidation(req, res, next) {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            const formattedErrors = {};
            errors.array().forEach(error => {
                if (!formattedErrors[error.path]) {
                    formattedErrors[error.path] = error.msg;
                }
            });
            
            return res.status(400).json(
                responseFormatter.validationError(formattedErrors, 'Validation failed')
            );
        }
        
        next();
    }

    // Security validation (additional checks)
    static securityValidation(req, res, next) {
        // Check for common injection patterns
        const bodyStr = JSON.stringify(req.body);
        const suspiciousPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /vbscript:/gi,
            /onload\s*=/gi,
            /onerror\s*=/gi,
            /eval\s*\(/gi,
            /function\s*\(/gi
        ];
        
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(bodyStr)) {
                return res.status(400).json(
                    responseFormatter.error('INVALID_INPUT', 'Request contains potentially malicious content', 400)
                );
            }
        }
        
        // Check for excessively long strings that might cause DoS
        for (const [key, value] of Object.entries(req.body)) {
            if (typeof value === 'string' && value.length > 10000) {
                return res.status(400).json(
                    responseFormatter.error('INVALID_INPUT', `Field '${key}' is too long`, 400)
                );
            }
        }
        
        next();
    }
}

// Legacy validation functions for backward compatibility
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
    validateEvent,
    ValidationMiddleware
};