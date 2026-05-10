const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = process.env.ALLOWED_FILE_TYPES || '.py,.js,.html,.css,.txt,.json,.xml,.php,.java,.cpp,.c,.h,.hpp,.cs,.rb,.go,.rs,.swift,.kt,.scala,.clj,.hs,.ml,.fs,.dart,.ts,.jsx,.tsx,.vue,.svelte';
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
    },
    fileFilter: fileFilter
});

// Code analysis engine
const analyzeCode = (code, fileType) => {
    const lines = code.split('\n');
    const issues = [];
    let errors = 0;
    let warnings = 0;
    let info = 0;

    // Common security and quality checks
    const checks = [
        {
            pattern: /eval\s*\(/gi,
            type: 'error',
            severity: 'high',
            message: 'Use of eval() function detected - serious security risk',
            category: 'security'
        },
        {
            pattern: /SELECT\s+\*\s+FROM/gi,
            type: 'warning',
            severity: 'medium',
            message: 'SELECT * detected - consider specifying specific columns',
            category: 'performance'
        },
        {
            pattern: /password\s*=\s*["'][^"']+["']/gi,
            type: 'error',
            severity: 'high',
            message: 'Hardcoded password detected - use environment variables or config files',
            category: 'security'
        },
        {
            pattern: /console\.log\s*\(/gi,
            type: 'info',
            severity: 'low',
            message: 'Console.log statement detected - remove in production',
            category: 'cleanup'
        },
        {
            pattern: /TODO|FIXME|HACK/gi,
            type: 'warning',
            severity: 'low',
            message: 'TODO/FIXME comment found - address the noted issue',
            category: 'maintenance'
        },
        {
            pattern: /document\.write\s*\(/gi,
            type: 'error',
            severity: 'medium',
            message: 'document.write() detected - can cause security issues',
            category: 'security'
        },
        {
            pattern: /innerHTML\s*=/gi,
            type: 'warning',
            severity: 'medium',
            message: 'innerHTML assignment detected - potential XSS risk',
            category: 'security'
        },
        {
            pattern: /temp\s*=|tmp\s*=/gi,
            type: 'info',
            severity: 'low',
            message: 'Generic variable name detected - use more descriptive names',
            category: 'quality'
        },
        {
            pattern: /catch\s*\(\s*\)\s*\{/gi,
            type: 'warning',
            severity: 'medium',
            message: 'Empty catch block detected - handle exceptions properly',
            category: 'error-handling'
        },
        {
            pattern: /==\s*null|===\s*null/gi,
            type: 'info',
            severity: 'low',
            message: 'Null comparison detected - consider using nullish coalescing',
            category: 'style'
        }
    ];

    // Language-specific checks
    if (fileType === '.py') {
        checks.push(
            {
                pattern: /import\s+os/gi,
                type: 'info',
                severity: 'low',
                message: 'OS module imported - ensure secure usage',
                category: 'security'
            },
            {
                pattern: /exec\s*\(/gi,
                type: 'error',
                severity: 'high',
                message: 'exec() function detected - serious security risk',
                category: 'security'
            }
        );
    }

    if (fileType === '.js' || fileType === '.ts') {
        checks.push(
            {
                pattern: /var\s+/gi,
                type: 'info',
                severity: 'low',
                message: 'var keyword detected - consider using let or const',
                category: 'style'
            }
        );
    }

    // Perform analysis
    lines.forEach((line, index) => {
        checks.forEach(check => {
            if (check.pattern.test(line)) {
                const issue = {
                    line: index + 1,
                    type: check.type,
                    severity: check.severity,
                    message: check.message,
                    category: check.category,
                    code: line.trim()
                };

                issues.push(issue);

                if (check.type === 'error') errors++;
                else if (check.type === 'warning') warnings++;
                else info++;
            }
        });
    });

    // Calculate quality score
    const totalIssues = errors + warnings + info;
    const baseScore = 100;
    const errorPenalty = errors * 10;
    const warningPenalty = warnings * 5;
    const infoPenalty = info * 1;
    const qualityScore = Math.max(0, baseScore - errorPenalty - warningPenalty - infoPenalty);

    return {
        totalLines: lines.length,
        errors,
        warnings,
        info,
        qualityScore,
        issues
    };
};

// Upload file endpoint
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.user.userId;
        const file = req.file;

        // Read file content
        const fileContent = fs.readFileSync(file.path, 'utf8');

        // Insert file record
        db.run(`
            INSERT INTO files (user_id, filename, original_name, file_path, file_size, file_type)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [userId, file.filename, file.originalname, file.path, file.size, path.extname(file.originalname)], function(err) {
            if (err) {
                console.error('Error saving file record:', err);
                return res.status(500).json({ error: 'Error saving file information' });
            }

            const fileId = this.lastID;

            // Analyze code
            const analysisStartTime = Date.now();
            const analysisResult = analyzeCode(fileContent, path.extname(file.originalname));
            const processingTime = Date.now() - analysisStartTime;

            // Insert analysis results
            db.run(`
                INSERT INTO analysis_results (file_id, user_id, total_lines, errors_count, warnings_count, info_count, quality_score, analysis_data, processing_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [fileId, userId, analysisResult.totalLines, analysisResult.errors, analysisResult.warnings, analysisResult.info, analysisResult.qualityScore, JSON.stringify(analysisResult.issues), processingTime], function(err) {
                if (err) {
                    console.error('Error saving analysis results:', err);
                    return res.status(500).json({ error: 'Error saving analysis results' });
                }

                const analysisId = this.lastID;

                // Insert individual issues
                const stmt = db.prepare(`
                    INSERT INTO issues (analysis_id, file_id, user_id, issue_type, severity, line_number, message, category)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);

                analysisResult.issues.forEach(issue => {
                    stmt.run([analysisId, fileId, userId, issue.type, issue.severity, issue.line, issue.message, issue.category]);
                });

                stmt.finalize((err) => {
                    if (err) {
                        console.error('Error saving issues:', err);
                        return res.status(500).json({ error: 'Error saving individual issues' });
                    }

                    // Update user statistics
                    db.run(`
                        UPDATE user_statistics 
                        SET total_files = total_files + 1,
                            total_analyses = total_analyses + 1,
                            total_lines_analyzed = total_lines_analyzed + ?,
                            total_errors_found = total_errors_found + ?,
                            total_warnings_found = total_warnings_found + ?,
                            average_quality_score = (
                                (SELECT average_quality_score FROM user_statistics WHERE user_id = ?) * (total_analyses - 1) + ?
                            ) / total_analyses,
                            last_activity = CURRENT_TIMESTAMP
                        WHERE user_id = ?
                    `, [analysisResult.totalLines, analysisResult.errors, analysisResult.warnings, userId, analysisResult.qualityScore, userId]);

                    res.json({
                        message: 'File uploaded and analyzed successfully',
                        file: {
                            id: fileId,
                            filename: file.filename,
                            originalName: file.originalname,
                            size: file.size,
                            type: path.extname(file.originalname)
                        },
                        analysis: {
                            id: analysisId,
                            totalLines: analysisResult.totalLines,
                            errors: analysisResult.errors,
                            warnings: analysisResult.warnings,
                            info: analysisResult.info,
                            qualityScore: analysisResult.qualityScore,
                            processingTime: processingTime,
                            issues: analysisResult.issues
                        }
                    });
                });
            });
        });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Analyze code text endpoint
router.post('/analyze', authenticateToken, [
    body('code').notEmpty(),
    body('filename').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { code, filename = 'analysis.txt' } = req.body;
        const userId = req.user.userId;

        // Analyze code
        const analysisStartTime = Date.now();
        const analysisResult = analyzeCode(code, path.extname(filename));
        const processingTime = Date.now() - analysisStartTime;

        // Create a dummy file record for text analysis
        db.run(`
            INSERT INTO files (user_id, filename, original_name, file_path, file_size, file_type)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [userId, `text_${Date.now()}.txt`, filename, 'text_analysis', code.length, path.extname(filename)], function(err) {
            if (err) {
                console.error('Error creating file record:', err);
                return res.status(500).json({ error: 'Error creating file record' });
            }

            const fileId = this.lastID;

            // Insert analysis results
            db.run(`
                INSERT INTO analysis_results (file_id, user_id, total_lines, errors_count, warnings_count, info_count, quality_score, analysis_data, processing_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [fileId, userId, analysisResult.totalLines, analysisResult.errors, analysisResult.warnings, analysisResult.info, analysisResult.qualityScore, JSON.stringify(analysisResult.issues), processingTime], function(err) {
                if (err) {
                    console.error('Error saving analysis results:', err);
                    return res.status(500).json({ error: 'Error saving analysis results' });
                }

                const analysisId = this.lastID;

                // Insert individual issues
                const stmt = db.prepare(`
                    INSERT INTO issues (analysis_id, file_id, user_id, issue_type, severity, line_number, message, category)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);

                analysisResult.issues.forEach(issue => {
                    stmt.run([analysisId, fileId, userId, issue.type, issue.severity, issue.line, issue.message, issue.category]);
                });

                stmt.finalize((err) => {
                    if (err) {
                        console.error('Error saving issues:', err);
                        return res.status(500).json({ error: 'Error saving individual issues' });
                    }

                    res.json({
                        message: 'Code analyzed successfully',
                        analysis: {
                            id: analysisId,
                            totalLines: analysisResult.totalLines,
                            errors: analysisResult.errors,
                            warnings: analysisResult.warnings,
                            info: analysisResult.info,
                            qualityScore: analysisResult.qualityScore,
                            processingTime: processingTime,
                            issues: analysisResult.issues
                        }
                    });
                });
            });
        });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's files
router.get('/my-files', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    db.all(`
        SELECT f.*, 
               ar.errors_count, ar.warnings_count, ar.quality_score, ar.analysis_date,
               COUNT(*) OVER() as total_count
        FROM files f
        LEFT JOIN analysis_results ar ON f.id = ar.file_id
        WHERE f.user_id = ?
        ORDER BY f.upload_date DESC
        LIMIT ? OFFSET ?
    `, [userId, limit, offset], (err, rows) => {
        if (err) {
            console.error('Error fetching files:', err);
            return res.status(500).json({ error: 'Error fetching files' });
        }

        const totalCount = rows.length > 0 ? rows[0].total_count : 0;
        const files = rows.map(row => {
            const { total_count, ...file } = row;
            return file;
        });

        res.json({
            files,
            pagination: {
                page,
                limit,
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            }
        });
    });
});

// Get analysis history
router.get('/analysis-history', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    db.all(`
        SELECT ar.*, f.filename, f.original_name, f.file_type
        FROM analysis_results ar
        JOIN files f ON ar.file_id = f.id
        WHERE ar.user_id = ?
        ORDER BY ar.analysis_date DESC
        LIMIT ? OFFSET ?
    `, [userId, limit, offset], (err, rows) => {
        if (err) {
            console.error('Error fetching analysis history:', err);
            return res.status(500).json({ error: 'Error fetching analysis history' });
        }

        db.get(`
            SELECT COUNT(*) as total
            FROM analysis_results ar
            WHERE ar.user_id = ?
        `, [userId], (err, countRow) => {
            if (err) {
                console.error('Error counting analyses:', err);
                return res.status(500).json({ error: 'Error counting analyses' });
            }

            res.json({
                analyses: rows,
                pagination: {
                    page,
                    limit,
                    total: countRow.total,
                    pages: Math.ceil(countRow.total / limit)
                }
            });
        });
    });
});

module.exports = router;
