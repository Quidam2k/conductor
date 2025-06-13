const logger = require('./logger');

class ErrorHandler {
    constructor() {
        this.errorCodes = {
            // Authentication errors
            'INVALID_CREDENTIALS': 'Invalid username or password',
            'INVALID_TOKEN': 'Invalid or expired authentication token',
            'TOKEN_EXPIRED': 'Authentication token has expired',
            'UNAUTHORIZED': 'Authentication required',
            'FORBIDDEN': 'Access denied',
            
            // Input validation errors
            'INVALID_INPUT': 'Invalid input data provided',
            'VALIDATION_ERROR': 'Data validation failed',
            'MISSING_REQUIRED_FIELD': 'Required field is missing',
            'INVALID_FORMAT': 'Data format is invalid',
            
            // Resource errors
            'NOT_FOUND': 'Requested resource not found',
            'ALREADY_EXISTS': 'Resource already exists',
            'CONFLICT': 'Operation conflicts with current state',
            
            // Server errors
            'SERVER_ERROR': 'Internal server error occurred',
            'DATABASE_ERROR': 'Database operation failed',
            'NETWORK_ERROR': 'Network operation failed',
            'SERVICE_UNAVAILABLE': 'Service temporarily unavailable',
            
            // Rate limiting
            'RATE_LIMITED': 'Too many requests, please try again later',
            'QUOTA_EXCEEDED': 'Request quota exceeded',
            
            // File/Upload errors
            'FILE_TOO_LARGE': 'File size exceeds maximum allowed',
            'INVALID_FILE_TYPE': 'File type not supported',
            'UPLOAD_FAILED': 'File upload failed'
        };
    }

    createError(code, message = null, statusCode = 500, details = null) {
        const error = new Error(message || this.errorCodes[code] || 'Unknown error');
        error.code = code;
        error.statusCode = statusCode;
        error.details = details;
        error.timestamp = new Date().toISOString();
        return error;
    }

    sanitizeError(error, req = null) {
        const isProduction = process.env.NODE_ENV === 'production';
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        // Base error response
        const errorResponse = {
            error: {
                code: error.code || 'SERVER_ERROR',
                message: this.getUserFriendlyMessage(error),
                timestamp: new Date().toISOString(),
                requestId: req?.headers['x-request-id'] || this.generateRequestId()
            }
        };

        // Add details only in development
        if (isDevelopment && error.details) {
            errorResponse.error.details = error.details;
        }

        // Never include stack traces or internal details in production
        if (isDevelopment && error.stack) {
            errorResponse.error.stack = error.stack;
        }

        // Log the full error internally
        this.logError(error, req);

        return errorResponse;
    }

    getUserFriendlyMessage(error) {
        // Map technical errors to user-friendly messages
        if (error.code && this.errorCodes[error.code]) {
            return this.errorCodes[error.code];
        }

        // Handle specific error types
        if (error.message) {
            const message = error.message.toLowerCase();
            
            // Database errors
            if (message.includes('unique constraint') || message.includes('duplicate')) {
                return 'This information is already in use';
            }
            
            if (message.includes('foreign key constraint')) {
                return 'Referenced data does not exist';
            }
            
            if (message.includes('not null constraint')) {
                return 'Required information is missing';
            }
            
            // Network/connection errors
            if (message.includes('econnrefused') || message.includes('connection')) {
                return 'Unable to connect to the service';
            }
            
            if (message.includes('timeout')) {
                return 'Request timed out, please try again';
            }
            
            // File system errors
            if (message.includes('enoent') || message.includes('file not found')) {
                return 'File not found';
            }
            
            if (message.includes('eacces') || message.includes('permission')) {
                return 'Permission denied';
            }
            
            // JSON/parsing errors
            if (message.includes('json') || message.includes('parse')) {
                return 'Invalid data format';
            }
        }

        // Default safe message
        return 'An error occurred while processing your request';
    }

    logError(error, req = null) {
        const errorInfo = {
            code: error.code,
            message: error.message,
            stack: error.stack,
            statusCode: error.statusCode,
            timestamp: error.timestamp
        };

        if (req) {
            errorInfo.request = {
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                userId: req.user?.id,
                body: this.sanitizeLogData(req.body),
                query: req.query,
                params: req.params
            };
        }

        // Log with appropriate level based on error type
        if (error.statusCode >= 500) {
            logger.error('Server error occurred', error, errorInfo);
        } else if (error.statusCode >= 400) {
            logger.warn('Client error occurred', errorInfo);
        } else {
            logger.info('Error handled', errorInfo);
        }
    }

    sanitizeLogData(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const sanitized = { ...data };
        
        // Remove sensitive fields from logs
        const sensitiveFields = [
            'password', 'token', 'secret', 'key', 'auth',
            'authorization', 'cookie', 'session'
        ];

        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }

        return sanitized;
    }

    generateRequestId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    // Handle specific error types
    handleDatabaseError(error, operation = 'database operation') {
        logger.error(`Database error during ${operation}`, error);
        
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return this.createError('ALREADY_EXISTS', 'This information is already in use', 409);
        }
        
        if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
            return this.createError('INVALID_INPUT', 'Referenced data does not exist', 400);
        }
        
        if (error.code === 'SQLITE_CONSTRAINT_NOTNULL') {
            return this.createError('MISSING_REQUIRED_FIELD', 'Required information is missing', 400);
        }
        
        // Generic database error
        return this.createError('DATABASE_ERROR', 'Database operation failed', 500);
    }

    handleAuthenticationError(error, type = 'authentication') {
        if (error.message && error.message.includes('invalid')) {
            return this.createError('INVALID_CREDENTIALS', null, 401);
        }
        
        if (error.message && error.message.includes('expired')) {
            return this.createError('TOKEN_EXPIRED', null, 401);
        }
        
        return this.createError('UNAUTHORIZED', 'Authentication failed', 401);
    }

    handleValidationError(errors) {
        if (Array.isArray(errors) && errors.length > 0) {
            return this.createError('VALIDATION_ERROR', errors[0], 400, { errors });
        }
        
        return this.createError('INVALID_INPUT', 'Invalid input data', 400);
    }

    // Express error handler middleware
    expressErrorHandler() {
        return (error, req, res, next) => {
            const sanitizedError = this.sanitizeError(error, req);
            const statusCode = error.statusCode || 500;
            
            res.status(statusCode).json(sanitizedError);
        };
    }

    // Async error wrapper for route handlers
    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }
}

module.exports = new ErrorHandler();