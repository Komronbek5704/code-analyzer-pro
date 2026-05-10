# Vercel Deployment Guide

## Project Structure for Vercel

This project has been prepared for Vercel deployment with the following structure:

```
dta_loyiha/
├── api/                    # Serverless functions
│   ├── index.js           # Main API entry point
│   ├── auth.js            # Authentication routes
│   ├── files.js           # File analysis routes
│   └── admin.js           # Admin panel routes
├── index.html             # Main frontend page
├── admin.html             # Admin panel page
├── styles.css             # Styles
├── package.json           # Dependencies
└── vercel.json            # Vercel configuration
```

## Deployment Steps

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy Project
```bash
cd dta_loyiha
vercel
```

### 4. Environment Variables
Set these in Vercel dashboard or CLI:
- `JWT_SECRET`: Your JWT secret key
- `NODE_ENV`: production

## Features

### Authentication
- User registration and login
- JWT token-based authentication
- Role-based access (admin/user)

### API Endpoints
- `/api/auth/register` - Register new user
- `/api/auth/login` - User login
- `/api/files/analyze` - Analyze code
- `/api/admin/*` - Admin panel endpoints

### Frontend
- Responsive design
- Modern UI with animations
- Toast notifications
- Admin panel with user management

## Notes

- Database uses in-memory SQLite for demo
- File upload functionality is mocked
- Admin credentials: username: `admin`, password: `admin123`

## Production Considerations

For production deployment:
1. Replace in-memory database with persistent storage
2. Implement proper file upload handling
3. Add rate limiting and security measures
4. Set up proper environment variables
5. Configure custom domain if needed
