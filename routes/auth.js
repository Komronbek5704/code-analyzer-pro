const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/init');
const { getUserFromDb, updateLastLogin } = require('../middleware/auth');

const router = express.Router();

// Register endpoint
router.post('/register', [
    body('username').isLength({ min: 3, max: 50 }).trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { username, email, password } = req.body;

        // Check if user already exists
        db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], async (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (row) {
                return res.status(400).json({ error: 'Username or email already exists' });
            }

            // Hash password
            const saltRounds = 12;
            bcrypt.hash(password, saltRounds, (err, hash) => {
                if (err) {
                    return res.status(500).json({ error: 'Error hashing password' });
                }

                // Insert new user
                db.run(`
                    INSERT INTO users (username, email, password_hash, role)
                    VALUES (?, ?, ?, 'user')
                `, [username, email, hash], function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Error creating user' });
                    }

                    // Create user statistics entry
                    db.run(`
                        INSERT INTO user_statistics (user_id)
                        VALUES (?)
                    `, [this.lastID]);

                    // Generate JWT token
                    const token = jwt.sign(
                        { 
                            userId: this.lastID, 
                            username: username, 
                            role: 'user' 
                        },
                        process.env.JWT_SECRET,
                        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
                    );

                    res.status(201).json({
                        message: 'User registered successfully',
                        token: token,
                        user: {
                            id: this.lastID,
                            username: username,
                            email: email,
                            role: 'user'
                        }
                    });
                });
            });
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login endpoint
router.post('/login', [
    body('username').trim().escape(),
    body('password')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { username, password } = req.body;

        // Find user
        db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            if (!user.is_active) {
                return res.status(401).json({ error: 'Account is deactivated' });
            }

            // Compare password
            bcrypt.compare(password, user.password_hash, async (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Error comparing passwords' });
                }

                if (!result) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }

                // Update last login
                try {
                    await updateLastLogin(user.id);
                } catch (error) {
                    console.error('Error updating last login:', error);
                }

                // Generate JWT token
                const token = jwt.sign(
                    { 
                        userId: user.id, 
                        username: user.username, 
                        role: user.role 
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
                );

                res.json({
                    message: 'Login successful',
                    token: token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        role: user.role,
                        last_login: user.last_login
                    }
                });
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user info
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await getUserFromDb(decoded.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Change password
router.post('/change-password', [
    body('currentPassword'),
    body('newPassword').isLength({ min: 6 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { currentPassword, newPassword } = req.body;

        // Get user with password
        db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Verify current password
            bcrypt.compare(currentPassword, user.password_hash, (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Error comparing passwords' });
                }

                if (!result) {
                    return res.status(401).json({ error: 'Current password is incorrect' });
                }

                // Hash new password
                bcrypt.hash(newPassword, 12, (err, hash) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error hashing new password' });
                    }

                    // Update password
                    db.run(
                        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [hash, user.id],
                        (err) => {
                            if (err) {
                                return res.status(500).json({ error: 'Error updating password' });
                            }

                            res.json({ message: 'Password changed successfully' });
                        }
                    );
                });
            });
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
