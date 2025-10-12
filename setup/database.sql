-- Database: wazper_db
-- WhatsApp Blaster Database Schema

CREATE DATABASE IF NOT EXISTS wazper_db;
USE wazper_db;

-- Table untuk menyimpan akun WhatsApp
CREATE TABLE accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NULL UNIQUE,
    status ENUM('disconnected', 'connecting', 'connected', 'reconnecting', 'error') DEFAULT 'disconnected',
    qr_code TEXT NULL,
    session_data LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_connected TIMESTAMP NULL
);

-- Table untuk menyimpan kontak/target blast
CREATE TABLE contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    group_name VARCHAR(100) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_group (group_name)
);

-- Table untuk menyimpan template pesan
CREATE TABLE message_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    message_text TEXT NOT NULL,
    has_media BOOLEAN DEFAULT FALSE,
    media_type ENUM('image', 'document', 'video', 'audio') NULL,
    media_path VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table untuk menyimpan campaign blast
CREATE TABLE campaigns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    account_id INT NOT NULL,
    template_id INT NOT NULL,
    total_targets INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    status ENUM('draft', 'running', 'completed', 'paused', 'cancelled') DEFAULT 'draft',
    delay_seconds INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE CASCADE
);

-- Table untuk menyimpan detail pengiriman per kontak
CREATE TABLE campaign_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT NULL, -- Allow NULL for single messages (not part of campaign)
    contact_id INT NULL,  -- Allow NULL for single messages (not from contact list)
    phone VARCHAR(20) NOT NULL,
    message_text TEXT NULL, -- Allow NULL when only sending media
    media_path VARCHAR(255) NULL,
    media_type ENUM('image', 'document', 'video', 'audio') NULL,
    status ENUM('pending', 'sent', 'failed', 'delivered', 'read') DEFAULT 'pending',
    error_message TEXT NULL,
    sent_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    INDEX idx_campaign_status (campaign_id, status),
    INDEX idx_phone (phone)
);

-- Table untuk menyimpan media files
CREATE TABLE media_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    original_name VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL UNIQUE,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type ENUM('image', 'document', 'video', 'audio') NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_type (file_type)
);

-- Table untuk log aktivitas
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    INDEX idx_account_date (account_id, created_at)
);

-- Insert data sample
INSERT INTO contacts (name, phone, group_name) VALUES 
('John Doe', '6281234567890', 'Group A'),
('Jane Smith', '6289876543210', 'Group A'),
('Bob Johnson', '6285555123456', 'Group B');

INSERT INTO message_templates (name, message_text) VALUES 
('Welcome Message', 'Halo {name}, selamat datang di layanan kami! 🎉'),
('Promo Special', 'Hi {name}! Ada promo spesial hari ini, diskon 50% untuk semua produk! 💰'),
('Reminder', 'Halo {name}, jangan lupa untuk check update terbaru dari kami ya! 📢');