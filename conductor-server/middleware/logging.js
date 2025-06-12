const logger = require('../utils/logger');

function apiLoggingMiddleware(req, res, next) {
    const startTime = Date.now();
    const originalSend = res.send;
    
    // Capture response
    res.send = function(data) {
        const duration = Date.now() - startTime;
        const userId = req.user ? req.user.id : null;
        
        // Log API call
        logger.api(
            req.method,
            req.originalUrl,
            res.statusCode,
            userId,
            duration,
            {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                contentLength: res.get('Content-Length')
            }
        );
        
        // Performance warning for slow requests
        if (duration > 2000) {
            logger.performance('Slow API request', duration, {
                method: req.method,
                url: req.originalUrl,
                userId
            });
        }
        
        originalSend.call(this, data);
    };
    
    next();
}

function securityLoggingMiddleware(req, res, next) {
    // Log authentication attempts
    if (req.path.includes('/auth/')) {
        logger.auth(`Authentication attempt: ${req.path}`, null, {
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    }
    
    // Log suspicious activity
    const suspiciousPatterns = [
        /admin/i,
        /\.\./, // Directory traversal
        /<script/i, // XSS attempts
        /union.*select/i, // SQL injection
        /etc\/passwd/i, // File inclusion
    ];
    
    const url = req.originalUrl.toLowerCase();
    const body = JSON.stringify(req.body).toLowerCase();
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(url) || pattern.test(body)) {
            logger.security(`Suspicious request detected: ${req.method} ${req.originalUrl}`, 'medium', {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                body: req.body
            });
            break;
        }
    }
    
    next();
}

function errorLoggingMiddleware(error, req, res, next) {
    const userId = req.user ? req.user.id : null;
    
    logger.error(`API Error: ${req.method} ${req.originalUrl}`, error, {
        userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.body,
        params: req.params,
        query: req.query
    });
    
    // Security alert for critical errors
    if (error.status === 401 || error.status === 403) {
        logger.security(`Authorization failure: ${error.message}`, 'medium', {
            userId,
            ip: req.ip,
            path: req.originalUrl
        });
    }
    
    next(error);
}

module.exports = {
    apiLoggingMiddleware,
    securityLoggingMiddleware,
    errorLoggingMiddleware
};