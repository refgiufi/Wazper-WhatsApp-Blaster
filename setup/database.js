const fs = require('fs-extra');
const path = require('path');
const database = require('../config/database');

async function setupDatabase() {
    try {
        console.log('🚀 Setting up Wazper database...');
        
        // Connect to database
        await database.connect();
        
        // Read and execute SQL file
        const sqlFile = path.join(__dirname, 'database.sql');
        const sqlContent = await fs.readFile(sqlFile, 'utf8');
        
        // Split SQL content by semicolon and execute each statement
        const statements = sqlContent.split(';').filter(stmt => stmt.trim().length > 0);
        
        // Get raw connection for executing statements that don't support prepared statements
        const connection = await database.pool.getConnection();
        
        try {
            for (const statement of statements) {
                if (statement.trim()) {
                    // Use connection.query instead of prepared statement for DDL commands
                    await connection.query(statement.trim());
                }
            }
        } finally {
            connection.release();
        }
        
        console.log('✅ Database setup completed successfully!');
        
        // Create necessary directories
        const directories = [
            'uploads/images',
            'uploads/documents',
            'uploads/audio',
            'uploads/video',
            'sessions'
        ];
        
        for (const dir of directories) {
            const fullPath = path.join(__dirname, '..', dir);
            await fs.ensureDir(fullPath);
            console.log(`📁 Created directory: ${dir}`);
        }
        
        console.log('🎉 Setup completed! You can now run: npm start');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    } finally {
        await database.close();
        process.exit(0);
    }
}

// Run setup if called directly
if (require.main === module) {
    setupDatabase();
}

module.exports = setupDatabase;