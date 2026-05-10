const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Simple in-memory storage for Vercel
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

// Validation middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'Validation failed', 
            details: errors.array() 
        });
    }
    next();
};

// Register endpoint
router.post('/register', [
    body('username').trim().isLength({ min: 3 }).escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
], handleValidationErrors, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login endpoint
router.post('/login', [
    body('username').trim().escape(),
    body('password')
], handleValidationErrors, async (req, res) => {
    try {
        const { username, password } = req.body;
        
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
