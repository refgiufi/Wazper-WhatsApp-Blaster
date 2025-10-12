const express = require('express');
const router = express.Router();
const database = require('../config/database');

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