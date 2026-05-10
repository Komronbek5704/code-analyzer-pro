# CodeAnalyzer Pro Backend

Node.js/Express backend for CodeAnalyzer Pro - Statistical Code Analysis System with user authentication and admin panel.

## Features

- **User Authentication**: Register, login with JWT tokens
- **File Upload & Analysis**: Upload code files for security and quality analysis
- **Admin Panel**: Complete user statistics and system management
- **SQLite Database**: Lightweight, file-based database
- **Security**: Password hashing, JWT authentication, rate limiting
- **Code Analysis**: Detects security vulnerabilities, code quality issues, and performance problems

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm

### Setup Steps

1. **Install dependencies**:
```bash
npm install
```

2. **Environment Configuration**:
The `.env` file is already configured with default settings. Update if needed:
```env
PORT=3000
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
DB_PATH=./database/code_analyzer.db
```

3. **Start the server**:
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

4. **Access the application**:
- Main application: http://localhost:3000
- Admin panel: http://localhost:3000/admin.html
- API base: http://localhost:3000/api

## Default Admin Account

- **Username**: admin
- **Password**: admin123
- **Email**: admin@codeanalyzer.com

⚠️ **Important**: Change the default admin password in production!

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/change-password` - Change password

### Files & Analysis
- `POST /api/files/upload` - Upload and analyze file
- `POST /api/files/analyze` - Analyze code text
- `GET /api/files/my-files` - Get user's files
- `GET /api/files/analysis-history` - Get analysis history

### Admin Panel (Admin only)
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id/role` - Update user role
- `PUT /api/admin/users/:id/status` - Activate/deactivate user
- `GET /api/admin/statistics` - System statistics
- `GET /api/admin/activities` - Recent activities
- `GET /api/admin/settings` - System settings
- `PUT /api/admin/settings/:key` - Update setting

## Database Schema

The system uses SQLite with the following main tables:

- **users**: User accounts and authentication
- **files**: Uploaded file information
- **analysis_results**: Analysis results and metrics
- **issues**: Detailed issues found during analysis
- **user_statistics**: Aggregated user statistics
- **system_settings**: Configuration settings

## Supported File Types

The system analyzes various programming and markup languages:
- Python (.py)
- JavaScript (.js, .jsx, .tsx)
- HTML/CSS (.html, .css)
- Java (.java)
- C/C++ (.c, .cpp, .h, .hpp)
- PHP (.php)
- Ruby (.rb)
- Go (.go)
- Rust (.rs)
- And many more...

## Security Features

- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevents API abuse
- **Input Validation**: Comprehensive input sanitization
- **CORS Protection**: Configured for secure cross-origin requests
- **Helmet.js**: Security headers

## Code Analysis Rules

The system detects:

### Security Issues
- Use of eval() functions
- SQL injection risks
- Hardcoded passwords
- XSS vulnerabilities
- Dangerous function usage

### Code Quality Issues
- Unused variables
- Poor naming conventions
- Missing error handling
- Code style violations

### Performance Issues
- Inefficient database queries
- Resource-intensive operations
- Memory leaks potential

## Development

### Project Structure
```
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── .env                  # Environment variables
├── database/
│   └── init.js          # Database initialization
├── middleware/
│   └── auth.js          # Authentication middleware
├── routes/
│   ├── auth.js          # Authentication routes
│   ├── files.js         # File upload & analysis routes
│   └── admin.js         # Admin panel routes
├── uploads/             # Uploaded files directory
└── index.htm/          # Frontend files
```

### Adding New Analysis Rules

To add new code analysis rules, modify the `analyzeCode` function in `routes/files.js`:

```javascript
const checks = [
    // Existing rules...
    {
        pattern: /your-pattern/gi,
        type: 'error', // 'error', 'warning', 'info'
        severity: 'high', // 'high', 'medium', 'low'
        message: 'Your custom message',
        category: 'security' // 'security', 'performance', 'quality', etc.
    }
];
```

## Production Deployment

1. **Environment Variables**:
   - Change `JWT_SECRET` to a strong random string
   - Set `NODE_ENV=production`
   - Update database path if needed

2. **Security**:
   - Change default admin password
   - Set up HTTPS
   - Configure firewall rules
   - Regular database backups

3. **Performance**:
   - Use PM2 for process management
   - Set up reverse proxy (nginx)
   - Monitor resource usage

## Troubleshooting

### Common Issues

1. **Database errors**: Ensure the `database/` directory exists and is writable
2. **Upload failures**: Check file size limits and allowed file types
3. **Authentication errors**: Verify JWT secret and token expiration
4. **Port conflicts**: Change PORT in .env file

### Logging

The application logs to console. In production, consider implementing file logging.

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions, please check the logs and ensure all dependencies are properly installed.
