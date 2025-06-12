const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '..', 'logs');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            ...meta
        };
        return JSON.stringify(logEntry) + '\n';
    }

    writeToFile(filename, content) {
        const filePath = path.join(this.logDir, filename);
        fs.appendFileSync(filePath, content);
    }

    info(message, meta = {}) {
        const logMessage = this.formatMessage('info', message, meta);
        console.log(`📝 ${message}`, meta);
        this.writeToFile('app.log', logMessage);
    }

    error(message, error = null, meta = {}) {
        const errorMeta = error ? {
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            ...meta
        } : meta;

        const logMessage = this.formatMessage('error', message, errorMeta);
        console.error(`❌ ${message}`, errorMeta);
        this.writeToFile('error.log', logMessage);
        this.writeToFile('app.log', logMessage);
    }

    warn(message, meta = {}) {
        const logMessage = this.formatMessage('warn', message, meta);
        console.warn(`⚠️  ${message}`, meta);
        this.writeToFile('app.log', logMessage);
    }

    debug(message, meta = {}) {
        if (process.env.NODE_ENV === 'development') {
            const logMessage = this.formatMessage('debug', message, meta);
            console.debug(`🐛 ${message}`, meta);
            this.writeToFile('debug.log', logMessage);
        }
    }

    auth(message, userId = null, meta = {}) {
        const authMeta = { userId, ...meta };
        const logMessage = this.formatMessage('auth', message, authMeta);
        console.log(`🔐 ${message}`, authMeta);
        this.writeToFile('auth.log', logMessage);
        this.writeToFile('app.log', logMessage);
    }

    api(method, path, statusCode, userId = null, duration = null, meta = {}) {
        const apiMeta = {
            method,
            path,
            statusCode,
            userId,
            duration: duration ? `${duration}ms` : null,
            ...meta
        };
        
        const message = `${method} ${path} - ${statusCode}`;
        const logMessage = this.formatMessage('api', message, apiMeta);
        
        if (statusCode >= 400) {
            console.warn(`🌐 ${message}`, apiMeta);
        } else {
            console.log(`🌐 ${message}`, apiMeta);
        }
        
        this.writeToFile('api.log', logMessage);
        this.writeToFile('app.log', logMessage);
    }

    security(message, severity = 'medium', meta = {}) {
        const securityMeta = { severity, ...meta };
        const logMessage = this.formatMessage('security', message, securityMeta);
        
        if (severity === 'high') {
            console.error(`🚨 SECURITY: ${message}`, securityMeta);
        } else {
            console.warn(`🔒 SECURITY: ${message}`, securityMeta);
        }
        
        this.writeToFile('security.log', logMessage);
        this.writeToFile('app.log', logMessage);
    }

    performance(operation, duration, meta = {}) {
        const perfMeta = { operation, duration: `${duration}ms`, ...meta };
        const message = `${operation} completed in ${duration}ms`;
        const logMessage = this.formatMessage('performance', message, perfMeta);
        
        if (duration > 1000) {
            console.warn(`⏱️  SLOW: ${message}`, perfMeta);
        } else {
            console.log(`⏱️  ${message}`, perfMeta);
        }
        
        this.writeToFile('performance.log', logMessage);
    }

    clearLogs() {
        const logFiles = ['app.log', 'error.log', 'auth.log', 'api.log', 'security.log', 'performance.log', 'debug.log'];
        logFiles.forEach(file => {
            const filePath = path.join(this.logDir, file);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });
        this.info('Log files cleared');
    }

    rotateLogs() {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const logFiles = ['app.log', 'error.log', 'auth.log', 'api.log', 'security.log'];
        
        logFiles.forEach(file => {
            const filePath = path.join(this.logDir, file);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size > maxSize) {
                    const timestamp = new Date().toISOString().split('T')[0];
                    const backupPath = path.join(this.logDir, `${file}.${timestamp}`);
                    fs.renameSync(filePath, backupPath);
                    this.info(`Rotated log file: ${file}`);
                }
            }
        });
    }
}

module.exports = new Logger();