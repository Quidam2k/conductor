const crypto = require('crypto');
const logger = require('./logger');

class SecurityManager {
    constructor() {
        this.initializeSecurityChecks();
    }

    initializeSecurityChecks() {
        this.validateEnvironmentSecurity();
    }

    validateEnvironmentSecurity() {
        const errors = [];
        
        // Check JWT secret strength
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            errors.push('JWT_SECRET environment variable is required');
        } else if (jwtSecret.length < 32) {
            errors.push('JWT_SECRET must be at least 32 characters long');
        } else if (jwtSecret === 'default-secret-change-in-production' || 
                   jwtSecret === 'your-secure-secret-here-change-in-production' ||
                   jwtSecret.includes('change') || 
                   jwtSecret.includes('default')) {
            errors.push('JWT_SECRET appears to be using a default/placeholder value - this is a critical security risk');
        }

        // Check admin password strength
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword) {
            errors.push('ADMIN_PASSWORD environment variable is required');
        } else if (adminPassword.length < 8) {
            errors.push('ADMIN_PASSWORD must be at least 8 characters long');
        } else if (this.isWeakPassword(adminPassword)) {
            errors.push('ADMIN_PASSWORD is too weak - use a strong password with mixed case, numbers, and symbols');
        }

        // Check invite code security
        const inviteCode = process.env.INVITE_CODE;
        if (!inviteCode) {
            errors.push('INVITE_CODE environment variable is required');
        } else if (inviteCode.length < 6) {
            errors.push('INVITE_CODE should be at least 6 characters long');
        }

        // Log security warnings
        if (errors.length > 0) {
            if (process.env.NODE_ENV === 'production') {
                logger.security('CRITICAL: Production deployment with security vulnerabilities', 'high', {
                    errors,
                    action: 'Server startup blocked'
                });
                console.error('\n🚨 CRITICAL SECURITY ISSUES DETECTED:');
                errors.forEach(error => console.error(`   ❌ ${error}`));
                console.error('\n🛑 Server startup blocked for security reasons.');
                console.error('   Fix these issues before running in production.\n');
                process.exit(1);
            } else {
                logger.security('Security vulnerabilities detected in development', 'medium', { errors });
                console.warn('\n⚠️  SECURITY WARNINGS:');
                errors.forEach(error => console.warn(`   ⚠️  ${error}`));
                console.warn('   These issues must be fixed before production deployment.\n');
            }
        } else {
            logger.security('Security validation passed', 'low');
        }
    }

    isWeakPassword(password) {
        // Check for common weak patterns
        const weakPatterns = [
            /^(password|admin|test|123|conductor)/i,
            /^(.)\1{3,}$/, // Repeated characters
            /^(abc|123|qwerty)/i,
            /^[a-z]+$/, // Only lowercase
            /^[A-Z]+$/, // Only uppercase
            /^\d+$/, // Only numbers
        ];

        return weakPatterns.some(pattern => pattern.test(password)) ||
               password.length < 8 ||
               !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password);
    }

    generateSecureSecret(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    generateSecurePassword(length = 16) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        
        // Ensure at least one character from each required category
        password += this.getRandomChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ'); // Uppercase
        password += this.getRandomChar('abcdefghijklmnopqrstuvwxyz'); // Lowercase
        password += this.getRandomChar('0123456789'); // Number
        password += this.getRandomChar('!@#$%^&*'); // Symbol
        
        // Fill the rest randomly
        for (let i = password.length; i < length; i++) {
            password += this.getRandomChar(charset);
        }
        
        // Shuffle the password
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }

    getRandomChar(charset) {
        return charset.charAt(Math.floor(Math.random() * charset.length));
    }

    generateInviteCode(length = 12) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < length; i++) {
            code += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return code;
    }

    sanitizeInput(input, type = 'general') {
        if (typeof input !== 'string') {
            return input;
        }

        let sanitized = input.trim();

        switch (type) {
            case 'username':
                // Allow only alphanumeric and underscore
                sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, '');
                break;
            case 'email':
                // Basic email sanitization
                sanitized = sanitized.toLowerCase().replace(/[^\w@.-]/g, '');
                break;
            case 'html':
                // Escape HTML characters
                sanitized = sanitized
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;');
                break;
            case 'sql':
                // Basic SQL injection prevention
                sanitized = sanitized.replace(/['";\\]/g, '');
                break;
            default:
                // General sanitization - remove potentially dangerous characters
                sanitized = sanitized.replace(/[<>\"'&]/g, '');
        }

        return sanitized;
    }

    validateJWTSecret(secret) {
        if (!secret || typeof secret !== 'string') {
            return { valid: false, error: 'JWT secret is required' };
        }

        if (secret.length < 32) {
            return { valid: false, error: 'JWT secret must be at least 32 characters' };
        }

        const entropy = this.calculateEntropy(secret);
        if (entropy < 4.0) {
            return { valid: false, error: 'JWT secret has insufficient entropy (randomness)' };
        }

        if (this.isCommonSecret(secret)) {
            return { valid: false, error: 'JWT secret appears to be a common/default value' };
        }

        return { valid: true };
    }

    calculateEntropy(string) {
        const frequency = {};
        string.split('').forEach(char => {
            frequency[char] = (frequency[char] || 0) + 1;
        });

        const length = string.length;
        let entropy = 0;

        Object.values(frequency).forEach(count => {
            const probability = count / length;
            entropy -= probability * Math.log2(probability);
        });

        return entropy;
    }

    isCommonSecret(secret) {
        const commonSecrets = [
            'secret',
            'password',
            'admin',
            'test',
            'default',
            'change',
            'example',
            'conductor',
            'your-secure-secret',
            'jwt-secret',
            'super-secret',
        ];

        const lowerSecret = secret.toLowerCase();
        return commonSecrets.some(common => lowerSecret.includes(common));
    }

    logSecurityEvent(event, severity = 'medium', details = {}) {
        logger.security(event, severity, {
            timestamp: new Date().toISOString(),
            ...details
        });
    }

    // Rate limiting helper
    checkRateLimit(clientId, windowMs = 60000, maxRequests = 100) {
        // This would integrate with a proper rate limiting system
        // For now, just log the attempt
        this.logSecurityEvent('Rate limit check', 'low', { clientId, maxRequests });
        return { allowed: true, remaining: maxRequests };
    }
}

module.exports = new SecurityManager();