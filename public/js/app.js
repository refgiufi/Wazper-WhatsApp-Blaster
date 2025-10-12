// Global variables
let currentSection = 'dashboard';

// Broadcast control variables
let broadcastState = {
    isRunning: false,
    isPaused: false,
    isStopped: false,
    currentIndex: 0,
    totalRecipients: 0
};

// Add basic test at top level
console.log('app.js loaded successfully');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Backup initialization on window load
window.addEventListener('load', function() {
    console.log('Window loaded, checking if app is initialized...');
    if (typeof window.appInitialized === 'undefined') {
        console.log('App not initialized yet, trying again...');
        initializeApp();
        window.appInitialized = true;
    }
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
    
    console.log('Wazper app initialized successfully');
    window.appInitialized = true;
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
    
    // Check if mobile view
    const isMobile = window.innerWidth <= 768;
    
    // On mobile, start with sidebar closed
    if (isMobile) {
        sidebar.classList.add('toggled');
    }
    
    menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('toggled');
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        const nowMobile = window.innerWidth <= 768;
        if (nowMobile && !isMobile) {
            // Switched to mobile
            sidebar.classList.add('toggled');
        } else if (!nowMobile && isMobile) {
            // Switched to desktop
            sidebar.classList.remove('toggled');
        }
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
        case 'messages':
            loadMessagesPage();
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
        
        // Prepare headers - don't set Content-Type for FormData (browser will set it automatically)
        let headers = {};
        
        // Only set JSON content type if body is not FormData
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        
        // Merge with any custom headers
        if (options.headers) {
            headers = { ...headers, ...options.headers };
        }
        
        const response = await fetch(endpoint, {
            headers: headers,
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
        // Account status check is now manual only
        
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
    
    // Always show Check Status button first
    buttons += `<button class="btn btn-info btn-sm me-1" onclick="checkAccountStatus(${account.id})" title="Cek status akun">
        <i class="fas fa-sync"></i> Cek Status
    </button>`;
    
    if (account.status === 'disconnected' || account.status === 'never_connected') {
        // For disconnected accounts or never connected, "Hubungkan" will show QR for connection
        buttons += `<button class="btn btn-success btn-sm me-1" onclick="manualConnectAccount(${account.id})" title="Hubungkan dengan QR">
            <i class="fas fa-plug"></i> Hubungkan
        </button>`;
    } else if (account.status === 'connected') {
        buttons += `<button class="btn btn-warning btn-sm me-1" onclick="disconnectAccount(${account.id})">
            <i class="fas fa-stop"></i> Putuskan
        </button>`;
    } else if (account.status === 'connecting') {
        buttons += `<button class="btn btn-primary btn-sm me-1" onclick="showQRCode(${account.id})">
            <i class="fas fa-qrcode"></i> Lihat QR
        </button>`;
        buttons += `<button class="btn btn-secondary btn-sm me-1" onclick="forceReconnectAccount(${account.id})" title="Generate QR baru">
            <i class="fas fa-redo"></i> QR Baru
        </button>`;
    }
    
    buttons += `<button class="btn btn-danger btn-sm" onclick="deleteAccount(${account.id})" title="Hapus akun">
        <i class="fas fa-trash"></i>
    </button>`;
    
    return buttons;
}

// Manually connect account
async function manualConnectAccount(accountId) {
    try {
        showAlert('🔄 Menghubungkan kembali akun WhatsApp...', 'info');
        
        // For disconnected accounts, use force-reconnect to ensure fresh QR generation
        console.log('Manual reconnect - using force-reconnect for guaranteed QR generation');
        
        const response = await apiCall(`/api/accounts/${accountId}/force-reconnect`, {
            method: 'POST'
        });
        
        if (response.success || response.message) {
            showAlert('✅ Proses reconnect dimulai! QR Code akan muncul segera...', 'success');
            
            // Show QR modal immediately
            setTimeout(() => {
                console.log('Showing QR modal after force-reconnect');
                showQRCode(accountId);
            }, 2000); // Give more time for force-reconnect to generate QR
            
        } else {
            showAlert('❌ Gagal memulai koneksi. Silakan coba lagi.', 'danger');
        }
        
        // No auto-refresh to prevent blinking - user can manually refresh if needed
        
    } catch (error) {
        console.error('Error connecting account:', error);
        showAlert('❌ Error saat menghubungkan akun: ' + error.message, 'danger');
    }
}

// Check individual account status manually
async function checkAccountStatus(accountId) {
    try {
        showAlert('Mengecek status akun...', 'info');
        
        const account = await apiCall(`/api/accounts/${accountId}`);
        
        const statusText = {
            'connected': '✅ Terhubung',
            'disconnected': '❌ Terputus',
            'connecting': '🔄 Menghubungkan...'
        }[account.status] || account.status;
        
        showAlert(`Status akun ${account.name}: ${statusText}`, 
                  account.status === 'connected' ? 'success' : 
                  account.status === 'connecting' ? 'warning' : 'danger');
        
        // Refresh the accounts table to show updated status
        await loadAccounts();
        
    } catch (error) {
        console.error('Error checking account status:', error);
        showAlert('Gagal mengecek status akun: ' + error.message, 'danger');
    }
}

// Check all accounts status manually
async function checkAllAccountsStatus() {
    try {
        showAlert('Mengecek status semua akun...', 'info');
        
        const accounts = await apiCall('/api/accounts');
        
        let connected = 0;
        let disconnected = 0;
        let connecting = 0;
        
        // Count statuses
        accounts.forEach(account => {
            if (account.status === 'connected') connected++;
            else if (account.status === 'disconnected') disconnected++;
            else if (account.status === 'connecting') connecting++;
        });
        
        const total = accounts.length;
        let message = `Status Akun - Total: ${total} | ✅ ${connected} Terhubung | ❌ ${disconnected} Terputus`;
        if (connecting > 0) {
            message += ` | 🔄 ${connecting} Menghubungkan`;
        }
        
        const alertType = connected === total ? 'success' : 
                         disconnected === total ? 'danger' : 'warning';
        
        showAlert(message, alertType);
        
        // Refresh the accounts table to show updated status
        await loadAccounts();
        
    } catch (error) {
        console.error('Error checking all accounts status:', error);
        showAlert('Gagal mengecek status akun: ' + error.message, 'danger');
    }
}

// Function untuk membuat akun baru langsung dengan QR Code
async function createNewAccount() {
    console.log('CreateNewAccount called');
    try {
        showAlert('Membuat akun WhatsApp baru...', 'info');
        
        console.log('Getting accounts for device numbering...');
        // Get current account count to generate device name
        const accounts = await apiCall('/api/accounts');
        const deviceNumber = accounts.length + 1;
        const accountName = `device-${deviceNumber}`;
        const accountPhone = null; // Will be auto-detected after connection
        
        console.log('Creating account:', { name: accountName, phone: accountPhone });
        
        // Create account
        const newAccount = await apiCall('/api/accounts', {
            method: 'POST',
            body: JSON.stringify({ 
                name: accountName, 
                phone: accountPhone 
            })
        });
        
        console.log('Account created:', newAccount);
        
        // Immediately show QR Code for the new account
        const accountId = newAccount.id;
        
        console.log('Connecting account:', accountId);
        // Connect account first to generate QR
        await apiCall(`/api/accounts/${accountId}/connect`, { method: 'POST' });
        
        console.log('Showing QR Code...');
        // Then show QR modal
        await showQRCode(accountId);
        
    } catch (error) {
        console.error('CreateNewAccount error:', error);
        showAlert('Gagal membuat akun: ' + error.message, 'danger');
    }
}

async function addAccount() {
    console.log('AddAccount called');
    const name = document.getElementById('accountName').value;
    const phone = document.getElementById('accountPhone').value;
    
    console.log('Form values:', { name, phone });
    
    if (!name || !phone) {
        showAlert('Nama dan nomor telepon harus diisi', 'warning');
        return;
    }
    
    try {
        console.log('Creating account...');
        // Create account
        const newAccount = await apiCall('/api/accounts', {
            method: 'POST',
            body: JSON.stringify({ name, phone })
        });
        
        console.log('Account created:', newAccount);
        
        // Close add account modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('addAccountModal'));
        modal.hide();
        document.getElementById('addAccountForm').reset();
        
        showAlert('Akun berhasil ditambahkan. Memulai proses koneksi...', 'success');
        
        // Automatically connect the new account
        const accountId = newAccount.id;
        console.log('Connecting account:', accountId);
        await connectAccount(accountId, true); // true = show QR immediately
        
    } catch (error) {
        console.error('AddAccount error:', error);
        showAlert('Gagal menambahkan akun: ' + error.message, 'danger');
    }
}

async function connectAccount(accountId, showQRImmediately = false) {
    console.log('ConnectAccount called for ID:', accountId, 'showQRImmediately:', showQRImmediately);
    try {
        console.log('Calling connect API...');
        await apiCall(`/api/accounts/${accountId}/connect`, {
            method: 'POST'
        });
        
        console.log('Connect API success');
        
        if (showQRImmediately) {
            showAlert('Scan QR Code untuk menghubungkan WhatsApp Anda', 'info');
            console.log('Showing QR immediately in 1 second...');
            // Show QR immediately for new accounts
            setTimeout(() => {
                console.log('Calling showQRCode now');
                showQRCode(accountId);
            }, 1000);
        } else {
            showAlert('Proses koneksi dimulai. Silakan scan QR code.', 'info');
            console.log('Showing QR after delay...');
            // Show QR modal after a delay without excessive refresh
            setTimeout(() => {
                showQRCode(accountId);
            }, 2000);
        }
        
    } catch (error) {
        console.error('ConnectAccount error:', error);
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
            // No auto-refresh - user can manually refresh if needed
            
        } catch (error) {
            showAlert('Gagal memutuskan akun: ' + error.message, 'danger');
        }
    }
}

async function forceReconnectAccount(accountId) {
    const confirmation = confirm(
        'Force reconnect akan menghapus semua data session dan membuat QR code baru.\n\n' +
        'Ini akan memaksa WhatsApp untuk logout dari perangkat dan memerlukan scan QR baru.\n\n' +
        'Lanjutkan?'
    );
    
    if (confirmation) {
        try {
            showAlert('Memulai force reconnection... Mohon tunggu', 'info');
            
            const response = await apiCall(`/api/accounts/${accountId}/force-reconnect`, {
                method: 'POST'
            });
            
            showAlert(response.message || 'Force reconnection berhasil dimulai', 'success');
            
            // Show QR code modal after a delay to allow backend processing  
            setTimeout(() => {
                loadAccounts(); // Single refresh after processing
                showQRCode(accountId);
            }, 2000);
            
        } catch (error) {
            console.error('Force reconnect error:', error);
            showAlert('Gagal melakukan force reconnect: ' + error.message, 'danger');
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
            // No auto-refresh - user can manually refresh if needed
            
        } catch (error) {
            showAlert('Gagal menghapus akun: ' + error.message, 'danger');
        }
    }
}

// Global variable to track QR intervals
let currentStatusInterval = null;

async function showQRCode(accountId) {
    console.log('ShowQRCode called for ID:', accountId);
    
    try {
        showAlert('Scan QR Code untuk menghubungkan WhatsApp Anda', 'info');
        
        const modalEl = document.getElementById('qrModal');
        const container = document.getElementById('qr-container');
        
        if (!modalEl || !container) {
            console.error('Modal elements not found!');
            showAlert('Error: Modal elements tidak ditemukan', 'danger');
            return;
        }
        
        if (typeof bootstrap === 'undefined') {
            console.error('Bootstrap not loaded!');
            alert('Bootstrap tidak ter-load! Silakan refresh halaman.');
            return;
        }
        
        const modal = new bootstrap.Modal(modalEl);
        
        // Function to update QR code - prevent unnecessary UI updates
        let lastStatus = '';
        let lastQRCode = '';
        
        const updateQRCode = async () => {
            try {
                console.log(`Checking account ${accountId} status...`);
                const account = await apiCall(`/api/accounts/${accountId}`);
                console.log(`Account ${accountId} status:`, account.status, 'QR available:', !!account.qr_code);
                
                // Prevent blinking by only updating UI when something actually changed
                if (account.status === lastStatus && account.qr_code === lastQRCode) {
                    console.log('No changes detected, skipping UI update');
                    return;
                }
                
                lastStatus = account.status;
                lastQRCode = account.qr_code;
                
                if (account.status === 'connected') {
                    modal.hide();
                    showAlert('✅ WhatsApp berhasil terhubung!', 'success');
                    // No auto-refresh to prevent blinking
                    return;
                }
                
                if (account.qr_code) {
                    console.log(`✅ Displaying QR code for account ${accountId}`);
                    container.innerHTML = `
                        <img src="${account.qr_code}" alt="QR Code" class="qr-code img-fluid">
                        <div class="mt-2 text-center">
                            <small class="text-muted">Scan dengan WhatsApp Anda</small>
                        </div>
                    `;
                } else if (account.status === 'connecting' || account.status === 'disconnected') {
                    console.log(`⏳ Still waiting for QR code. Status: ${account.status}`);
                    container.innerHTML = `
                        <div class="d-flex justify-content-center">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Waiting for QR Code...</span>
                            </div>
                        </div>
                        <p class="mt-2 text-center text-muted">Menunggu QR Code... (${account.status})</p>
                        <div class="mt-2 text-center">
                            <button class="btn btn-sm btn-outline-primary" onclick="updateQRCode()">🔄 Refresh</button>
                        </div>
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
        
        // Show loading initially
        container.innerHTML = `
            <div class="d-flex justify-content-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Generating QR Code...</span>
                </div>
            </div>
            <p class="mt-2 text-center text-muted">Generating QR Code...</p>
        `;
        
        // Show modal
        modal.show();
        
        // Setup manual refresh button
        const refreshBtn = document.getElementById('refresh-qr-btn');
        const checkStatusBtn = document.getElementById('check-status-btn');
        
        if (refreshBtn) {
            refreshBtn.onclick = async function() {
                const originalText = refreshBtn.innerHTML;
                refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Refreshing...';
                refreshBtn.disabled = true;
                
                container.innerHTML = `
                    <div class="d-flex justify-content-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Refreshing QR Code...</span>
                        </div>
                    </div>
                    <p class="mt-2 text-center text-muted">Refreshing QR Code...</p>
                `;
                
                await updateQRCode();
                
                setTimeout(() => {
                    refreshBtn.innerHTML = originalText;
                    refreshBtn.disabled = false;
                }, 1000);
            };
        }
        
        if (checkStatusBtn) {
            checkStatusBtn.onclick = async function() {
                const originalText = checkStatusBtn.innerHTML;
                checkStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Checking...';
                checkStatusBtn.disabled = true;
                
                try {
                    const account = await apiCall(`/api/accounts/${accountId}`);
                    if (account.status === 'connected') {
                        modal.hide();
                        showAlert('✅ WhatsApp berhasil terhubung!', 'success');
                        setTimeout(() => loadAccounts(), 1000);
                    } else {
                        showAlert(`Status saat ini: ${account.status.toUpperCase()}`, 'info');
                        await updateQRCode();
                    }
                } catch (error) {
                    showAlert('Error checking status: ' + error.message, 'danger');
                }
                
                setTimeout(() => {
                    checkStatusBtn.innerHTML = originalText;
                    checkStatusBtn.disabled = false;
                }, 1000);
            };
        }
        
        // Initial QR code load
        await updateQRCode();
        
        // Set up smart polling - avoid blinking by checking status first
        let pollCount = 0;
        let hasQRCode = false;
        const maxPolls = 20; // Reduced to 40 seconds
        
        const pollInterval = setInterval(async () => {
            try {
                pollCount++;
                console.log(`Poll #${pollCount} for account ${accountId}`);
                
                const account = await apiCall(`/api/accounts/${accountId}`);
                
                if (account.status === 'connected') {
                    clearInterval(pollInterval);
                    modal.hide();
                    showAlert('✅ WhatsApp berhasil terhubung!', 'success');
                    // No auto-refresh to prevent blinking
                    return;
                } 
                
                if (account.qr_code && !hasQRCode) {
                    // QR code found for first time
                    hasQRCode = true;
                    clearInterval(pollInterval);
                    console.log('✅ QR Code found! Displaying...');
                    await updateQRCode();
                    
                    // Start connection monitoring (much less frequent to prevent blinking)
                    const connectInterval = setInterval(async () => {
                        try {
                            const updatedAccount = await apiCall(`/api/accounts/${accountId}`);
                            if (updatedAccount.status === 'connected') {
                                clearInterval(connectInterval);
                                modal.hide();
                                showAlert('✅ WhatsApp berhasil terhubung!', 'success');
                                // No auto-refresh to prevent blinking
                            }
                        } catch (error) {
                            console.error('Connection monitoring error:', error);
                            clearInterval(connectInterval);
                        }
                    }, 5000); // Reduced frequency - check every 5 seconds to prevent blinking
                    
                    return;
                }
                
                if (pollCount >= maxPolls && !hasQRCode) {
                    clearInterval(pollInterval);
                    console.log('❌ Max polling reached, stopping...');
                    container.innerHTML = `
                        <div class="text-center text-warning">
                            <i class="fas fa-clock fa-3x mb-3"></i>
                            <p>QR Code generation timeout</p>
                            <button class="btn btn-primary" onclick="manualConnectAccount(${accountId})">Try Again</button>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 3000); // Reduced frequency - poll every 3 seconds to prevent blinking
        
        // Clear interval when modal is hidden
        modalEl.addEventListener('hidden.bs.modal', () => {
            clearInterval(pollInterval);
        });
        
    } catch (error) {
        console.error('Error in showQRCode:', error);
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

// ========================= MESSAGING FUNCTIONS =========================

async function loadMessagesPage() {
    try {
        // Load connected accounts for dropdown
        const accounts = await apiCall('/api/accounts');
        const connectedAccounts = accounts.filter(acc => acc.status === 'connected');
        
        const fromAccountSelect = document.getElementById('fromAccount');
        fromAccountSelect.innerHTML = '<option value="">Pilih akun WhatsApp...</option>';
        
        connectedAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.name} (${account.phone || 'Unknown'})`;
            fromAccountSelect.appendChild(option);
        });
        
        if (connectedAccounts.length === 0) {
            showAlert('Tidak ada akun WhatsApp yang terhubung. Silakan hubungkan akun terlebih dahulu.', 'warning');
        }
        
    } catch (error) {
        console.error('Error loading messages page:', error);
        showAlert('Error loading messages page: ' + error.message, 'danger');
    }
}

async function sendMessage() {
    try {
        const fromAccount = document.getElementById('fromAccount').value;
        const recipientsText = document.getElementById('recipients').value;
        const messageTemplate = document.getElementById('messageText').value;
        const mediaFile = document.getElementById('mediaFile').files[0];
        const isScheduled = document.getElementById('scheduleMessage').checked;
        
        // Parse recipients
        const recipientData = parseRecipients(recipientsText);
        
        // Validate required fields
        if (!fromAccount || recipientData.length === 0 || (!messageTemplate.trim() && !mediaFile)) {
            showAlert('Mohon lengkapi field yang diperlukan (dari akun, penerima, dan pesan atau media)', 'warning');
            return;
        }
        
        // Validate phone number format
        const phoneRegex = /^[0-9]{10,15}$/;
        const invalidNumbers = recipientData.filter(r => !phoneRegex.test(r.phone));
        if (invalidNumbers.length > 0) {
            const invalidPhones = invalidNumbers.map(r => r.phone).join(', ');
            showAlert(`Format nomor tidak valid: ${invalidPhones}. Gunakan format: 628123456789`, 'warning');
            return;
        }
        
        // Check for mail merge usage
        const hasMailMerge = messageTemplate.includes('{text');
        const hasMailMergeData = recipientData.some(r => r.hasData);
        
        if (hasMailMerge && !hasMailMergeData) {
            showAlert('Anda menggunakan template {text1}, {text2} tapi tidak ada data mail merge. Format: 628123456,nama', 'warning');
            return;
        }
        
        // Confirm bulk send
        if (recipientData.length > 1) {
            let confirmMsg = `Anda akan mengirim pesan ke ${recipientData.length} penerima.`;
            if (hasMailMerge) {
                confirmMsg += ' Pesan akan dipersonalisasi untuk setiap penerima.';
            }
            confirmMsg += ' Lanjutkan?';
            
            const confirmed = confirm(confirmMsg);
            if (!confirmed) return;
        }
        
        // Initialize broadcast state
        broadcastState = {
            isRunning: true,
            isPaused: false,
            isStopped: false,
            currentIndex: 0,
            totalRecipients: recipientData.length
        };
        
        // Disable entire form during broadcast
        disableBroadcastForm(true);
        
        // Clear and setup results display for real-time updates
        console.log('🔧 Setting up real-time results display...');
        setupRealTimeResults();
        console.log('✅ Real-time setup complete');
        
        // Show loading state and control buttons
        const submitBtn = document.querySelector('#sendMessageForm button[type="submit"]');
        const controlButtons = document.getElementById('controlButtons');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>Mengirim ke ${recipientData.length} penerima...`;
        submitBtn.disabled = true;
        
        // Show pause/stop buttons
        if (controlButtons) {
            controlButtons.style.display = 'flex';
        }
        
        // Validate schedule if needed
        let scheduleDateTime = null;
        if (isScheduled) {
            const scheduleDate = document.getElementById('scheduleDate').value;
            const scheduleTime = document.getElementById('scheduleTime').value;
            
            if (!scheduleDate || !scheduleTime) {
                showAlert('Mohon tentukan tanggal dan waktu untuk pesan terjadwal', 'warning');
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                return;
            }
            
            scheduleDateTime = `${scheduleDate} ${scheduleTime}`;
        }
        
        // Get delay settings
        const delayMin = parseInt(document.getElementById('delayMin').value) || 10;
        const delayMax = parseInt(document.getElementById('delayMax').value) || 30;
        
        // Send messages to all recipients with mail merge
        const results = await sendBulkMessagesWithMerge(fromAccount, recipientData, messageTemplate, mediaFile, scheduleDateTime, delayMin, delayMax);
        
        // Show results
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        let message = `✅ Berhasil mengirim ke ${successful} penerima`;
        if (failed > 0) {
            message += `, gagal ${failed} penerima`;
        }
        
        showAlert(message, successful > 0 ? 'success' : 'danger');
        
        // Update final summary
        const resultsBox = document.getElementById('sendResults');
        const finalStatus = broadcastState.isStopped ? 
            `🛑 Broadcast dihentikan (${successful}/${recipientData.length})` : 
            `✅ Broadcast selesai! (${successful}/${recipientData.length})`;
            
        if (resultsBox) {
            resultsBox.insertAdjacentHTML('beforeend', `
                <div class="py-2 px-3 mt-2 bg-info text-white rounded text-center">
                    <strong>${finalStatus}</strong>
                </div>
            `);
            
            // Auto scroll to bottom
            const parentContainer = resultsBox.parentElement;
            if (parentContainer) {
                parentContainer.scrollTop = parentContainer.scrollHeight;
            }
        }
        
        // Show final status
        if (broadcastState.isStopped) {
            showAlert(`🛑 Broadcast dihentikan. Terkirim: ${successful}/${recipientData.length}`, 'warning');
        } else {
            showAlert('✅ Broadcast selesai!', 'success');
        }
        
        // Reset form
        document.getElementById('sendMessageForm').reset();
        document.getElementById('messagePreview').textContent = 'Preview pesan akan muncul di sini...';
        document.getElementById('charCount').textContent = '0';
        clearMediaSelection();
        
        // Reset broadcast UI
        resetBroadcastUI();
        
    } catch (error) {
        console.error('Error sending message:', error);
        showAlert('Error mengirim pesan: ' + error.message, 'danger');
        
        // Reset UI on error
        resetBroadcastUI();
    }
}

// Send messages to multiple recipients with mail merge
async function sendBulkMessagesWithMerge(fromAccount, recipientData, messageTemplate, mediaFile, scheduleDateTime, delayMin = 10, delayMax = 30) {
    const results = [];
    
    for (let i = 0; i < recipientData.length; i++) {
        // Check if broadcast was stopped
        if (broadcastState.isStopped) {
            console.log('🛑 Broadcast stopped by user');
            break;
        }
        
        // Handle pause state
        while (broadcastState.isPaused) {
            const submitBtn = document.querySelector('#sendMessageForm button[type="submit"]');
            submitBtn.innerHTML = `<i class="fas fa-pause me-2"></i>Di-pause... (${i}/${recipientData.length})`;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Check every second
        }
        
        // Update current index
        broadcastState.currentIndex = i;
        const recipient = recipientData[i];
        
        let currentResult;
        
        try {
            // Update progress
            const submitBtn = document.querySelector('#sendMessageForm button[type="submit"]');
            submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>Mengirim ${i + 1}/${recipientData.length}...`;
            
            // Process message template for this recipient
            const personalizedMessage = processMessageTemplate(messageTemplate, recipient);
            
            let result;
            
            if (mediaFile) {
                // Send with media using individual API calls
                const formData = new FormData();
                formData.append('fromAccountId', fromAccount);
                formData.append('toNumber', recipient.phone);
                formData.append('message', personalizedMessage.trim());
                formData.append('media', mediaFile);
                
                if (scheduleDateTime) {
                    formData.append('scheduledAt', scheduleDateTime);
                }
                
                result = await apiCall('/api/messages/send-media', {
                    method: 'POST',
                    body: formData
                });
            } else {
                // Send text-only message
                const messageData = {
                    fromAccountId: fromAccount,
                    toNumber: recipient.phone,
                    message: personalizedMessage.trim()
                };
                
                if (scheduleDateTime) {
                    messageData.scheduledAt = scheduleDateTime;
                }
                
                result = await apiCall('/api/messages/send', {
                    method: 'POST',
                    body: JSON.stringify(messageData)
                });
            }
            
            currentResult = {
                number: recipient.phone,
                success: true,
                result: result,
                personalizedMessage: personalizedMessage
            };
            
            results.push(currentResult);
            
        } catch (error) {
            console.error(`Error sending to ${recipient.phone}:`, error);
            currentResult = {
                number: recipient.phone,
                success: false,
                error: error.message
            };
            results.push(currentResult);
        }
        
        // Add result to real-time display immediately
        addRealTimeResult(currentResult, i, recipientData.length);
        
        // Add random delay between sends (except for the last one)
        if (i < recipientData.length - 1 && !broadcastState.isStopped) {
            const randomDelay = Math.floor(Math.random() * (delayMax - delayMin + 1) + delayMin) * 1000; // Convert to milliseconds
            console.log(`⏱️ Waiting ${randomDelay/1000}s before next message...`);
            
            // Update button to show waiting status
            const submitBtn = document.querySelector('#sendMessageForm button[type="submit"]');
            let countdown = Math.floor(randomDelay / 1000);
            
            const countdownInterval = setInterval(() => {
                // Check if stopped during countdown
                if (broadcastState.isStopped) {
                    clearInterval(countdownInterval);
                    return;
                }
                
                // Check if paused during countdown
                if (broadcastState.isPaused) {
                    submitBtn.innerHTML = `<i class="fas fa-pause me-2"></i>Di-pause saat delay... (${i + 1}/${recipientData.length})`;
                    return;
                }
                
                submitBtn.innerHTML = `<i class="fas fa-clock me-2"></i>Tunggu ${countdown}s... (${i + 1}/${recipientData.length})`;
                countdown--;
                if (countdown < 0) {
                    clearInterval(countdownInterval);
                }
            }, 1000);
            
            // Wait with pause/stop checking
            for (let delayCount = 0; delayCount < randomDelay / 100; delayCount++) {
                if (broadcastState.isStopped) break;
                
                // If paused, wait until resumed
                while (broadcastState.isPaused && !broadcastState.isStopped) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                if (!broadcastState.isStopped) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            clearInterval(countdownInterval);
        }
    }
    
    return results;
}

function updateMessagePreview() {
    const messageText = document.getElementById('messageText').value;
    const preview = document.getElementById('messagePreview');
    
    if (messageText.trim()) {
        preview.textContent = messageText;
        preview.classList.remove('text-muted');
        preview.classList.add('text-dark');
    } else {
        preview.textContent = 'Preview pesan akan muncul di sini...';
        preview.classList.remove('text-dark');
        preview.classList.add('text-muted');
    }
}

function updateCharCount() {
    const messageText = document.getElementById('messageText').value;
    const charCount = document.getElementById('charCount');
    const length = messageText.length;
    
    charCount.textContent = length;
    
    // Color coding for character count
    if (length > 1000) {
        charCount.className = 'text-danger fw-bold';
    } else if (length > 500) {
        charCount.className = 'text-warning fw-bold';
    } else {
        charCount.className = 'text-success';
    }
}

function insertTemplate(type) {
    const messageTextArea = document.getElementById('messageText');
    let template = '';
    
    switch(type) {
        case 'greeting':
            template = 'Halo! Selamat pagi/siang/sore. Semoga hari Anda menyenangkan! 😊';
            break;
        case 'promo':
            template = '🎉 PROMO SPESIAL! Dapatkan diskon hingga 50% untuk semua produk pilihan. Jangan sampai terlewat! Periode terbatas. Info lengkap: [link]';
            break;
        case 'reminder':
            template = '⏰ Pengingat: Jangan lupa untuk [kegiatan/event]. Waktu: [tanggal dan waktu]. Terima kasih!';
            break;
        case 'thanks':
            template = '🙏 Terima kasih banyak atas kepercayaan Anda. Kami sangat menghargai dukungan Anda. Semoga hari Anda berkah!';
            break;
    }
    
    messageTextArea.value = template;
    messageTextArea.focus();
    updateMessagePreview();
    updateCharCount();
}

// Media upload functions
function handleMediaSelection() {
    const fileInput = document.getElementById('mediaFile');
    const file = fileInput.files[0];
    
    if (file) {
        // Validate file size (max 16MB for WhatsApp)
        const maxSize = 16 * 1024 * 1024; // 16MB
        if (file.size > maxSize) {
            showAlert('File terlalu besar. Maksimal 16MB untuk WhatsApp.', 'warning');
            fileInput.value = '';
            return;
        }
        
        // Show media preview
        displayMediaPreview(file);
        
        // Update form validation
        updateFormValidation();
    }
}

function displayMediaPreview(file) {
    const mediaPreview = document.getElementById('mediaPreview');
    const mediaIcon = document.getElementById('mediaIcon');
    const mediaName = document.getElementById('mediaName');
    const mediaSize = document.getElementById('mediaSize');
    
    // Get file icon based on type
    let iconClass = 'fas fa-file';
    if (file.type.startsWith('image/')) {
        iconClass = 'fas fa-image text-success';
    } else if (file.type.startsWith('video/')) {
        iconClass = 'fas fa-video text-primary';
    } else if (file.type.startsWith('audio/')) {
        iconClass = 'fas fa-music text-info';
    } else if (file.type.includes('pdf')) {
        iconClass = 'fas fa-file-pdf text-danger';
    } else if (file.type.includes('document') || file.type.includes('word')) {
        iconClass = 'fas fa-file-word text-primary';
    }
    
    mediaIcon.innerHTML = `<i class="${iconClass} fa-2x"></i>`;
    mediaName.textContent = file.name;
    mediaSize.textContent = formatFileSize(file.size);
    
    mediaPreview.style.display = 'block';
}

function clearMediaSelection() {
    const fileInput = document.getElementById('mediaFile');
    const mediaPreview = document.getElementById('mediaPreview');
    
    fileInput.value = '';
    mediaPreview.style.display = 'none';
    
    // Update form validation
    updateFormValidation();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateFormValidation() {
    const messageText = document.getElementById('messageText').value.trim();
    const mediaFile = document.getElementById('mediaFile').files[0];
    
    // Either message text OR media file is required
    const messageTextArea = document.getElementById('messageText');
    
    if (mediaFile) {
        // If media is selected, message text becomes optional
        messageTextArea.required = false;
        messageTextArea.placeholder = 'Caption untuk media (opsional)...';
    } else {
        // If no media, message text is required
        messageTextArea.required = true;
        messageTextArea.placeholder = 'Tulis pesan Anda di sini...';
    }
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
    
    // Message form handler
    const sendMessageForm = document.getElementById('sendMessageForm');
    if (sendMessageForm) {
        sendMessageForm.addEventListener('submit', function(e) {
            e.preventDefault();
            sendMessage();
        });
    }
    
    // Message text change handler for preview
    const messageTextArea = document.getElementById('messageText');
    if (messageTextArea) {
        messageTextArea.addEventListener('input', function() {
            updateMessagePreview();
            updateCharCount();
        });
    }
    
    // Schedule message checkbox
    const scheduleCheckbox = document.getElementById('scheduleMessage');
    if (scheduleCheckbox) {
        scheduleCheckbox.addEventListener('change', function() {
            document.getElementById('scheduleOptions').style.display = 
                this.checked ? 'block' : 'none';
        });
    }
    
    // Media upload handlers
    const mediaFileInput = document.getElementById('mediaFile');
    const clearMediaBtn = document.getElementById('clearMedia');
    const mediaPreview = document.getElementById('mediaPreview');
    
    if (mediaFileInput) {
        mediaFileInput.addEventListener('change', handleMediaSelection);
    }
    
    if (clearMediaBtn) {
        clearMediaBtn.addEventListener('click', clearMediaSelection);
    }
    
    // Setup recipient handlers
    setupRecipientHandlers();
    
    // Setup delay handlers
    setupDelayHandlers();
    
    // Setup broadcast control handlers
    setupBroadcastControls();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        // Cleanup if needed
    });
}

// Setup recipient handlers
function setupRecipientHandlers() {
    const recipients = document.getElementById('recipients');
    const recipientCount = document.getElementById('recipientCount');

    if (!recipients || !recipientCount) return; // Not on messages page

    // Count recipients and validate format
    recipients.addEventListener('input', function() {
        const recipientData = parseRecipients(this.value);
        recipientCount.textContent = `${recipientData.length} penerima terdeteksi`;
        
        if (recipientData.length > 0) {
            recipientCount.classList.remove('text-danger');
            recipientCount.classList.add('text-primary');
        } else {
            recipientCount.classList.remove('text-primary');
            recipientCount.classList.add('text-danger');
        }
    });
}

// Setup delay handlers
function setupDelayHandlers() {
    const delayMin = document.getElementById('delayMin');
    const delayMax = document.getElementById('delayMax');
    const delayDisplay = document.getElementById('delayDisplay');

    if (!delayMin || !delayMax || !delayDisplay) return; // Not on messages page

    function updateDelayDisplay() {
        const min = parseInt(delayMin.value) || 10;
        const max = parseInt(delayMax.value) || 30;
        
        // Ensure min <= max
        if (min > max) {
            delayMax.value = min;
        }
        
        delayDisplay.textContent = `${min}-${Math.max(min, max)}`;
    }

    // Update display on input change
    delayMin.addEventListener('input', updateDelayDisplay);
    delayMax.addEventListener('input', updateDelayDisplay);
    
    // Initial update
    updateDelayDisplay();
}

// Setup broadcast control handlers
function setupBroadcastControls() {
    const pauseButton = document.getElementById('pauseButton');
    const stopButton = document.getElementById('stopButton');
    
    if (!pauseButton || !stopButton) return; // Not on messages page
    
    // Pause button handler
    pauseButton.addEventListener('click', function() {
        if (broadcastState.isPaused) {
            // Resume
            broadcastState.isPaused = false;
            this.innerHTML = '<i class="fas fa-pause me-2"></i>Pause';
            this.classList.remove('btn-success');
            this.classList.add('btn-warning');
            showAlert('Broadcast dilanjutkan', 'info');
        } else {
            // Pause
            broadcastState.isPaused = true;
            this.innerHTML = '<i class="fas fa-play me-2"></i>Resume';
            this.classList.remove('btn-warning');
            this.classList.add('btn-success');
            showAlert('Broadcast di-pause', 'warning');
        }
    });
    
    // Stop button handler
    stopButton.addEventListener('click', function() {
        if (confirm('Yakin ingin menghentikan broadcast? Proses tidak bisa dilanjutkan.')) {
            broadcastState.isStopped = true;
            broadcastState.isPaused = false;
            showAlert('Broadcast dihentikan oleh user', 'danger');
            resetBroadcastUI();
        }
    });
}

// Disable form during broadcast
function disableBroadcastForm(disable = true) {
    const form = document.getElementById('sendMessageForm');
    if (!form) return;
    
    // Get all form elements
    const formElements = form.querySelectorAll('input, textarea, select, button');
    
    formElements.forEach(element => {
        element.disabled = disable;
    });
    
    // Always keep control buttons enabled during broadcast
    if (disable) {
        const controlButtons = ['pauseButton', 'stopButton'];
        controlButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = false;
        });
    }
    
    console.log(`📝 Form ${disable ? 'disabled' : 'enabled'} during broadcast`);
}

// Setup real-time results display
function setupRealTimeResults() {
    const resultsBox = document.getElementById('sendResults');
    const summaryBox = document.getElementById('sendSummary');
    
    if (!resultsBox) {
        console.error('sendResults element not found');
        return;
    }
    
    // Clear and setup results container
    resultsBox.innerHTML = `
        <div class="text-muted text-center py-3">
            <i class="fas fa-hourglass-start me-1"></i>
            Menunggu pengiriman dimulai...
        </div>
    `;
    
    // Setup summary
    if (summaryBox) {
        summaryBox.innerHTML = 'Siap mengirim';
    }
    
    console.log('✅ Real-time results display setup complete');
}

// Add single result to real-time display
function addRealTimeResult(result, index, total) {
    const resultsBox = document.getElementById('sendResults');
    if (!resultsBox) {
        console.error('sendResults element not found for real-time update');
        return;
    }
    
    // Clear waiting message on first result
    if (index === 0) {
        resultsBox.innerHTML = '';
    }
    
    const statusClass = result.success ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger';
    const icon = result.success ? 'fas fa-check-circle' : 'fas fa-times-circle';
    const statusText = result.success ? 'Berhasil' : 'Gagal';
    
    const resultHtml = `
        <div class="py-1 px-2 mb-1 rounded ${statusClass}">
            <div class="d-flex align-items-center">
                <i class="${icon} me-2"></i>
                <span class="font-monospace me-2">${result.number}</span>
                <span class="badge ${result.success ? 'bg-success' : 'bg-danger'} me-2">${statusText}</span>
                ${result.success ? '<span class="text-success small">✓</span>' : `<span class="text-danger small" title="${result.error || 'Unknown error'}">${(result.error || 'Error').substring(0, 30)}...</span>`}
            </div>
        </div>
    `;
    
    resultsBox.insertAdjacentHTML('beforeend', resultHtml);
    
    // Auto scroll to bottom (scroll parent container)
    const parentContainer = resultsBox.parentElement;
    if (parentContainer) {
        parentContainer.scrollTop = parentContainer.scrollHeight;
    }
    
    // Update summary
    updateResultsSummary(index + 1, total);
    
    console.log(`📊 Added result ${index + 1}/${total}: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.number}`);
}

// Update results summary
function updateResultsSummary(completed, total) {
    const summary = document.getElementById('sendSummary');
    if (!summary) {
        console.error('sendSummary element not found');
        return;
    }
    
    const percentage = Math.round((completed / total) * 100);
    summary.innerHTML = `
        ${completed}/${total} selesai (${percentage}%) 
        <i class="fas fa-chart-line ms-1"></i>
    `;
    
    console.log(`📈 Updated summary: ${completed}/${total} (${percentage}%)`);
}

// Reset broadcast UI to initial state
function resetBroadcastUI() {
    const sendButton = document.getElementById('sendButton');
    const controlButtons = document.getElementById('controlButtons');
    const pauseButton = document.getElementById('pauseButton');
    
    // Reset send button
    if (sendButton) {
        sendButton.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Kirim Pesan';
        sendButton.disabled = false;
    }
    
    // Hide control buttons
    if (controlButtons) {
        controlButtons.style.display = 'none';
    }
    
    // Reset pause button
    if (pauseButton) {
        pauseButton.innerHTML = '<i class="fas fa-pause me-2"></i>Pause';
        pauseButton.classList.remove('btn-success');
        pauseButton.classList.add('btn-warning');
    }
    
    // Enable form back
    disableBroadcastForm(false);
    
    // Reset broadcast state
    broadcastState = {
        isRunning: false,
        isPaused: false,
        isStopped: false,
        currentIndex: 0,
        totalRecipients: 0
    };
}

// Parse recipients from text (support mail merge format)
function parseRecipients(text) {
    if (!text) return [];
    
    const lines = text.split('\n').filter(line => line.trim());
    const recipients = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Check if line contains comma (mail merge format)
        if (trimmed.includes(',')) {
            const parts = trimmed.split(',');
            const phone = parts[0].trim().replace(/\D/g, ''); // Remove non-digits
            const data = parts.slice(1).map(p => p.trim()); // Get all data after phone
            
            if (phone.length >= 10 && phone.length <= 15) {
                recipients.push({
                    phone: phone,
                    data: data,
                    hasData: true
                });
            }
        } else {
            // Simple phone number format
            const phone = trimmed.replace(/\D/g, '');
            if (phone.length >= 10 && phone.length <= 15) {
                recipients.push({
                    phone: phone,
                    data: [],
                    hasData: false
                });
            }
        }
    }
    
    // Remove duplicates based on phone number
    const uniqueRecipients = recipients.filter((recipient, index, arr) => 
        arr.findIndex(r => r.phone === recipient.phone) === index
    );
    
    return uniqueRecipients;
}

// Process message template with placeholders (supports {text1} to {text10})
function processMessageTemplate(template, recipientData) {
    let message = template;
    const maxVariables = 10; // Support up to {text1} to {text10}
    
    // Replace all placeholders from {text1} to {text10}
    for (let i = 1; i <= maxVariables; i++) {
        const placeholder = `{text${i}}`;
        let value = '';
        
        // Get value if recipient has data and the index exists
        if (recipientData.hasData && recipientData.data && recipientData.data.length >= i) {
            value = recipientData.data[i - 1] || ''; // Use empty string if undefined
        }
        
        // Replace all occurrences of this placeholder
        message = message.replace(new RegExp(`\\{text${i}\\}`, 'g'), value);
    }
    
    return message;
}

// Display send results in the results box
function displaySendResults(results) {
    const sendResultsCard = document.getElementById('sendResultsCard');
    const sendSummary = document.getElementById('sendSummary');
    const sendResults = document.getElementById('sendResults');
    
    if (!sendResultsCard || !sendSummary || !sendResults) return;
    
    // Show the results card
    sendResultsCard.style.display = 'block';
    
    // Calculate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const total = results.length;
    
    // Update summary
    sendSummary.innerHTML = `
        <span class="text-success">${successful} Berhasil</span> | 
        <span class="text-danger">${failed} Gagal</span> | 
        Total: ${total}
    `;
    
    // Clear previous results
    sendResults.innerHTML = '';
    
    // Display individual results
    results.forEach((result, index) => {
        const resultDiv = document.createElement('div');
        resultDiv.className = `d-flex justify-content-between align-items-center py-1 px-2 mb-1 rounded ${
            result.success ? 'bg-success-subtle' : 'bg-danger-subtle'
        }`;
        
        const statusIcon = result.success ? 
            '<i class="fas fa-check-circle text-success"></i>' : 
            '<i class="fas fa-times-circle text-danger"></i>';
        
        const statusText = result.success ? 'Berhasil' : 'Gagal';
        const errorText = result.success ? '' : `: ${result.error}`;
        
        resultDiv.innerHTML = `
            <div class="d-flex align-items-center">
                ${statusIcon}
                <span class="ms-2 font-monospace">${result.number}</span>
            </div>
            <div class="text-end">
                <small class="${result.success ? 'text-success' : 'text-danger'}">
                    ${statusText}${errorText}
                </small>
            </div>
        `;
        
        sendResults.appendChild(resultDiv);
    });
    
    // Scroll results card into view
    sendResultsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Clear send results
function clearSendResults() {
    const resultsBox = document.getElementById('sendResults');
    const summary = document.getElementById('sendSummary');
    
    if (resultsBox) {
        resultsBox.innerHTML = `
            <div class="text-muted text-center py-3">
                <i class="fas fa-inbox me-1"></i>
                Hasil pengiriman akan muncul di sini
            </div>
        `;
    }
    
    if (summary) {
        summary.innerHTML = 'Siap mengirim';
    }
    
    console.log('🧹 Results cleared');
}