const express = require('express');
const router = express.Router();

// Mock file analysis endpoint
router.post('/analyze', (req, res) => {
    const { code, filename } = req.body;
    
    // Simple mock analysis
    const mockAnalysis = {
        issues: [
            {
                severity: 'warning',
                message: 'Unused variable detected',
                description: 'Variable "temp" is declared but never used',
                line: 5
            },
            {
                severity: 'info',
                message: 'Consider using const instead of let',
                description: 'Variable is not reassigned, consider using const',
                line: 3
            }
        ],
        errors: 0,
        warnings: 2,
        quality_score: 85
    };
    
    res.json({ analysis: mockAnalysis });
});

// Mock file upload endpoint
router.post('/upload', (req, res) => {
    res.json({ 
        message: 'File uploaded successfully',
        file_id: Date.now()
    });
});

// Mock user files endpoint
router.get('/my-files', (req, res) => {
    res.json({
        files: [
            {
                id: 1,
                name: 'example.py',
                size: 1024,
                created_at: new Date().toISOString()
            }
        ]
    });
});

module.exports = router;
