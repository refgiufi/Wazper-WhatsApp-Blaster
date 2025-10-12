// Global variables
let currentSection = 'dashboard';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Setup sidebar navigation
    setupNavigation();
    
    // Setup menu toggle
    setupMenuToggle();
    
    // Load initial data
    loadDashboard();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('Wazper app initialized');
}

function setupNavigation() {
    const navItems = document.querySelectorAll('[data-section]');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.dataset.section;
            switchSection(section);
        });
    });
}

function setupMenuToggle() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar-wrapper');
    
    menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('toggled');
    });
}

function switchSection(section) {
    // Update active nav item
    const navItems = document.querySelectorAll('[data-section]');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === section) {
            item.classList.add('active');
        }
    });
    
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(sec => {
        sec.style.display = 'none';
    });
    
    // Show selected section
    const targetSection = document.getElementById(`${section}-section`);
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('fade-in');
    }
    
    currentSection = section;
    
    // Load section data
    switch(section) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'accounts':
            loadAccounts();
            break;
        case 'contacts':
            loadContacts();
            break;
        case 'templates':
            loadTemplates();
            break;
        case 'campaigns':
            loadCampaigns();
            break;
        case 'media':
            loadMedia();
            break;
        case 'logs':
            loadLogs();
            break;
    }
}

// API helper functions
async function apiCall(endpoint, options = {}) {
    try {
        showLoading();
        const response = await fetch(endpoint, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API call error:', error);
        showAlert('Error: ' + error.message, 'danger');
        throw error;
    } finally {
        hideLoading();
    }
}

function showLoading() {
    document.getElementById('loading-overlay').classList.remove('d-none');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('d-none');
}

function showAlert(message, type = 'info') {
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    // Insert at the top of current section
    const currentSectionEl = document.getElementById(`${currentSection}-section`);
    if (currentSectionEl) {
        currentSectionEl.insertAdjacentHTML('afterbegin', alertHtml);
        
        // Auto dismiss after 5 seconds
        setTimeout(() => {
            const alert = currentSectionEl.querySelector('.alert');
            if (alert) {
                alert.remove();
            }
        }, 5000);
    }
}

// Dashboard functions
async function loadDashboard() {
    try {
        const stats = await apiCall('/api/status');
        
        // Update statistics
        document.getElementById('total-accounts').textContent = stats.accounts.total;
        document.getElementById('connected-accounts').textContent = stats.accounts.connected;
        document.getElementById('active-campaigns').textContent = stats.campaigns.active;
        
        // Load additional stats
        await loadRecentCampaigns();
        await loadAccountStatus();
        
    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

async function loadRecentCampaigns() {
    try {
        const campaigns = await apiCall('/api/campaigns');
        const tbody = document.querySelector('#recent-campaigns-table tbody');
        
        tbody.innerHTML = '';
        
        campaigns.slice(0, 5).forEach(campaign => {
            const progress = campaign.total_targets > 0 ? 
                Math.round((campaign.sent_count / campaign.total_targets) * 100) : 0;
                
            const row = `
                <tr>
                    <td>${campaign.name}</td>
                    <td><span class="campaign-status campaign-${campaign.status}">${campaign.status.toUpperCase()}</span></td>
                    <td>
                        <div class="progress progress-mini">
                            <div class="progress-bar" role="progressbar" style="width: ${progress}%"></div>
                        </div>
                        <small>${campaign.sent_count}/${campaign.total_targets}</small>
                    </td>
                    <td>${formatDate(campaign.created_at)}</td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });
        
    } catch (error) {
        console.error('Failed to load recent campaigns:', error);
    }
}

async function loadAccountStatus() {
    try {
        const accounts = await apiCall('/api/accounts');
        const container = document.getElementById('account-status-list');
        
        container.innerHTML = '';
        
        accounts.forEach(account => {
            const statusClass = `status-${account.status}`;
            const statusIcon = getStatusIcon(account.status);
            
            const item = `
                <div class="d-flex align-items-center mb-2">
                    <i class="${statusIcon} me-2"></i>
                    <div class="flex-grow-1">
                        <div class="fw-bold">${account.name}</div>
                        <small class="text-muted">${account.phone}</small>
                    </div>
                    <span class="status-badge ${statusClass}">${account.status.toUpperCase()}</span>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', item);
        });
        
    } catch (error) {
        console.error('Failed to load account status:', error);
    }
}

// Account functions
async function loadAccounts() {
    try {
        const accounts = await apiCall('/api/accounts');
        const tbody = document.querySelector('#accounts-table tbody');
        
        tbody.innerHTML = '';
        
        accounts.forEach(account => {
            const statusClass = `status-${account.status}`;
            const lastConnected = account.last_connected ? formatDate(account.last_connected) : 'Tidak pernah';
            
            const row = `
                <tr>
                    <td>${account.id}</td>
                    <td>${account.name}</td>
                    <td>${account.phone}</td>
                    <td><span class="status-badge ${statusClass}">${account.status.toUpperCase()}</span></td>
                    <td>${lastConnected}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            ${getAccountActionButtons(account)}
                        </div>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });
        
    } catch (error) {
        console.error('Failed to load accounts:', error);
    }
}

function getAccountActionButtons(account) {
    let buttons = '';
    
    if (account.status === 'disconnected') {
        buttons += `<button class="btn btn-success btn-sm" onclick="connectAccount(${account.id})">
            <i class="fas fa-play"></i> Hubungkan
        </button>`;
    } else if (account.status === 'connected') {
        buttons += `<button class="btn btn-warning btn-sm" onclick="disconnectAccount(${account.id})">
            <i class="fas fa-stop"></i> Putuskan
        </button>`;
    } else if (account.status === 'connecting') {
        buttons += `<button class="btn btn-info btn-sm" onclick="showQRCode(${account.id})">
            <i class="fas fa-qrcode"></i> QR Code
        </button>`;
    }
    
    buttons += ` <button class="btn btn-danger btn-sm" onclick="deleteAccount(${account.id})">
        <i class="fas fa-trash"></i>
    </button>`;
    
    return buttons;
}

// Function untuk membuat akun baru langsung dengan QR Code
async function createNewAccount() {
    try {
        showAlert('Membuat akun WhatsApp baru...', 'info');
        
        // Get current account count to generate device name
        const accounts = await apiCall('/api/accounts');
        const deviceNumber = accounts.length + 1;
        const accountName = `device-${deviceNumber}`;
        const accountPhone = null; // Will be auto-detected after connection
        
        // Create account
        const newAccount = await apiCall('/api/accounts', {
            method: 'POST',
            body: JSON.stringify({ 
                name: accountName, 
                phone: accountPhone 
            })
        });
        
        // Immediately show QR Code for the new account
        const accountId = newAccount.id;
        
        // Connect account first to generate QR
        await apiCall(`/api/accounts/${accountId}/connect`, { method: 'POST' });
        
        // Then show QR modal
        await showQRCode(accountId);
        
    } catch (error) {
        showAlert('Gagal membuat akun: ' + error.message, 'danger');
    }
}

async function addAccount() {
    const name = document.getElementById('accountName').value;
    const phone = document.getElementById('accountPhone').value;
    
    if (!name || !phone) {
        showAlert('Nama dan nomor telepon harus diisi', 'warning');
        return;
    }
    
    try {
        // Create account
        const newAccount = await apiCall('/api/accounts', {
            method: 'POST',
            body: JSON.stringify({ name, phone })
        });
        
        // Close add account modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('addAccountModal'));
        modal.hide();
        document.getElementById('addAccountForm').reset();
        
        showAlert('Akun berhasil ditambahkan. Memulai proses koneksi...', 'success');
        
        // Automatically connect the new account
        const accountId = newAccount.id;
        await connectAccount(accountId, true); // true = show QR immediately
        
    } catch (error) {
        showAlert('Gagal menambahkan akun: ' + error.message, 'danger');
    }
}

async function connectAccount(accountId, showQRImmediately = false) {
    try {
        await apiCall(`/api/accounts/${accountId}/connect`, {
            method: 'POST'
        });
        
        if (showQRImmediately) {
            showAlert('Scan QR Code untuk menghubungkan WhatsApp Anda', 'info');
            // Show QR immediately for new accounts
            setTimeout(() => {
                showQRCode(accountId);
            }, 1000);
        } else {
            showAlert('Proses koneksi dimulai. Silakan scan QR code.', 'info');
            // Refresh accounts and show QR modal after a delay
            setTimeout(() => {
                loadAccounts();
                showQRCode(accountId);
            }, 2000);
        }
        
    } catch (error) {
        showAlert('Gagal menghubungkan akun: ' + error.message, 'danger');
    }
}

async function disconnectAccount(accountId) {
    if (confirm('Apakah Anda yakin ingin memutuskan koneksi akun ini?')) {
        try {
            await apiCall(`/api/accounts/${accountId}/disconnect`, {
                method: 'POST'
            });
            
            showAlert('Akun berhasil diputuskan', 'success');
            loadAccounts();
            
        } catch (error) {
            showAlert('Gagal memutuskan akun: ' + error.message, 'danger');
        }
    }
}

async function deleteAccount(accountId) {
    if (confirm('Apakah Anda yakin ingin menghapus akun ini? Semua data terkait akan hilang.')) {
        try {
            await apiCall(`/api/accounts/${accountId}`, {
                method: 'DELETE'
            });
            
            showAlert('Akun berhasil dihapus', 'success');
            loadAccounts();
            
        } catch (error) {
            showAlert('Gagal menghapus akun: ' + error.message, 'danger');
        }
    }
}

async function showQRCode(accountId) {
    try {
        showAlert('Scan QR Code untuk menghubungkan WhatsApp Anda', 'info');
        
        const modal = new bootstrap.Modal(document.getElementById('qrModal'));
        const container = document.getElementById('qr-container');
        
        // Show loading spinner initially
        container.innerHTML = `
            <div class="d-flex justify-content-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Generating QR Code...</span>
                </div>
            </div>
            <p class="mt-2 text-center text-muted">Generating QR Code...</p>
        `;
        modal.show();
        
        // Function to check and update QR code
        const updateQRCode = async () => {
            try {
                const account = await apiCall(`/api/accounts/${accountId}`);
                
                if (account.status === 'connected') {
                    modal.hide();
                    showAlert('✅ WhatsApp berhasil terhubung!', 'success');
                    loadAccounts(); // Refresh table to show connected account
                    return;
                }
                
                if (account.qr_code) {
                    container.innerHTML = `
                        <img src="${account.qr_code}" alt="QR Code" class="qr-code img-fluid">
                        <div class="mt-2 text-center">
                            <small class="text-muted">Scan dengan WhatsApp Anda</small>
                        </div>
                    `;
                } else if (account.status === 'connecting' || account.status === 'disconnected') {
                    container.innerHTML = `
                        <div class="d-flex justify-content-center">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Waiting for QR Code...</span>
                            </div>
                        </div>
                        <p class="mt-2 text-center text-muted">Menunggu QR Code... (${account.status})</p>
                    `;
                } else if (account.status === 'error') {
                    container.innerHTML = `
                        <div class="text-center text-danger">
                            <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                            <p>Error generating QR Code</p>
                            <button class="btn btn-primary" onclick="location.reload()">Refresh Page</button>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error updating QR code:', error);
                container.innerHTML = `
                    <div class="text-center text-danger">
                        <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                        <p>Error loading QR Code: ${error.message}</p>
                        <button class="btn btn-primary" onclick="updateQRCode()">Try Again</button>
                    </div>
                `;
            }
        };
        
        // Initial QR code load with delay for account connection
        setTimeout(async () => {
            await updateQRCode();
        }, 1000);
        
        // Auto-retry QR load every 3 seconds if no QR found
        let retryCount = 0;
        const maxRetries = 10;
        const retryInterval = setInterval(async () => {
            const account = await apiCall(`/api/accounts/${accountId}`);
            if (account.status === 'connected') {
                clearInterval(retryInterval);
                modal.hide();
                showAlert('✅ WhatsApp berhasil terhubung!', 'success');
                loadAccounts();
            } else if (account.qr_code || retryCount >= maxRetries) {
                clearInterval(retryInterval);
                if (retryCount >= maxRetries && !account.qr_code) {
                    container.innerHTML = `
                        <div class="text-center text-warning">
                            <i class="fas fa-clock fa-3x mb-3"></i>
                            <p>QR Code tidak muncul setelah ${maxRetries} percobaan</p>
                            <button class="btn btn-primary" onclick="updateQRCode()">Coba Lagi</button>
                        </div>
                    `;
                }
            } else {
                retryCount++;
                await updateQRCode();
            }
        }, 3000);
        
        // Clear retry interval when modal is closed
        document.getElementById('qrModal').addEventListener('hidden.bs.modal', () => {
            clearInterval(retryInterval);
        }, { once: true });
        
        // Setup manual refresh button
        document.getElementById('refresh-qr-btn').addEventListener('click', async () => {
            const btn = document.getElementById('refresh-qr-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Refreshing...';
            btn.disabled = true;
            
            await updateQRCode();
            
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 1000);
        });
        
    } catch (error) {
        showAlert('Gagal memuat QR Code: ' + error.message, 'danger');
    }
}

// Function untuk meminta detail akun setelah berhasil connect
// Placeholder functions for other sections
async function loadContacts() {
    // TODO: Implement contacts loading
    console.log('Loading contacts...');
}

async function loadTemplates() {
    // TODO: Implement templates loading
    console.log('Loading templates...');
}

async function loadCampaigns() {
    // TODO: Implement campaigns loading
    console.log('Loading campaigns...');
}

async function loadMedia() {
    // TODO: Implement media loading
    console.log('Loading media...');
}

async function loadLogs() {
    // TODO: Implement logs loading
    console.log('Loading logs...');
}

// Utility functions
function getStatusIcon(status) {
    const icons = {
        connected: 'fas fa-check-circle text-success',
        disconnected: 'fas fa-times-circle text-danger',
        connecting: 'fas fa-spinner fa-spin text-info',
        error: 'fas fa-exclamation-triangle text-warning'
    };
    return icons[status] || 'fas fa-question-circle text-secondary';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function setupEventListeners() {
    // Form submission handlers
    document.getElementById('addAccountForm').addEventListener('submit', function(e) {
        e.preventDefault();
        addAccount();
    });
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        // Cleanup if needed
    });
}