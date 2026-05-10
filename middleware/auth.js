const jwt = require('jsonwebtoken');
const { db } = require('../database/init');

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Get user from database
const getUserFromDb = (userId) => {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT id, username, email, role, created_at, last_login FROM users WHERE id = ?',
            [userId],
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            }
        );
    });
};

// Update last login
const updateLastLogin = (userId) => {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [userId],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
};

module.exports = {
    authenticateToken,
    requireAdmin,
    getUserFromDb,
    updateLastLogin
};
