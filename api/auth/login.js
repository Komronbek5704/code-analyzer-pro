const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Simple in-memory storage
const users = new Map();
let userIdCounter = 1;

// Initialize default admin user
const adminPassword = bcrypt.hashSync('admin123', 10);
users.set('admin', {
    id: userIdCounter++,
    username: 'admin',
    email: 'admin@codeanalyzer.com',
    password_hash: adminPassword,
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
    last_login: null
});

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { username, password } = req.body;
        
        // Validation
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        const user = Array.from(users.values()).find(u => 
            u.username === username || u.email === username
        );
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        if (!user.is_active) {
            return res.status(401).json({ error: 'Account is deactivated' });
        }
        
        if (!bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Update last login
        user.last_login = new Date().toISOString();
        
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );
        
        res.json({
            message: 'Login successful',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
