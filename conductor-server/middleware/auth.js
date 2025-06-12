const authConfig = require('../config/auth');
const User = require('../models/User');

async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authConfig.extractTokenFromHeader(authHeader);
        const decoded = authConfig.verifyToken(token);
        
        // Get user from database
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'User not found'
                }
            });
        }
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({
            error: {
                code: 'UNAUTHORIZED',
                message: error.message
            }
        });
    }
}

function authorize(roles = []) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                }
            });
        }
        
        if (roles.length > 0 && !roles.includes(req.user.role)) {
            return res.status(403).json({
                error: {
                    code: 'FORBIDDEN',
                    message: 'Insufficient permissions'
                }
            });
        }
        
        next();
    };
}

module.exports = {
    authenticate,
    authorize
};