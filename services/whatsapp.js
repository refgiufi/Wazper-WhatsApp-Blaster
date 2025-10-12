const { 
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    delay
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const QRCode = require('qrcode');
const database = require('../config/database');

class WhatsAppService {
    constructor() {
        this.sessions = new Map();
        this.stores = new Map();
        this.logger = pino({ level: 'warn' });
    }

    async initialize() {
        try {
            // Ensure sessions directory exists
            await fs.ensureDir('./sessions');
            
            // Load existing accounts from database
            const accounts = await database.query(
                'SELECT * FROM accounts WHERE status != "disconnected"'
            );
            
            for (const account of accounts) {
                await this.connectAccount(account.id);
            }
            
            console.log('✅ WhatsApp service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize WhatsApp service:', error);
            throw error;
        }
    }

    async connectAccount(accountId) {
        try {
            const account = await database.query(
                'SELECT * FROM accounts WHERE id = ?', 
                [accountId]
            );
            
            if (!account.length) {
                throw new Error('Account not found');
            }

            const accountData = account[0];
            const sessionPath = path.join('./sessions', `session_${accountId}`);
            
            // Ensure session directory exists
            await fs.ensureDir(sessionPath);
            
            // Initialize auth state with multi-file
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

            const sock = makeWASocket({
                logger: this.logger,
                auth: state,
                printQRInTerminal: false,
                browser: ['Wazper', 'Chrome', '1.0.0']
            });

            // Event handlers
            sock.ev.on('connection.update', async (update) => {
                await this.handleConnectionUpdate(accountId, accountData, update, sock);
            });

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('messages.upsert', async (m) => {
                // Handle incoming messages if needed
                console.log('New messages:', m.messages);
            });

            this.sessions.set(accountId, sock);
            
            // Update account status
            await database.query(
                'UPDATE accounts SET status = "connecting", updated_at = NOW() WHERE id = ?',
                [accountId]
            );

            return sock;
            
        } catch (error) {
            console.error(`Failed to connect account ${accountId}:`, error);
            
            // Update account status to error
            try {
                await database.query(
                    'UPDATE accounts SET status = "error", updated_at = NOW() WHERE id = ?',
                    [accountId]
                );
            } catch (dbError) {
                console.error('Failed to update account status:', dbError);
            }
            
            throw error;
        }
    }

    async handleConnectionUpdate(accountId, accountData, update, sock) {
        const { connection, lastDisconnect, qr } = update;
        
        try {
            if (qr) {
                // Generate QR code
                const qrDataURL = await QRCode.toDataURL(qr);
                
                // Save QR to database
                await database.query(
                    'UPDATE accounts SET qr_code = ?, status = "connecting", updated_at = NOW() WHERE id = ?',
                    [qrDataURL, accountId]
                );
                
                console.log(`QR Code generated for account ${accountId}`);
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    console.log(`Reconnecting account ${accountId}...`);
                    await this.connectAccount(accountId);
                } else {
                    console.log(`Account ${accountId} logged out`);
                    await database.query(
                        'UPDATE accounts SET status = "disconnected", qr_code = NULL, updated_at = NOW() WHERE id = ?',
                        [accountId]
                    );
                    this.sessions.delete(accountId);
                }
            } else if (connection === 'open') {
                console.log(`Account ${accountId} connected successfully`);
                
                // Get user info from WhatsApp
                let detectedPhone = null;
                let accountName = `device-${accountId}`;
                
                try {
                    // Try to get user info
                    const user = sock.user;
                    if (user && user.id) {
                        // Extract phone number from user ID (format: number@s.whatsapp.net)
                        detectedPhone = user.id.split('@')[0];
                        console.log(`Detected phone number: ${detectedPhone}`);
                    }
                } catch (infoError) {
                    console.log('Could not detect phone number automatically');
                }
                
                // Update account with detected info
                await database.query(
                    'UPDATE accounts SET name = ?, phone = ?, status = "connected", qr_code = NULL, last_connected = NOW(), updated_at = NOW() WHERE id = ?',
                    [accountName, detectedPhone, accountId]
                );

                // Log connection activity
                await database.query(
                    'INSERT INTO activity_logs (account_id, action, description) VALUES (?, ?, ?)',
                    [accountId, 'connected', `Account connected successfully${detectedPhone ? ' - Phone: ' + detectedPhone : ''}`]
                );
            }
            
        } catch (error) {
            console.error(`Error handling connection update for account ${accountId}:`, error);
            
            await database.query(
                'UPDATE accounts SET status = "error", updated_at = NOW() WHERE id = ?',
                [accountId]
            );
        }
    }

    async disconnectAccount(accountId) {
        try {
            const sock = this.sessions.get(accountId);
            
            if (sock) {
                await sock.logout();
                this.sessions.delete(accountId);
            }
            
            // Remove store if exists
            if (this.stores && this.stores.has(accountId)) {
                this.stores.delete(accountId);
            }
            
            // Update database
            await database.query(
                'UPDATE accounts SET status = "disconnected", qr_code = NULL, updated_at = NOW() WHERE id = ?',
                [accountId]
            );
            
            console.log(`Account ${accountId} disconnected`);
            
        } catch (error) {
            console.error(`Error disconnecting account ${accountId}:`, error);
            throw error;
        }
    }

    async sendMessage(accountId, phone, message, mediaPath = null) {
        try {
            const sock = this.sessions.get(accountId);
            
            if (!sock) {
                throw new Error('Account not connected');
            }

            // Format phone number
            const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
            
            let messageContent = { text: message };
            
            if (mediaPath) {
                const mediaBuffer = await fs.readFile(mediaPath);
                const mimeType = this.getMimeType(mediaPath);
                
                if (mimeType.startsWith('image/')) {
                    messageContent = {
                        image: mediaBuffer,
                        caption: message
                    };
                } else if (mimeType.startsWith('video/')) {
                    messageContent = {
                        video: mediaBuffer,
                        caption: message
                    };
                } else if (mimeType.startsWith('audio/')) {
                    messageContent = {
                        audio: mediaBuffer,
                        mimetype: mimeType
                    };
                } else {
                    messageContent = {
                        document: mediaBuffer,
                        mimetype: mimeType,
                        fileName: path.basename(mediaPath),
                        caption: message
                    };
                }
            }

            const result = await sock.sendMessage(jid, messageContent);
            
            // Log activity
            await database.query(
                'INSERT INTO activity_logs (account_id, action, description) VALUES (?, ?, ?)',
                [accountId, 'message_sent', `Message sent to ${phone}`]
            );
            
            return result;
            
        } catch (error) {
            console.error(`Error sending message from account ${accountId}:`, error);
            
            // Log error
            await database.query(
                'INSERT INTO activity_logs (account_id, action, description) VALUES (?, ?, ?)',
                [accountId, 'message_failed', `Failed to send message to ${phone}: ${error.message}`]
            );
            
            throw error;
        }
    }

    async sendBulkMessages(campaignId) {
        try {
            const campaign = await database.query(
                `SELECT c.*, a.id as account_id, mt.message_text, mt.media_path 
                 FROM campaigns c 
                 JOIN accounts a ON c.account_id = a.id 
                 JOIN message_templates mt ON c.template_id = mt.id 
                 WHERE c.id = ? AND c.status = 'running'`,
                [campaignId]
            );

            if (!campaign.length) {
                throw new Error('Campaign not found or not running');
            }

            const campaignData = campaign[0];
            const accountId = campaignData.account_id;

            // Get pending messages
            const pendingMessages = await database.query(
                'SELECT * FROM campaign_messages WHERE campaign_id = ? AND status = "pending" ORDER BY id',
                [campaignId]
            );

            let sentCount = 0;
            let failedCount = 0;

            for (const messageData of pendingMessages) {
                try {
                    // Check if campaign is still running
                    const currentCampaign = await database.query(
                        'SELECT status FROM campaigns WHERE id = ?',
                        [campaignId]
                    );

                    if (!currentCampaign.length || currentCampaign[0].status !== 'running') {
                        console.log('Campaign stopped or paused');
                        break;
                    }

                    // Send message
                    await this.sendMessage(
                        accountId,
                        messageData.phone,
                        messageData.message_text,
                        messageData.media_path
                    );

                    // Update message status
                    await database.query(
                        'UPDATE campaign_messages SET status = "sent", sent_at = NOW() WHERE id = ?',
                        [messageData.id]
                    );

                    sentCount++;

                    // Delay between messages
                    await delay(campaignData.delay_seconds * 1000);

                } catch (error) {
                    console.error(`Failed to send message ${messageData.id}:`, error);
                    
                    // Update message status with error
                    await database.query(
                        'UPDATE campaign_messages SET status = "failed", error_message = ? WHERE id = ?',
                        [error.message, messageData.id]
                    );

                    failedCount++;
                }
            }

            // Update campaign statistics
            await database.query(
                'UPDATE campaigns SET sent_count = sent_count + ?, failed_count = failed_count + ? WHERE id = ?',
                [sentCount, failedCount, campaignId]
            );

            // Check if campaign is completed
            const remainingMessages = await database.query(
                'SELECT COUNT(*) as remaining FROM campaign_messages WHERE campaign_id = ? AND status = "pending"',
                [campaignId]
            );

            if (remainingMessages[0].remaining === 0) {
                await database.query(
                    'UPDATE campaigns SET status = "completed", completed_at = NOW() WHERE id = ?',
                    [campaignId]
                );
            }

            return { sentCount, failedCount };

        } catch (error) {
            console.error('Error in bulk message sending:', error);
            
            // Update campaign status to error
            await database.query(
                'UPDATE campaigns SET status = "cancelled" WHERE id = ?',
                [campaignId]
            );
            
            throw error;
        }
    }

    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    getAccountStatus(accountId) {
        const sock = this.sessions.get(accountId);
        return sock ? 'connected' : 'disconnected';
    }

    async disconnectAll() {
        for (const [accountId, sock] of this.sessions) {
            try {
                await sock.logout();
                console.log(`Disconnected account ${accountId}`);
            } catch (error) {
                console.error(`Error disconnecting account ${accountId}:`, error);
            }
        }
        this.sessions.clear();
        this.stores.clear();
    }
}

module.exports = new WhatsAppService();