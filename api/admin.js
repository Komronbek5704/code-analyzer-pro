const express = require('express');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

const router = express.Router();

// Database setup (same as auth.js)
const db = new sqlite3.Database(':memory:');

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
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

// Apply middleware to all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// Get dashboard statistics
router.get('/dashboard', (req, res) => {
    res.json({
        totalUsers: 47,
        activeUsers: 32,
        totalFiles: 156,
        totalAnalyses: 328,
        newUsersThisMonth: 12,
        analysesThisMonth: 89
    });
});

// Get users
router.get('/users', (req, res) => {
    const mockUsers = [
        {
            id: 1,
            username: 'user1',
            email: 'user1@example.com',
            role: 'user',
            is_active: true,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
            total_analyses: 15,
            total_errors: 3
        },
        {
            id: 2,
            username: 'user2',
            email: 'user2@example.com',
            role: 'user',
            is_active: true,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
            total_analyses: 8,
            total_errors: 1
        }
    ];
    
    res.json({
        users: mockUsers,
        pagination: {
            page: 1,
            totalPages: 1
        }
    });
});

// Get activities
router.get('/activities', (req, res) => {
    const mockActivities = [
        {
            username: 'user1',
            description: 'Analyzed test.py (Score: 85.0%)',
            created_at: new Date().toISOString()
        },
        {
            username: 'user2',
            description: 'Uploaded script.js',
            created_at: new Date(Date.now() - 3600000).toISOString()
        }
    ];
    
    res.json({
        activities: mockActivities,
        pagination: {
            page: 1,
            limit: 20
        }
    });
});

// Get statistics
router.get('/statistics', (req, res) => {
    res.json({
        newUsersThisMonth: 47,
        analysesThisMonth: 328,
        totalErrors: 156,
        totalWarnings: 892
    });
});

// Toggle user status
router.put('/users/:id/status', (req, res) => {
    const { is_active } = req.body;
    res.json({
        message: `User ${is_active ? 'activated' : 'deactivated'} successfully`
    });
});

// Delete user
router.delete('/users/:id', (req, res) => {
    res.json({
        message: 'User deleted successfully'
    });
});

module.exports = router;
