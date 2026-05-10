const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const router = express.Router();

// Database setup
const db = new sqlite3.Database(':memory:');

// Initialize tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    )`);
    
    // Create default admin user
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, email, password_hash, role) 
            VALUES ('admin', 'admin@codeanalyzer.com', ?, 'admin')`, [adminPassword]);
});

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

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
        db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (row) {
                return res.status(400).json({ error: 'User already exists' });
            }
            
            // Create user
            const hashedPassword = bcrypt.hashSync(password, 10);
            db.run(`INSERT INTO users (username, email, password_hash) 
                    VALUES (?, ?, ?)`, [username, email, hashedPassword], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Error creating user' });
                }
                
                const token = jwt.sign(
                    { userId: this.lastID, username, role: 'user' },
                    process.env.JWT_SECRET || 'fallback_secret',
                    { expiresIn: '7d' }
                );
                
                res.status(201).json({
                    message: 'User registered successfully',
                    token: token,
                    user: {
                        id: this.lastID,
                        username,
                        email,
                        role: 'user'
                    }
                });
            });
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
        
        db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
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
            db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
            
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
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
