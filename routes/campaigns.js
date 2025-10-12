const express = require('express');
const router = express.Router();
const database = require('../config/database');
const whatsappService = require('../services/whatsapp');

// Get all campaigns
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        
        let query = `
            SELECT 
                c.*, 
                a.name as account_name, 
                a.phone as account_phone,
                a.status as account_status,
                mt.name as template_name
            FROM campaigns c
            JOIN accounts a ON c.account_id = a.id
            JOIN message_templates mt ON c.template_id = mt.id
        `;
        
        let params = [];
        
        if (status) {
            query += ' WHERE c.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY c.created_at DESC';
        
        const campaigns = await database.query(query, params);
        
        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get campaign by ID with details
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const campaign = await database.query(`
            SELECT 
                c.*, 
                a.name as account_name, 
                a.phone as account_phone,
                a.status as account_status,
                mt.name as template_name,
                mt.message_text,
                mt.media_path
            FROM campaigns c
            JOIN accounts a ON c.account_id = a.id
            JOIN message_templates mt ON c.template_id = mt.id
            WHERE c.id = ?
        `, [id]);
        
        if (!campaign.length) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        // Get message statistics
        const messageStats = await database.query(`
            SELECT 
                status,
                COUNT(*) as count
            FROM campaign_messages 
            WHERE campaign_id = ?
            GROUP BY status
        `, [id]);
        
        const stats = {
            pending: 0,
            sent: 0,
            failed: 0,
            delivered: 0,
            read: 0
        };
        
        messageStats.forEach(stat => {
            stats[stat.status] = stat.count;
        });
        
        res.json({
            ...campaign[0],
            message_stats: stats
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new campaign
router.post('/', async (req, res) => {
    try {
        const { name, account_id, template_id, target_contacts, delay_seconds } = req.body;
        
        if (!name || !account_id || !template_id || !target_contacts || !Array.isArray(target_contacts)) {
            return res.status(400).json({ 
                error: 'Name, account_id, template_id, and target_contacts array are required' 
            });
        }
        
        // Verify account exists and is connected
        const account = await database.query(
            'SELECT * FROM accounts WHERE id = ? AND status = "connected"',
            [account_id]
        );
        
        if (!account.length) {
            return res.status(400).json({ error: 'Account not found or not connected' });
        }
        
        // Verify template exists
        const template = await database.query(
            'SELECT * FROM message_templates WHERE id = ?',
            [template_id]
        );
        
        if (!template.length) {
            return res.status(400).json({ error: 'Template not found' });
        }
        
        const templateData = template[0];
        
        // Start transaction
        const result = await database.transaction(async (connection) => {
            // Create campaign
            const [campaignResult] = await connection.execute(
                'INSERT INTO campaigns (name, account_id, template_id, total_targets, delay_seconds) VALUES (?, ?, ?, ?, ?)',
                [name, account_id, template_id, target_contacts.length, delay_seconds || 5]
            );
            
            const campaignId = campaignResult.insertId;
            
            // Create campaign messages for each target
            for (const contactId of target_contacts) {
                // Get contact details
                const [contact] = await connection.execute(
                    'SELECT * FROM contacts WHERE id = ? AND is_active = 1',
                    [contactId]
                );
                
                if (contact.length) {
                    const contactData = contact[0];
                    
                    // Replace placeholders in message
                    let personalizedMessage = templateData.message_text;
                    personalizedMessage = personalizedMessage.replace(/{name}/g, contactData.name);
                    personalizedMessage = personalizedMessage.replace(/{phone}/g, contactData.phone);
                    
                    await connection.execute(
                        `INSERT INTO campaign_messages 
                         (campaign_id, contact_id, phone, message_text, media_path) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [campaignId, contactData.id, contactData.phone, personalizedMessage, templateData.media_path]
                    );
                }
            }
            
            return campaignId;
        });
        
        res.status(201).json({
            id: result,
            name,
            message: 'Campaign created successfully'
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start campaign
router.post('/:id/start', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Update campaign status
        const result = await database.query(
            'UPDATE campaigns SET status = "running", started_at = NOW() WHERE id = ? AND status = "draft"',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Campaign not found or already started' });
        }
        
        // Start sending messages in background
        setTimeout(async () => {
            try {
                await whatsappService.sendBulkMessages(id);
            } catch (error) {
                console.error('Error in bulk message sending:', error);
            }
        }, 1000);
        
        res.json({ message: 'Campaign started successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Pause campaign
router.post('/:id/pause', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await database.query(
            'UPDATE campaigns SET status = "paused" WHERE id = ? AND status = "running"',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Campaign not found or not running' });
        }
        
        res.json({ message: 'Campaign paused successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Resume campaign
router.post('/:id/resume', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await database.query(
            'UPDATE campaigns SET status = "running" WHERE id = ? AND status = "paused"',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Campaign not found or not paused' });
        }
        
        // Resume sending messages
        setTimeout(async () => {
            try {
                await whatsappService.sendBulkMessages(id);
            } catch (error) {
                console.error('Error resuming bulk messages:', error);
            }
        }, 1000);
        
        res.json({ message: 'Campaign resumed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel campaign
router.post('/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await database.query(
            'UPDATE campaigns SET status = "cancelled" WHERE id = ? AND status IN ("running", "paused", "draft")',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Campaign not found or already completed' });
        }
        
        res.json({ message: 'Campaign cancelled successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get campaign messages with pagination
router.get('/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, limit = 50, offset = 0 } = req.query;
        
        let query = `
            SELECT 
                cm.*,
                c.name as contact_name
            FROM campaign_messages cm
            LEFT JOIN contacts c ON cm.contact_id = c.id
            WHERE cm.campaign_id = ?
        `;
        
        let params = [id];
        
        if (status) {
            query += ' AND cm.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY cm.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const messages = await database.query(query, params);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM campaign_messages WHERE campaign_id = ?';
        let countParams = [id];
        
        if (status) {
            countQuery += ' AND status = ?';
            countParams.push(status);
        }
        
        const totalResult = await database.query(countQuery, countParams);
        const total = totalResult[0].total;
        
        res.json({
            messages,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete campaign
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Can only delete campaigns that are not running
        const result = await database.query(
            'DELETE FROM campaigns WHERE id = ? AND status != "running"',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(400).json({ 
                error: 'Campaign not found or is currently running. Please stop the campaign first.' 
            });
        }
        
        res.json({ message: 'Campaign deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;