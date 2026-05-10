const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './database/code_analyzer.db';

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// SQLite3 v6.0.1 compatible database initialization
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Connected to SQLite database');
    }
});

// Create tables with proper error handling
const createTables = () => {
    return new Promise((resolve, reject) => {
        const tables = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                is_active BOOLEAN DEFAULT 1
            )`,
            
            // Files table
            `CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                filename VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size INTEGER NOT NULL,
                file_type VARCHAR(50) NOT NULL,
                upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,

            // Analysis results table
            `CREATE TABLE IF NOT EXISTS analysis_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                analysis_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                total_lines INTEGER DEFAULT 0,
                errors_count INTEGER DEFAULT 0,
                warnings_count INTEGER DEFAULT 0,
                info_count INTEGER DEFAULT 0,
                quality_score DECIMAL(5,2) DEFAULT 0,
                analysis_data TEXT,
                processing_time INTEGER,
                FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,

            // Issues table (detailed issues found during analysis)
            `CREATE TABLE IF NOT EXISTS issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_id INTEGER NOT NULL,
                file_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                issue_type VARCHAR(20) NOT NULL,
                severity VARCHAR(10) NOT NULL,
                line_number INTEGER,
                column_number INTEGER,
                message TEXT NOT NULL,
                rule_id VARCHAR(50),
                category VARCHAR(50),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (analysis_id) REFERENCES analysis_results (id) ON DELETE CASCADE,
                FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,

            // User statistics table (for quick admin access)
            `CREATE TABLE IF NOT EXISTS user_statistics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                total_files INTEGER DEFAULT 0,
                total_analyses INTEGER DEFAULT 0,
                total_lines_analyzed INTEGER DEFAULT 0,
                total_errors_found INTEGER DEFAULT 0,
                total_warnings_found INTEGER DEFAULT 0,
                average_quality_score DECIMAL(5,2) DEFAULT 0,
                last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,

            // System settings table
            `CREATE TABLE IF NOT EXISTS system_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setting_key VARCHAR(100) UNIQUE NOT NULL,
                setting_value TEXT,
                description TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        let completedTables = 0;
        const totalTables = tables.length;

        tables.forEach((sql, index) => {
            db.run(sql, (err) => {
                if (err) {
                    console.error(`❌ Error creating table ${index + 1}:`, err.message);
                    reject(err);
                    return;
                }
                
                completedTables++;
                console.log(`✅ Table ${index + 1}/${totalTables} created successfully`);
                
                if (completedTables === totalTables) {
                    console.log('✅ All database tables created successfully');
                    resolve();
                }
            });
        });
    });
};

// Insert default admin user
const createDefaultAdmin = async () => {
    return new Promise((resolve, reject) => {
        const bcrypt = require('bcryptjs');
        const defaultAdmin = {
            username: 'admin',
            email: 'admin@codeanalyzer.com',
            password: 'admin123', // Change this in production!
            role: 'admin'
        };

        // Check if admin already exists
        db.get('SELECT id FROM users WHERE username = ?', [defaultAdmin.username], (err, row) => {
            if (err) {
                console.error('Error checking admin user:', err);
                reject(err);
                return;
            }

            if (row) {
                console.log('👤 Admin user already exists');
                resolve();
                return;
            }

            // Hash password and create admin
            bcrypt.hash(defaultAdmin.password, 12, (err, hash) => {
                if (err) {
                    console.error('Error hashing password:', err);
                    reject(err);
                    return;
                }

                db.run(`
                    INSERT INTO users (username, email, password_hash, role)
                    VALUES (?, ?, ?, ?)
                `, [defaultAdmin.username, defaultAdmin.email, hash, defaultAdmin.role], function(err) {
                    if (err) {
                        console.error('Error creating admin user:', err);
                        reject(err);
                        return;
                    }

                    console.log('👤 Default admin user created successfully');
                    console.log('   Username: admin');
                    console.log('   Password: admin123');
                    console.log('   ⚠️  Please change the default password in production!');
                    resolve();
                });
            });
        });
    });
};

// Insert default system settings
const createDefaultSettings = async () => {
    return new Promise((resolve, reject) => {
        const settings = [
            ['max_file_size', '10485760', 'Maximum file size in bytes (10MB)'],
            ['allowed_extensions', '.py,.js,.html,.css,.txt,.json,.xml,.php,.java,.cpp,.c,.h,.hpp,.cs,.rb,.go,.rs,.swift,.kt,.scala,.clj,.hs,.ml,.fs,.dart,.ts,.jsx,.tsx,.vue,.svelte', 'Allowed file extensions'],
            ['analysis_timeout', '30000', 'Analysis timeout in milliseconds'],
            ['enable_registration', 'true', 'Allow new user registrations'],
            ['max_daily_analyses', '100', 'Maximum analyses per user per day']
        ];

        const stmt = db.prepare(`
            INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description)
            VALUES (?, ?, ?)
        `);

        settings.forEach(setting => {
            stmt.run(setting);
        });

        stmt.finalize((err) => {
            if (err) {
                console.error('Error creating default settings:', err);
                reject(err);
            } else {
                console.log('⚙️ Default system settings created');
                resolve();
            }
        });
    });
};

// Initialize database
const initDatabase = async () => {
    try {
        console.log('🔧 Initializing database...');
        await createTables();
        await createDefaultAdmin();
        await createDefaultSettings();
        console.log('✅ Database initialization completed');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    }
};

module.exports = { initDatabase, db };
