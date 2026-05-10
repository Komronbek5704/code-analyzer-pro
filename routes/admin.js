const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply admin middleware to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// Get dashboard statistics
router.get('/dashboard', (req, res) => {
    const queries = [
        // Total users
        'SELECT COUNT(*) as total_users FROM users',
        // Active users (logged in last 30 days)
        'SELECT COUNT(*) as active_users FROM users WHERE last_login > datetime("now", "-30 days")',
        // Total files
        'SELECT COUNT(*) as total_files FROM files',
        // Total analyses
        'SELECT COUNT(*) as total_analyses FROM analysis_results',
        // Total lines analyzed
        'SELECT SUM(total_lines) as total_lines FROM analysis_results',
        // Average quality score
        'SELECT AVG(quality_score) as avg_quality_score FROM analysis_results',
        // New users this month
        'SELECT COUNT(*) as new_users_this_month FROM users WHERE created_at > datetime("now", "-30 days")',
        // Analyses this month
        'SELECT COUNT(*) as analyses_this_month FROM analysis_results WHERE analysis_date > datetime("now", "-30 days")'
    ];

    Promise.all(queries.map(query => 
        new Promise((resolve, reject) => {
            db.get(query, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        })
    ))
    .then(results => {
        const stats = {
            totalUsers: results[0].total_users,
            activeUsers: results[1].active_users,
            totalFiles: results[2].total_files,
            totalAnalyses: results[3].total_analyses,
            totalLines: results[4].total_lines || 0,
            avgQualityScore: results[5].avg_quality_score ? parseFloat(results[5].avg_quality_score).toFixed(2) : 0,
            newUsersThisMonth: results[6].new_users_this_month,
            analysesThisMonth: results[7].analyses_this_month
        };

        res.json(stats);
    })
    .catch(error => {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Error fetching dashboard statistics' });
    });
});

// Get all users with pagination
router.get('/users', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let whereClause = '';
    let params = [];

    if (search) {
        whereClause = 'WHERE u.username LIKE ? OR u.email LIKE ?';
        params = [`%${search}%`, `%${search}%`];
    }

    const query = `
        SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login, u.is_active,
               COALESCE(us.total_files, 0) as total_files,
               COALESCE(us.total_analyses, 0) as total_analyses,
               COALESCE(us.total_lines_analyzed, 0) as total_lines_analyzed,
               COALESCE(us.total_errors_found, 0) as total_errors_found,
               COALESCE(us.total_warnings_found, 0) as total_warnings_found,
               COALESCE(us.average_quality_score, 0) as average_quality_score,
               COUNT(*) OVER() as total_count
        FROM users u
        LEFT JOIN user_statistics us ON u.id = us.user_id
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.all(query, [...params, limit, offset], (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ error: 'Error fetching users' });
        }

        const totalCount = rows.length > 0 ? rows[0].total_count : 0;
        const users = rows.map(row => {
            const { total_count, ...user } = row;
            return user;
        });

        res.json({
            users,
            pagination: {
                page,
                limit,
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            }
        });
    });
});

// Get user details
router.get('/users/:id', (req, res) => {
    const userId = req.params.id;

    // Get user basic info
    db.get(`
        SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login, u.is_active,
               COALESCE(us.total_files, 0) as total_files,
               COALESCE(us.total_analyses, 0) as total_analyses,
               COALESCE(us.total_lines_analyzed, 0) as total_lines_analyzed,
               COALESCE(us.total_errors_found, 0) as total_errors_found,
               COALESCE(us.total_warnings_found, 0) as total_warnings_found,
               COALESCE(us.average_quality_score, 0) as average_quality_score,
               us.last_activity
        FROM users u
        LEFT JOIN user_statistics us ON u.id = us.user_id
        WHERE u.id = ?
    `, [userId], (err, user) => {
        if (err) {
            console.error('Error fetching user details:', err);
            return res.status(500).json({ error: 'Error fetching user details' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user's recent files
        db.all(`
            SELECT f.id, f.filename, f.original_name, f.file_type, f.file_size, f.upload_date,
                   ar.errors_count, ar.warnings_count, ar.quality_score
            FROM files f
            LEFT JOIN analysis_results ar ON f.id = ar.file_id
            WHERE f.user_id = ?
            ORDER BY f.upload_date DESC
            LIMIT 10
        `, [userId], (err, files) => {
            if (err) {
                console.error('Error fetching user files:', err);
                return res.status(500).json({ error: 'Error fetching user files' });
            }

            // Get user's recent analyses
            db.all(`
                SELECT ar.id, ar.analysis_date, ar.total_lines, ar.errors_count, 
                       ar.warnings_count, ar.quality_score, ar.processing_time,
                       f.filename, f.original_name
                FROM analysis_results ar
                JOIN files f ON ar.file_id = f.id
                WHERE ar.user_id = ?
                ORDER BY ar.analysis_date DESC
                LIMIT 10
            `, [userId], (err, analyses) => {
                if (err) {
                    console.error('Error fetching user analyses:', err);
                    return res.status(500).json({ error: 'Error fetching user analyses' });
                }

                res.json({
                    user,
                    files,
                    analyses
                });
            });
        });
    });
});

// Update user role
router.put('/users/:id/role', (req, res) => {
    const userId = req.params.id;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    // Prevent admin from changing their own role
    if (userId == req.user.userId) {
        return res.status(400).json({ error: 'Cannot change your own role' });
    }

    db.run('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [role, userId], function(err) {
        if (err) {
            console.error('Error updating user role:', err);
            return res.status(500).json({ error: 'Error updating user role' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User role updated successfully' });
    });
});

// Deactivate/activate user
router.put('/users/:id/status', (req, res) => {
    const userId = req.params.id;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
        return res.status(400).json({ error: 'Invalid status value' });
    }

    // Prevent admin from deactivating themselves
    if (userId == req.user.userId) {
        return res.status(400).json({ error: 'Cannot change your own status' });
    }

    db.run('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [is_active, userId], function(err) {
        if (err) {
            console.error('Error updating user status:', err);
            return res.status(500).json({ error: 'Error updating user status' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ 
            message: `User ${is_active ? 'activated' : 'deactivated'} successfully` 
        });
    });
});

// Get system statistics
router.get('/statistics', (req, res) => {
    const timeRange = req.query.range || '30'; // days

    const queries = [
        // User registrations over time
        `SELECT DATE(created_at) as date, COUNT(*) as count 
         FROM users 
         WHERE created_at > datetime("now", "-${timeRange} days")
         GROUP BY DATE(created_at)
         ORDER BY date`,
        
        // Analyses over time
        `SELECT DATE(analysis_date) as date, COUNT(*) as count
         FROM analysis_results
         WHERE analysis_date > datetime("now", "-${timeRange} days")
         GROUP BY DATE(analysis_date)
         ORDER BY date`,
        
        // Quality score distribution
        `SELECT 
           CASE 
             WHEN quality_score >= 90 THEN 'Excellent (90-100)'
             WHEN quality_score >= 80 THEN 'Good (80-89)'
             WHEN quality_score >= 70 THEN 'Fair (70-79)'
             WHEN quality_score >= 60 THEN 'Poor (60-69)'
             ELSE 'Very Poor (0-59)'
           END as quality_range,
           COUNT(*) as count
         FROM analysis_results
         GROUP BY quality_range
         ORDER BY MIN(quality_score) DESC`,
        
        // File type distribution
        `SELECT file_type, COUNT(*) as count
         FROM files
         WHERE file_type != ''
         GROUP BY file_type
         ORDER BY count DESC
         LIMIT 10`,
        
        // Top users by analyses
        `SELECT u.username, us.total_analyses, us.average_quality_score
         FROM users u
         JOIN user_statistics us ON u.id = us.user_id
         WHERE us.total_analyses > 0
         ORDER BY us.total_analyses DESC
         LIMIT 10`,
        
        // Error categories
        `SELECT i.category, COUNT(*) as count
         FROM issues i
         WHERE i.severity = 'high'
         GROUP BY i.category
         ORDER BY count DESC
         LIMIT 10`
    ];

    Promise.all(queries.map(query => 
        new Promise((resolve, reject) => {
            db.all(query, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        })
    ))
    .then(results => {
        res.json({
            userRegistrations: results[0],
            analysesOverTime: results[1],
            qualityDistribution: results[2],
            fileTypeDistribution: results[3],
            topUsers: results[4],
            errorCategories: results[5]
        });
    })
    .catch(error => {
        console.error('Statistics error:', error);
        res.status(500).json({ error: 'Error fetching statistics' });
    });
});

// Get recent activities
router.get('/activities', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    db.all(`
        SELECT 
          'file_upload' as activity_type,
          u.username,
          f.original_name as description,
          f.upload_date as created_at
        FROM files f
        JOIN users u ON f.user_id = u.id
        
        UNION ALL
        
        SELECT 
          'analysis' as activity_type,
          u.username,
          'Analyzed ' || f.original_name || ' (Score: ' || ROUND(ar.quality_score, 1) || '%)' as description,
          ar.analysis_date as created_at
        FROM analysis_results ar
        JOIN users u ON ar.user_id = u.id
        JOIN files f ON ar.file_id = f.id
        
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `, [limit, offset], (err, rows) => {
        if (err) {
            console.error('Error fetching activities:', err);
            return res.status(500).json({ error: 'Error fetching activities' });
        }

        res.json({
            activities: rows,
            pagination: {
                page,
                limit
            }
        });
    });
});

// Get system settings
router.get('/settings', (req, res) => {
    db.all('SELECT * FROM system_settings ORDER BY setting_key', (err, rows) => {
        if (err) {
            console.error('Error fetching settings:', err);
            return res.status(500).json({ error: 'Error fetching settings' });
        }

        const settings = {};
        rows.forEach(row => {
            settings[row.setting_key] = {
                value: row.setting_value,
                description: row.description,
                updated_at: row.updated_at
            };
        });

        res.json(settings);
    });
});

// Delete user
router.delete('/users/:id', (req, res) => {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId == req.user.userId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    db.serialize(() => {
        // Start transaction
        db.run('BEGIN TRANSACTION');

        // Delete user's files
        db.run('DELETE FROM files WHERE user_id = ?', [userId], (err) => {
            if (err) {
                db.run('ROLLBACK');
                console.error('Error deleting user files:', err);
                return res.status(500).json({ error: 'Error deleting user files' });
            }

            // Delete user's analysis results
            db.run('DELETE FROM analysis_results WHERE user_id = ?', [userId], (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('Error deleting user analysis results:', err);
                    return res.status(500).json({ error: 'Error deleting user analysis results' });
                }

                // Delete user statistics
                db.run('DELETE FROM user_statistics WHERE user_id = ?', [userId], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('Error deleting user statistics:', err);
                        return res.status(500).json({ error: 'Error deleting user statistics' });
                    }

                    // Finally delete the user
                    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            console.error('Error deleting user:', err);
                            return res.status(500).json({ error: 'Error deleting user' });
                        }

                        if (this.changes === 0) {
                            db.run('ROLLBACK');
                            return res.status(404).json({ error: 'User not found' });
                        }

                        // Commit transaction
                        db.run('COMMIT', (err) => {
                            if (err) {
                                console.error('Error committing transaction:', err);
                                return res.status(500).json({ error: 'Error completing deletion' });
                            }

                            res.json({ message: 'User deleted successfully' });
                        });
                    });
                });
            });
        });
    });
});

// Update system setting
router.put('/settings/:key', (req, res) => {
    const key = req.params.key;
    const { value } = req.body;

    if (!value) {
        return res.status(400).json({ error: 'Setting value is required' });
    }

    db.run(`
        UPDATE system_settings 
        SET setting_value = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE setting_key = ?
    `, [value, key], function(err) {
        if (err) {
            console.error('Error updating setting:', err);
            return res.status(500).json({ error: 'Error updating setting' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        res.json({ message: 'Setting updated successfully' });
    });
});

module.exports = router;
