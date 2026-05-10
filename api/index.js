const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Auth routes
app.post('/auth/register', require('./auth').post('/register'));
app.post('/auth/login', require('./auth').post('/login'));

// Files routes
app.post('/files/analyze', require('./files').post('/analyze'));
app.post('/files/upload', require('./files').post('/upload'));
app.get('/files/my-files', require('./files').get('/my-files'));

// Admin routes
app.get('/admin/dashboard', require('./admin').get('/dashboard'));
app.get('/admin/users', require('./admin').get('/users'));
app.get('/admin/activities', require('./admin').get('/activities'));
app.get('/admin/statistics', require('./admin').get('/statistics'));
app.put('/admin/users/:id/status', require('./admin').put('/users/:id/status'));
app.delete('/admin/users/:id', require('./admin').delete('/users/:id'));

module.exports = app;
