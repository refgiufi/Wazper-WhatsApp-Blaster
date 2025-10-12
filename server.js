const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
const database = require('./config/database');
const whatsappService = require('./services/whatsapp');

// Import routes
const accountRoutes = require('./routes/accounts');
const messageRoutes = require('./routes/messages');
const campaignRoutes = require('./routes/campaigns');
const uploadRoutes = require('./routes/uploads');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'wazper-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/accounts', accountRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/uploads', uploadRoutes);

// Main dashboard route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint untuk status aplikasi
app.get('/api/status', async (req, res) => {
    try {
        const accounts = await database.query('SELECT COUNT(*) as total FROM accounts');
        const connectedAccounts = await database.query('SELECT COUNT(*) as connected FROM accounts WHERE status = "connected"');
        const activeCampaigns = await database.query('SELECT COUNT(*) as active FROM campaigns WHERE status = "running"');
        
        res.json({
            status: 'ok',
            uptime: process.uptime(),
            accounts: {
                total: accounts[0].total,
                connected: connectedAccounts[0].connected
            },
            campaigns: {
                active: activeCampaigns[0].active
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found'
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    
    try {
        // Disconnect all WhatsApp sessions
        await whatsappService.disconnectAll();
        
        // Close database connection
        await database.close();
        
        console.log('✅ Server shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

// Start server
async function startServer() {
    try {
        // Connect to database
        await database.connect();
        console.log('✅ Database connected');
        
        // Ensure upload directories exist
        const uploadDirs = ['uploads/images', 'uploads/documents', 'uploads/audio', 'uploads/video'];
        for (const dir of uploadDirs) {
            await fs.ensureDir(dir);
        }
        
        // Initialize WhatsApp service
        await whatsappService.initialize();
        console.log('✅ WhatsApp service initialized');
        
        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Wazper server running on http://localhost:${PORT}`);
            console.log(`📱 Access the dashboard at http://localhost:${PORT}`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();