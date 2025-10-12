const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const database = require('../config/database');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const fileType = getFileType(file.mimetype);
        const uploadDir = path.join(__dirname, '..', 'uploads', fileType);
        
        // Ensure directory exists
        fs.ensureDirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueId = uuidv4();
        const extension = path.extname(file.originalname).toLowerCase();
        cb(null, `${uniqueId}${extension}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Allow images, documents, videos, and audio
        const allowedMimes = [
            // Images
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            // Documents
            'application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain', 'text/csv',
            // Videos
            'video/mp4', 'video/quicktime', 'video/x-msvideo',
            // Audio
            'audio/mpeg', 'audio/wav', 'audio/ogg'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} is not allowed`), false);
        }
    }
});

function getFileType(mimetype) {
    if (mimetype.startsWith('image/')) return 'images';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'documents';
}

// Upload single file
router.post('/file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { originalname, filename, path: filePath, size, mimetype } = req.file;
        const fileType = getFileType(mimetype);
        
        // If it's an image, create thumbnail
        let thumbnailPath = null;
        if (fileType === 'images') {
            try {
                const thumbnailName = `thumb_${filename}`;
                thumbnailPath = path.join(path.dirname(filePath), thumbnailName);
                
                await sharp(filePath)
                    .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toFile(thumbnailPath);
            } catch (error) {
                console.warn('Failed to create thumbnail:', error.message);
            }
        }
        
        // Save to database
        const result = await database.query(
            `INSERT INTO media_files 
             (original_name, filename, file_path, file_size, mime_type, file_type) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [originalname, filename, filePath, size, mimetype, fileType]
        );
        
        const fileId = result.insertId;
        
        res.status(201).json({
            id: fileId,
            original_name: originalname,
            filename: filename,
            file_path: `/uploads/${fileType}/${filename}`,
            thumbnail_path: thumbnailPath ? `/uploads/${fileType}/thumb_${filename}` : null,
            file_size: size,
            mime_type: mimetype,
            file_type: fileType,
            message: 'File uploaded successfully'
        });
        
    } catch (error) {
        // Clean up uploaded file if database save fails
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.warn('Failed to clean up file:', unlinkError.message);
            }
        }
        
        res.status(500).json({ error: error.message });
    }
});

// Upload multiple files
router.post('/files', upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        
        const uploadedFiles = [];
        const errors = [];
        
        for (const file of req.files) {
            try {
                const { originalname, filename, path: filePath, size, mimetype } = file;
                const fileType = getFileType(mimetype);
                
                // Create thumbnail for images
                let thumbnailPath = null;
                if (fileType === 'images') {
                    try {
                        const thumbnailName = `thumb_${filename}`;
                        thumbnailPath = path.join(path.dirname(filePath), thumbnailName);
                        
                        await sharp(filePath)
                            .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
                            .jpeg({ quality: 80 })
                            .toFile(thumbnailPath);
                    } catch (error) {
                        console.warn('Failed to create thumbnail:', error.message);
                    }
                }
                
                // Save to database
                const result = await database.query(
                    `INSERT INTO media_files 
                     (original_name, filename, file_path, file_size, mime_type, file_type) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [originalname, filename, filePath, size, mimetype, fileType]
                );
                
                uploadedFiles.push({
                    id: result.insertId,
                    original_name: originalname,
                    filename: filename,
                    file_path: `/uploads/${fileType}/${filename}`,
                    thumbnail_path: thumbnailPath ? `/uploads/${fileType}/thumb_${filename}` : null,
                    file_size: size,
                    mime_type: mimetype,
                    file_type: fileType
                });
                
            } catch (error) {
                errors.push({
                    filename: file.originalname,
                    error: error.message
                });
                
                // Clean up file on error
                try {
                    await fs.unlink(file.path);
                } catch (unlinkError) {
                    console.warn('Failed to clean up file:', unlinkError.message);
                }
            }
        }
        
        res.status(201).json({
            uploaded_files: uploadedFiles,
            errors: errors,
            message: `${uploadedFiles.length} files uploaded successfully, ${errors.length} errors`
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all uploaded files with pagination
router.get('/files', async (req, res) => {
    try {
        const { file_type, limit = 20, offset = 0, search } = req.query;
        
        let query = 'SELECT * FROM media_files WHERE 1=1';
        let params = [];
        
        if (file_type) {
            query += ' AND file_type = ?';
            params.push(file_type);
        }
        
        if (search) {
            query += ' AND original_name LIKE ?';
            params.push(`%${search}%`);
        }
        
        query += ' ORDER BY uploaded_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const files = await database.query(query, params);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM media_files WHERE 1=1';
        let countParams = [];
        
        if (file_type) {
            countQuery += ' AND file_type = ?';
            countParams.push(file_type);
        }
        
        if (search) {
            countQuery += ' AND original_name LIKE ?';
            countParams.push(`%${search}%`);
        }
        
        const totalResult = await database.query(countQuery, countParams);
        const total = totalResult[0].total;
        
        // Add full URL paths
        const filesWithUrls = files.map(file => ({
            ...file,
            file_url: `/uploads/${file.file_type}/${file.filename}`,
            thumbnail_url: file.file_type === 'images' ? `/uploads/${file.file_type}/thumb_${file.filename}` : null
        }));
        
        res.json({
            files: filesWithUrls,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get file by ID
router.get('/files/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const file = await database.query(
            'SELECT * FROM media_files WHERE id = ?',
            [id]
        );
        
        if (!file.length) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const fileData = file[0];
        
        res.json({
            ...fileData,
            file_url: `/uploads/${fileData.file_type}/${fileData.filename}`,
            thumbnail_url: fileData.file_type === 'images' ? `/uploads/${fileData.file_type}/thumb_${fileData.filename}` : null
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete file
router.delete('/files/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const file = await database.query(
            'SELECT * FROM media_files WHERE id = ?',
            [id]
        );
        
        if (!file.length) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const fileData = file[0];
        
        // Delete from database first
        await database.query('DELETE FROM media_files WHERE id = ?', [id]);
        
        // Delete physical files
        try {
            await fs.unlink(fileData.file_path);
            
            // Delete thumbnail if exists
            if (fileData.file_type === 'images') {
                const thumbnailPath = path.join(
                    path.dirname(fileData.file_path), 
                    `thumb_${fileData.filename}`
                );
                
                if (await fs.pathExists(thumbnailPath)) {
                    await fs.unlink(thumbnailPath);
                }
            }
        } catch (unlinkError) {
            console.warn('Failed to delete physical file:', unlinkError.message);
        }
        
        res.json({ message: 'File deleted successfully' });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get file statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await database.query(`
            SELECT 
                file_type,
                COUNT(*) as count,
                SUM(file_size) as total_size
            FROM media_files 
            GROUP BY file_type
        `);
        
        const totalFiles = await database.query(
            'SELECT COUNT(*) as total, SUM(file_size) as total_size FROM media_files'
        );
        
        res.json({
            by_type: stats,
            total: totalFiles[0]
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files. Maximum is 10 files.' });
        }
    }
    
    res.status(500).json({ error: error.message });
});

module.exports = router;