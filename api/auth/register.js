const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

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
        const { username, email, password } = req.body;
        
        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        // Check if user exists
        const existingUser = Array.from(users.values()).find(u => 
            u.username === username || u.email === email
        );
        
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Create user
        const hashedPassword = bcrypt.hashSync(password, 10);
        const newUser = {
            id: userIdCounter++,
            username,
            email,
            password_hash: hashedPassword,
            role: 'user',
            is_active: true,
            created_at: new Date().toISOString(),
            last_login: null
        };
        
        users.set(username, newUser);
        
        const token = jwt.sign(
            { userId: newUser.id, username, role: 'user' },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            message: 'User registered successfully',
            token: token,
            user: {
                id: newUser.id,
                username,
                email,
                role: 'user'
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
