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
        buttons += `<button class="btn btn-success btn-sm me-1" onclick="connectAccount(${account.id})">
            <i class="fas fa-play"></i> Hubungkan
        </button>`;
        buttons += `<button class="btn btn-primary btn-sm" onclick="forceReconnectAccount(${account.id})" title="Force reconnect dengan QR baru">
            <i class="fas fa-sync-alt"></i> QR Baru
        </button>`;
    } else if (account.status === 'connected') {
        buttons += `<button class="btn btn-warning btn-sm" onclick="disconnectAccount(${account.id})">
            <i class="fas fa-stop"></i> Putuskan
        </button>`;
    } else if (account.status === 'connecting') {
        buttons += `<button class="btn btn-info btn-sm me-1" onclick="showQRCode(${account.id})">
            <i class="fas fa-qrcode"></i> QR Code
        </button>`;
        buttons += `<button class="btn btn-secondary btn-sm" onclick="forceReconnectAccount(${account.id})" title="Generate QR baru">
            <i class="fas fa-redo"></i> Reset QR
        </button>`;
    }
    
    buttons += ` <button class="btn btn-danger btn-sm ms-1" onclick="deleteAccount(${account.id})">
        <i class="fas fa-trash"></i>
    </button>`;
    
    return buttons;
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
            setTimeout(() => loadAccounts(), 500); // Delayed refresh
            
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
            setTimeout(() => loadAccounts(), 500); // Delayed refresh
            
        } catch (error) {
            showAlert('Gagal menghapus akun: ' + error.message, 'danger');
        }
    }
}

// Global variable to track QR intervals
let currentStatusInterval = null;

async function showQRCode(accountId) {
    console.log('ShowQRCode called for ID:', accountId);
    
    // Clear any existing interval to prevent multiple intervals
    if (currentStatusInterval) {
        clearInterval(currentStatusInterval);
        currentStatusInterval = null;
    }
    
    try {
        showAlert('Scan QR Code untuk menghubungkan WhatsApp Anda', 'info');
        
        const modalEl = document.getElementById('qrModal');
        const container = document.getElementById('qr-container');
        
        console.log('Modal element:', modalEl);
        console.log('Container element:', container);
        console.log('Bootstrap available:', typeof bootstrap);
        
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
        
        // Show loading spinner initially
        container.innerHTML = `
            <div class="d-flex justify-content-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Generating QR Code...</span>
                </div>
            </div>
            <p class="mt-2 text-center text-muted">Generating QR Code...</p>
        `;
        
        console.log('Showing modal...');
        try {
            modal.show();
            console.log('Modal.show() called successfully');
        } catch (modalError) {
            console.error('Modal.show() error:', modalError);
            alert('Error showing modal: ' + modalError.message);
        }
        
        // Function to check and update QR code
        const updateQRCode = async () => {
            try {
                const account = await apiCall(`/api/accounts/${accountId}`);
                
                if (account.status === 'connected') {
                    modal.hide();
                    showAlert('✅ WhatsApp berhasil terhubung!', 'success');
                    // Don't refresh accounts here - it's handled by the status interval
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
        
        // Auto-check connection status every 8 seconds (reduced frequency)
        let retryCount = 0;
        const maxRetries = 15; // Reduced max retries since interval is longer
        currentStatusInterval = setInterval(async () => {
            try {
                const account = await apiCall(`/api/accounts/${accountId}`);
                console.log(`Checking account ${accountId} status:`, account.status); // Debug log
                
                if (account.status === 'connected') {
                    clearInterval(currentStatusInterval);
                    currentStatusInterval = null;
                    modal.hide();
                    showAlert('✅ WhatsApp berhasil terhubung!', 'success');
                    // Only refresh accounts once when connected, not on every check
                    setTimeout(() => loadAccounts(), 1000);
                    return;
                } 
                
                // Update QR code display (without calling loadAccounts)
                await updateQRCode();
                
                retryCount++;
                if (retryCount >= maxRetries) {
                    clearInterval(currentStatusInterval);
                    currentStatusInterval = null;
                    container.innerHTML = `
                        <div class="text-center text-warning">
                            <i class="fas fa-clock fa-3x mb-3"></i>
                            <p>Timeout setelah ${maxRetries} percobaan (${maxRetries * 8} detik)</p>
                            <button class="btn btn-primary" onclick="location.reload()">Refresh Halaman</button>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error checking account status:', error);
            }
        }, 8000);
        
        // Clear status interval when modal is closed
        document.getElementById('qrModal').addEventListener('hidden.bs.modal', () => {
            if (currentStatusInterval) {
                clearInterval(currentStatusInterval);
                currentStatusInterval = null;
            }
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
        const toNumber = document.getElementById('toNumber').value;
        const messageText = document.getElementById('messageText').value;
        const mediaFile = document.getElementById('mediaFile').files[0];
        const isScheduled = document.getElementById('scheduleMessage').checked;
        
        // Validate required fields (either message text OR media file)
        if (!fromAccount || !toNumber || (!messageText.trim() && !mediaFile)) {
            showAlert('Mohon lengkapi field yang diperlukan (dari akun, nomor tujuan, dan pesan atau media)', 'warning');
            return;
        }
        
        // Validate phone number format
        const phoneRegex = /^[0-9]{10,15}$/;
        if (!phoneRegex.test(toNumber)) {
            showAlert('Format nomor tidak valid. Gunakan format: 628123456789', 'warning');
            return;
        }
        
        // Show loading state
        const submitBtn = document.querySelector('#sendMessageForm button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Mengirim...';
        submitBtn.disabled = true;
        
        let result;
        
        if (mediaFile) {
            // Send with media using FormData
            const formData = new FormData();
            formData.append('fromAccountId', fromAccount);
            formData.append('toNumber', toNumber);
            formData.append('message', messageText.trim());
            formData.append('media', mediaFile);
            
            if (isScheduled) {
                const scheduleDate = document.getElementById('scheduleDate').value;
                const scheduleTime = document.getElementById('scheduleTime').value;
                
                if (!scheduleDate || !scheduleTime) {
                    showAlert('Mohon tentukan tanggal dan waktu untuk pesan terjadwal', 'warning');
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                    return;
                }
                
                formData.append('scheduledAt', `${scheduleDate} ${scheduleTime}`);
            }
            
            result = await apiCall('/api/messages/send-media', {
                method: 'POST',
                body: formData
            });
        } else {
            // Send text-only message
            const messageData = {
                fromAccountId: fromAccount,
                toNumber: toNumber,
                message: messageText.trim()
            };
            
            if (isScheduled) {
                const scheduleDate = document.getElementById('scheduleDate').value;
                const scheduleTime = document.getElementById('scheduleTime').value;
                
                if (!scheduleDate || !scheduleTime) {
                    showAlert('Mohon tentukan tanggal dan waktu untuk pesan terjadwal', 'warning');
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                    return;
                }
                
                messageData.scheduledAt = `${scheduleDate} ${scheduleTime}`;
            }
            
            result = await apiCall('/api/messages/send', {
                method: 'POST',
                body: JSON.stringify(messageData)
            });
        }
        
        // Reset form
        document.getElementById('sendMessageForm').reset();
        document.getElementById('messagePreview').textContent = 'Preview pesan akan muncul di sini...';
        document.getElementById('charCount').textContent = '0';
        clearMediaSelection();
        
        showAlert('✅ Pesan berhasil dikirim!', 'success');
        
        // Restore button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
    } catch (error) {
        console.error('Error sending message:', error);
        showAlert('Error mengirim pesan: ' + error.message, 'danger');
        
        // Restore button on error
        const submitBtn = document.querySelector('#sendMessageForm button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Kirim Pesan';
        submitBtn.disabled = false;
    }
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
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        // Cleanup if needed
    });
}