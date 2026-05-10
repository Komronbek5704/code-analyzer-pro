const jwt = require('jsonwebtoken');

// Mock data for Vercel
const mockUsers = [
    {
        id: 2,
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
        id: 3,
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

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Apply authentication middleware
    authenticateToken(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        if (req.method === 'GET') {
            // Get users
            res.json({
                users: mockUsers,
                pagination: {
                    page: 1,
                    totalPages: 1
                }
            });
        } else if (req.method === 'PUT') {
            // Toggle user status
            const { is_active } = req.body;
            res.json({
                message: `User ${is_active ? 'activated' : 'deactivated'} successfully`
            });
        } else if (req.method === 'DELETE') {
            // Delete user
            res.json({
                message: 'User deleted successfully'
            });
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }
    });
};
