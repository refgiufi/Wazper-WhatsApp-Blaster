const express = require('express');
const router = express.Router();
const database = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Configure multer for media uploads
const upload = multer({
    dest: 'uploads/temp/',
    limits: {
        fileSize: 16 * 1024 * 1024, // 16MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow images, videos, audios, and documents
        const allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
            'audio/mp3', 'audio/wav', 'audio/aac', 'audio/ogg',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not supported'), false);
        }
    }
});

// Send WhatsApp message
router.post('/send', async (req, res) => {
    try {
        const { fromAccountId, toNumber, message, scheduledAt } = req.body;
        
        if (!fromAccountId || !toNumber || !message) {
            return res.status(400).json({ error: 'fromAccountId, toNumber, and message are required' });
        }
        
        // Validate account exists and is connected
        const account = await database.query(
            'SELECT * FROM accounts WHERE id = ? AND status = "connected"',
            [fromAccountId]
        );
        
        if (!account.length) {
            return res.status(400).json({ error: 'Account not found or not connected' });
        }
        
        // Get WhatsApp service instance
        const whatsappService = require('../services/whatsapp');
        
        try {
            // Send message via WhatsApp
            const result = await whatsappService.sendTextMessage(fromAccountId, toNumber, message);
            
            // Skip database logging for single messages to avoid NULL constraints
            // Single messages don't need to be stored in campaign_messages table
            // Only log the activity for tracking purposes
            
            console.log(`✅ Single message successfully sent to ${toNumber}`);
            
            // Log activity
            await database.query(
                'INSERT INTO activity_logs (account_id, action, description) VALUES (?, ?, ?)',
                [fromAccountId, 'message_sent', `Message sent to ${toNumber}`]
            );
            
            res.json({ 
                success: true, 
                message: 'Message sent successfully',
                result: result 
            });
            
        } catch (waError) {
            // Just log the error without database insertion to avoid NULL constraints
            console.error(`❌ Failed to send single message to ${toNumber}:`, waError.message);
            
            throw waError;
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message: ' + error.message });
    }
});

// Send WhatsApp message with media
router.post('/send-media', (req, res, next) => {
    // Custom multer error handling
    upload.single('media')(req, res, (err) => {
        if (err) {
            console.error('❌ Multer upload error:', err);
            
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large. Maximum size is 16MB.' });
            } else if (err.message === 'File type not supported') {
                return res.status(400).json({ error: 'File type not supported. Please use images, videos, audio, or documents.' });
            } else if (err instanceof multer.MulterError) {
                return res.status(400).json({ error: 'Upload error: ' + err.message });
            }
            
            return res.status(500).json({ error: 'File upload failed: ' + err.message });
        }
        next();
    });
}, async (req, res) => {
    try {
        const { fromAccountId, toNumber, message, scheduledAt } = req.body;
        const mediaFile = req.file;
        
        console.log('📎 Media message request received:');
        console.log('  - fromAccountId:', fromAccountId);
        console.log('  - toNumber:', toNumber);
        console.log('  - message:', message);
        console.log('  - mediaFile:', mediaFile ? {
            filename: mediaFile.filename,
            originalname: mediaFile.originalname,
            mimetype: mediaFile.mimetype,
            size: mediaFile.size,
            path: mediaFile.path
        } : 'No media file');
        console.log('  - scheduledAt:', scheduledAt);
        
        if (!fromAccountId || !toNumber) {
            return res.status(400).json({ error: 'From account and to number are required' });
        }
        
        if (!message?.trim() && !mediaFile) {
            return res.status(400).json({ error: 'Either message or media file is required' });
        }
        
        // Validate phone number format
        const phoneRegex = /^[0-9]{10,15}$/;
        if (!phoneRegex.test(toNumber)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }
        
        // Check if account exists and is connected
        const account = await database.query('SELECT * FROM accounts WHERE id = ? AND status = "connected"', [fromAccountId]);
        
        if (!account.length) {
            return res.status(400).json({ error: 'Account not found or not connected' });
        }
        
        // If scheduled message
        if (scheduledAt) {
            // TODO: Implement scheduled media messages later
            return res.status(501).json({ error: 'Scheduled media messages not implemented yet' });
        }
        
        // Get WhatsApp service instance
        const whatsappService = require('../services/whatsapp');
        
        try {
            let result;
            
            if (mediaFile && message?.trim()) {
                // Send media with caption
                result = await whatsappService.sendMediaMessage(fromAccountId, toNumber, mediaFile, message.trim());
            } else if (mediaFile) {
                // Send media only
                result = await whatsappService.sendMediaMessage(fromAccountId, toNumber, mediaFile);
            } else {
                // Send text only (fallback)
                result = await whatsappService.sendTextMessage(fromAccountId, toNumber, message.trim());
            }
            
            console.log(`✅ Media message successfully sent to ${toNumber}`);
            
            // Log activity
            await database.query(
                'INSERT INTO activity_logs (account_id, action, description) VALUES (?, ?, ?)',
                [fromAccountId, 'media_message_sent', `Media message sent to ${toNumber}`]
            );
            
            // Clean up temp file
            if (mediaFile && mediaFile.path) {
                try {
                    await fs.unlink(mediaFile.path);
                } catch (cleanupError) {
                    console.log('File cleanup warning:', cleanupError.message);
                }
            }
            
            res.json({ 
                success: true, 
                message: 'Media message sent successfully',
                result: result 
            });
            
        } catch (waError) {
            // Clean up temp file on error
            if (mediaFile && mediaFile.path) {
                try {
                    await fs.unlink(mediaFile.path);
                } catch (cleanupError) {
                    console.log('File cleanup warning:', cleanupError.message);
                }
            }
            
            console.error(`❌ Failed to send media message to ${toNumber}:`, waError.message);
            throw waError;
        }
        
    } catch (error) {
        console.error('❌ Error sending media message:', error);
        
        // Clean up temp file on any error
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupError) {
                console.log('File cleanup warning:', cleanupError.message);
            }
        }
        
        // Handle specific multer errors
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 16MB.' });
        } else if (error.message === 'File type not supported') {
            return res.status(400).json({ error: 'File type not supported. Please use images, videos, audio, or documents.' });
        }
        
        res.status(500).json({ error: 'Failed to send media message: ' + error.message });
    }
});

// Get all message templates
router.get('/templates', async (req, res) => {
    try {
        const templates = await database.query(`
            SELECT * FROM message_templates 
            ORDER BY created_at DESC
        `);
        
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get template by ID
router.get('/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const template = await database.query(
            'SELECT * FROM message_templates WHERE id = ?',
            [id]
        );
        
        if (!template.length) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        res.json(template[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new message template
router.post('/templates', async (req, res) => {
    try {
        const { name, message_text, has_media, media_type, media_path } = req.body;
        
        if (!name || !message_text) {
            return res.status(400).json({ error: 'Name and message_text are required' });
        }
        
        const result = await database.query(
            `INSERT INTO message_templates 
             (name, message_text, has_media, media_type, media_path) 
             VALUES (?, ?, ?, ?, ?)`,
            [name, message_text, has_media || false, media_type || null, media_path || null]
        );
        
        res.status(201).json({
            id: result.insertId,
            name,
            message_text,
            has_media,
            media_type,
            media_path,
            message: 'Template created successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update message template
router.put('/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, message_text, has_media, media_type, media_path } = req.body;
        
        if (!name || !message_text) {
            return res.status(400).json({ error: 'Name and message_text are required' });
        }
        
        const result = await database.query(
            `UPDATE message_templates 
             SET name = ?, message_text = ?, has_media = ?, media_type = ?, media_path = ?, updated_at = NOW()
             WHERE id = ?`,
            [name, message_text, has_media || false, media_type || null, media_path || null, id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        res.json({ message: 'Template updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete message template
router.delete('/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await database.query('DELETE FROM message_templates WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all contacts
router.get('/contacts', async (req, res) => {
    try {
        const { group_name } = req.query;
        
        let query = 'SELECT * FROM contacts WHERE is_active = 1';
        let params = [];
        
        if (group_name) {
            query += ' AND group_name = ?';
            params.push(group_name);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const contacts = await database.query(query, params);
        
        res.json(contacts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get contact groups
router.get('/contacts/groups', async (req, res) => {
    try {
        const groups = await database.query(
            'SELECT group_name, COUNT(*) as contact_count FROM contacts WHERE is_active = 1 AND group_name IS NOT NULL GROUP BY group_name ORDER BY group_name'
        );
        
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add new contact
router.post('/contacts', async (req, res) => {
    try {
        const { name, phone, group_name } = req.body;
        
        if (!name || !phone) {
            return res.status(400).json({ error: 'Name and phone are required' });
        }
        
        // Clean phone number
        const cleanPhone = phone.replace(/\D/g, '');
        
        const result = await database.query(
            'INSERT INTO contacts (name, phone, group_name) VALUES (?, ?, ?)',
            [name, cleanPhone, group_name || null]
        );
        
        res.status(201).json({
            id: result.insertId,
            name,
            phone: cleanPhone,
            group_name,
            message: 'Contact added successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bulk import contacts
router.post('/contacts/bulk', async (req, res) => {
    try {
        const { contacts } = req.body;
        
        if (!Array.isArray(contacts) || !contacts.length) {
            return res.status(400).json({ error: 'Contacts array is required' });
        }
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (const contact of contacts) {
            try {
                const { name, phone, group_name } = contact;
                
                if (!name || !phone) {
                    errors.push(`Contact missing name or phone: ${JSON.stringify(contact)}`);
                    errorCount++;
                    continue;
                }
                
                const cleanPhone = phone.toString().replace(/\D/g, '');
                
                await database.query(
                    'INSERT INTO contacts (name, phone, group_name) VALUES (?, ?, ?)',
                    [name, cleanPhone, group_name || null]
                );
                
                successCount++;
                
            } catch (err) {
                errors.push(`Error adding contact ${contact.name}: ${err.message}`);
                errorCount++;
            }
        }
        
        res.json({
            message: 'Bulk import completed',
            success_count: successCount,
            error_count: errorCount,
            errors: errors.slice(0, 10) // Limit error messages
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update contact
router.put('/contacts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, group_name, is_active } = req.body;
        
        if (!name || !phone) {
            return res.status(400).json({ error: 'Name and phone are required' });
        }
        
        const cleanPhone = phone.replace(/\D/g, '');
        
        const result = await database.query(
            'UPDATE contacts SET name = ?, phone = ?, group_name = ?, is_active = ? WHERE id = ?',
            [name, cleanPhone, group_name || null, is_active !== undefined ? is_active : true, id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        
        res.json({ message: 'Contact updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete contact
router.delete('/contacts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await database.query('DELETE FROM contacts WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        
        res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;