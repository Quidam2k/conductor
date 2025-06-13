class ResponseFormatter {
    constructor() {
        this.defaultMeta = {
            version: '1.0.0',
            timestamp: () => new Date().toISOString()
        };
    }

    // Success responses
    success(data, message = null, meta = {}) {
        return {
            success: true,
            data,
            message,
            meta: {
                ...this.defaultMeta,
                timestamp: this.defaultMeta.timestamp(),
                ...meta
            }
        };
    }

    // Created resource response
    created(data, message = 'Resource created successfully', meta = {}) {
        return {
            success: true,
            data,
            message,
            meta: {
                ...this.defaultMeta,
                timestamp: this.defaultMeta.timestamp(),
                ...meta
            }
        };
    }

    // Updated resource response
    updated(data, message = 'Resource updated successfully', meta = {}) {
        return {
            success: true,
            data,
            message,
            meta: {
                ...this.defaultMeta,
                timestamp: this.defaultMeta.timestamp(),
                ...meta
            }
        };
    }

    // Deleted resource response
    deleted(message = 'Resource deleted successfully', meta = {}) {
        return {
            success: true,
            data: null,
            message,
            meta: {
                ...this.defaultMeta,
                timestamp: this.defaultMeta.timestamp(),
                ...meta
            }
        };
    }

    // Paginated list response
    list(items, pagination = {}, meta = {}) {
        const {
            total = items.length,
            limit = 50,
            offset = 0,
            page = Math.floor(offset / limit) + 1,
            totalPages = Math.ceil(total / limit)
        } = pagination;

        return {
            success: true,
            data: items,
            pagination: {
                total,
                limit,
                offset,
                page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            meta: {
                ...this.defaultMeta,
                timestamp: this.defaultMeta.timestamp(),
                ...meta
            }
        };
    }

    // Authentication response
    auth(user, token, expiresIn = '7d', meta = {}) {
        return {
            success: true,
            data: {
                user: this.sanitizeUser(user),
                token,
                expiresIn
            },
            message: 'Authentication successful',
            meta: {
                ...this.defaultMeta,
                timestamp: this.defaultMeta.timestamp(),
                ...meta
            }
        };
    }

    // No content response (for operations that don't return data)
    noContent(message = 'Operation completed successfully') {
        return {
            success: true,
            data: null,
            message,
            meta: {
                ...this.defaultMeta,
                timestamp: this.defaultMeta.timestamp()
            }
        };
    }

    // Error responses (should use error handler, but included for completeness)
    error(code, message, statusCode = 500, details = null) {
        return {
            success: false,
            error: {
                code,
                message,
                details,
                timestamp: new Date().toISOString()
            }
        };
    }

    // Validation error response
    validationError(errors, message = 'Validation failed') {
        return {
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message,
                details: errors,
                timestamp: new Date().toISOString()
            }
        };
    }

    // Helper methods
    sanitizeUser(user) {
        if (!user) return null;
        
        // Remove sensitive fields
        const sanitized = { ...user };
        delete sanitized.passwordHash;
        delete sanitized.password;
        delete sanitized.password_hash;
        
        return sanitized;
    }

    sanitizeEvent(event) {
        if (!event) return null;
        
        // Ensure proper data structure
        return {
            ...event,
            participants: event.participants || []
        };
    }

    // Express middleware to add response methods
    middleware() {
        return (req, res, next) => {
            // Add success response methods to res object
            res.success = (data, message, meta) => {
                res.json(this.success(data, message, meta));
            };

            res.created = (data, message, meta) => {
                res.status(201).json(this.created(data, message, meta));
            };

            res.updated = (data, message, meta) => {
                res.json(this.updated(data, message, meta));
            };

            res.deleted = (message, meta) => {
                res.json(this.deleted(message, meta));
            };

            res.list = (items, pagination, meta) => {
                res.json(this.list(items, pagination, meta));
            };

            res.auth = (user, token, expiresIn, meta) => {
                res.json(this.auth(user, token, expiresIn, meta));
            };

            res.noContent = (message) => {
                res.status(204).json(this.noContent(message));
            };

            next();
        };
    }

    // Format event data for API responses
    formatEvent(event, includeParticipants = false) {
        if (!event) return null;

        const formatted = {
            id: event.id,
            title: event.title,
            description: event.description,
            location: event.location,
            startTime: event.startTime,
            endTime: event.endTime,
            status: event.status,
            participantCount: event.participantCount || 0,
            creatorId: event.creatorId,
            createdAt: event.createdAt,
            updatedAt: event.updatedAt
        };

        // Include timeline and detailed data if available
        if (event.eventData) {
            formatted.timeline = event.eventData.timeline;
            formatted.roles = event.eventData.roles;
            formatted.safety = event.eventData.safety;
        }

        // Include participants if requested
        if (includeParticipants && event.participants) {
            formatted.participants = event.participants.map(p => ({
                userId: p.userId,
                username: p.username,
                role: p.role,
                joinedAt: p.joinedAt
            }));
        }

        return formatted;
    }

    // Format user data for API responses
    formatUser(user) {
        if (!user) return null;

        return {
            id: user.id,
            username: user.username,
            role: user.role,
            email: user.email,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
        };
    }

    // Format device data for API responses
    formatDevice(device) {
        if (!device) return null;

        return {
            id: device.id,
            deviceName: device.deviceName,
            deviceType: device.deviceType,
            lastSeen: device.lastSeen,
            trusted: device.trusted
        };
    }
}

module.exports = new ResponseFormatter();