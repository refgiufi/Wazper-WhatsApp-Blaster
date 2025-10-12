const express = require('express');
const router = express.Router();
const database = require('../config/database');
const whatsappService = require('../services/whatsapp');

// Get all accounts
router.get('/', async (req, res) => {
    try {
        const accounts = await database.query(`
            SELECT 
                id, name, phone, status, qr_code, created_at, 
                updated_at, last_connected
            FROM accounts 
            ORDER BY created_at DESC
        `);
        
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get account by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const account = await database.query(
            'SELECT id, name, phone, status, qr_code, created_at, updated_at, last_connected FROM accounts WHERE id = ?',
            [id]
        );
        
        if (!account.length) {
            return res.status(404).json({ error: 'Account not found' });
        }
        
        res.json(account[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new account
router.post('/', async (req, res) => {
    try {
        const { name, phone } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        // Check if phone already exists (only if phone is provided)
        if (phone) {
            const existingAccount = await database.query(
                'SELECT id FROM accounts WHERE phone = ?',
                [phone]
            );
            
            if (existingAccount.length) {
                return res.status(400).json({ error: 'Phone number already exists' });
            }
        }
        
        // Insert new account
        const result = await database.query(
            'INSERT INTO accounts (name, phone, status) VALUES (?, ?, "disconnected")',
            [name, phone]
        );
        
        const accountId = result.insertId;
        
        // Log activity
        await database.query(
            'INSERT INTO activity_logs (account_id, action, description) VALUES (?, ?, ?)',
            [accountId, 'created', 'Account created']
        );
        
        const newAccount = {
            id: accountId,
            name,
            phone,
            status: 'disconnected',
            qr_code: null,
            created_at: new Date(),
            updated_at: new Date(),
            last_connected: null
        };
        
        res.status(201).json({
            ...newAccount,
            message: 'Account created successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Connect account (generate QR code)
router.post('/:id/connect', async (req, res) => {
    try {
        const { id } = req.params;
        
        const account = await database.query('SELECT * FROM accounts WHERE id = ?', [id]);
        
        if (!account.length) {
            return res.status(404).json({ error: 'Account not found' });
        }
        
        await whatsappService.connectAccount(id);
        
        res.json({ message: 'Connection initiated. Please scan QR code.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Disconnect account
router.post('/:id/disconnect', async (req, res) => {
    try {
        const { id } = req.params;
        
        await whatsappService.disconnectAccount(id);
        
        res.json({ message: 'Account disconnected successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update account
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone } = req.body;
        
        if (!name || !phone) {
            return res.status(400).json({ error: 'Name and phone are required' });
        }
        
        const result = await database.query(
            'UPDATE accounts SET name = ?, phone = ?, updated_at = NOW() WHERE id = ?',
            [name, phone, id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }
        
        // Log activity
        await database.query(
            'INSERT INTO activity_logs (account_id, action, description) VALUES (?, ?, ?)',
            [id, 'updated', `Account details updated to ${name} - ${phone}`]
        );
        
        res.json({ message: 'Account updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete account
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // First disconnect if connected
        try {
            await whatsappService.disconnectAccount(id);
        } catch (err) {
            console.warn('Error disconnecting account during deletion:', err.message);
        }
        
        // Delete account (cascading will handle related records)
        const result = await database.query('DELETE FROM accounts WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }
        
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get account activity logs
router.get('/:id/logs', async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const logs = await database.query(
            'SELECT * FROM activity_logs WHERE account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [id, limit, offset]
        );
        
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;