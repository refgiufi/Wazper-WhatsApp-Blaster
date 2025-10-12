# 🚀 Wazper - WhatsApp Blaster

Aplikasi WhatsApp Blaster berbasis Node.js dengan fitur multi-account yang menggunakan @whiskeysockets/baileys untuk mengirim pesan massal dengan tampilan web yang user-friendly.

## ✨ Fitur Utama

- 📱 **Multi-Account Support** - Kelola beberapa akun WhatsApp sekaligus
- 💬 **Pesan Massal** - Kirim pesan ke banyak kontak sekaligus
- 🖼️ **Media Support** - Kirim gambar, dokumen, audio, dan video
- 📋 **Template Pesan** - Buat dan simpan template pesan untuk digunakan berulang
- 👥 **Manajemen Kontak** - Kelola kontak dan grup dengan mudah
- 📊 **Campaign Management** - Buat, monitor, dan kelola kampanye blast
- 🎯 **Real-time Monitoring** - Monitor status pengiriman secara real-time
- 📈 **Dashboard Analytics** - Dashboard dengan statistik lengkap
- 📱 **Responsive Design** - Interface yang responsif untuk desktop dan mobile

## 🛠️ Teknologi

- **Backend**: Node.js + Express.js
- **Database**: MySQL
- **WhatsApp Library**: @whiskeysockets/baileys
- **Frontend**: Bootstrap 5 + Vanilla JavaScript
- **File Upload**: Multer dengan Sharp untuk image processing
- **Session Management**: Express Session

## 📋 Prerequisites

- Node.js v16.0.0 atau lebih baru
- MySQL 5.7 atau MariaDB 10.3+
- NPM atau Yarn

## 🚀 Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/wazper-whatsapp-blaster.git
cd wazper-whatsapp-blaster
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Konfigurasi Database

Buat file `.env` di root folder:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=wazper_db

# Application Configuration
PORT=3000
SESSION_SECRET=your-secret-key-here

# Optional: Node Environment
NODE_ENV=development
```

### 4. Setup Database

```bash
# Buat database dan tabel
npm run setup
```

Script ini akan:
- Membuat database `wazper_db`
- Membuat semua tabel yang diperlukan
- Insert data sample
- Membuat folder untuk uploads dan sessions

### 5. Jalankan Aplikasi

```bash
# Development mode dengan auto-reload (direkomendasikan untuk development)
npm run dev

# atau Production mode
npm start
```

**Development Mode Features:**
- ✅ Auto-reload saat file code berubah
- ✅ Ignore sessions folder (tidak restart saat WhatsApp connect)
- ✅ Ignore uploads folder dan log files
- ✅ Tidak ada auto-refresh UI (manual refresh tersedia)

Aplikasi akan berjalan di `http://localhost:3000`

## 📖 Penggunaan

### 1. Menambah Akun WhatsApp

1. Buka dashboard di browser
2. Masuk ke menu "Akun WhatsApp"
3. Klik "Tambah Akun"
4. Isi nama akun dan nomor WhatsApp
5. Klik "Hubungkan" untuk generate QR Code
6. Scan QR Code dengan WhatsApp Web

### 2. Mengelola Kontak

1. Masuk ke menu "Kontak"
2. Tambah kontak satu per satu atau import bulk
3. Organisir kontak dengan grup
4. Kelola status aktif/non-aktif kontak

### 3. Membuat Template Pesan

1. Masuk ke menu "Template Pesan"
2. Buat template dengan placeholder seperti `{name}`, `{phone}`
3. Upload media jika diperlukan
4. Simpan template untuk digunakan berkali-kali

### 4. Menjalankan Kampanye Blast

1. Masuk ke menu "Kampanye"
2. Klik "Buat Kampanye Baru"
3. Pilih akun WhatsApp yang akan digunakan
4. Pilih template pesan
5. Pilih target kontak atau grup
6. Atur delay antar pesan (detik)
7. Jalankan kampanye

### 5. Monitoring dan Analytics

- Dashboard menampilkan statistik real-time
- Monitor status pengiriman per pesan
- Lihat log aktivitas lengkap
- Analisis performa kampanye

## 📁 Struktur Project

```
wazper-whatsapp-blaster/
├── config/
│   └── database.js          # Konfigurasi database
├── public/
│   ├── css/
│   │   └── style.css       # Styling aplikasi
│   ├── js/
│   │   └── app.js          # JavaScript frontend
│   └── index.html          # Template HTML utama
├── routes/
│   ├── accounts.js         # API routes untuk akun
│   ├── campaigns.js        # API routes untuk kampanye
│   ├── messages.js         # API routes untuk pesan & kontak
│   └── uploads.js          # API routes untuk upload file
├── services/
│   └── whatsapp.js         # Service WhatsApp Baileys
├── sessions/               # Folder untuk session WhatsApp
├── setup/
│   ├── database.sql        # Schema database
│   └── database.js         # Script setup database
├── uploads/                # Folder untuk file upload
│   ├── images/
│   ├── documents/
│   ├── audio/
│   └── video/
├── .env                    # Environment variables
├── package.json
├── server.js              # Entry point aplikasi
└── README.md
```

## 🔧 API Endpoints

### Accounts
- `GET /api/accounts` - List semua akun
- `POST /api/accounts` - Tambah akun baru
- `POST /api/accounts/:id/connect` - Hubungkan akun
- `POST /api/accounts/:id/disconnect` - Putuskan akun
- `DELETE /api/accounts/:id` - Hapus akun

### Messages & Contacts
- `GET /api/messages/contacts` - List kontak
- `POST /api/messages/contacts` - Tambah kontak
- `POST /api/messages/contacts/bulk` - Import kontak bulk
- `GET /api/messages/templates` - List template pesan
- `POST /api/messages/templates` - Buat template baru

### Campaigns
- `GET /api/campaigns` - List kampanye
- `POST /api/campaigns` - Buat kampanye baru
- `POST /api/campaigns/:id/start` - Mulai kampanye
- `POST /api/campaigns/:id/pause` - Pause kampanye
- `POST /api/campaigns/:id/resume` - Resume kampanye

### Uploads
- `POST /api/uploads/file` - Upload file tunggal
- `POST /api/uploads/files` - Upload multiple files
- `GET /api/uploads/files` - List file yang diupload

## ⚙️ Konfigurasi

### Database
Sesuaikan konfigurasi database di file `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=wazper_db
```

### Upload Limits
File upload maksimal 50MB per file. Supported formats:
- **Images**: JPG, PNG, GIF, WebP
- **Documents**: PDF, DOC, DOCX, XLS, XLSX, TXT, CSV
- **Video**: MP4, MOV, AVI
- **Audio**: MP3, WAV, OGG

### Session Management
Session WhatsApp disimpan di folder `sessions/`. Backup folder ini untuk mempertahankan koneksi setelah restart server.

## 🚨 Troubleshooting

### Masalah Koneksi Database
```bash
# Pastikan MySQL service berjalan
sudo service mysql start

# Test koneksi
mysql -u root -p -e "SELECT 1"
```

### Masalah Permission File Upload
```bash
# Set permission folder uploads
chmod 755 uploads/
chmod 755 sessions/
```

### QR Code Tidak Muncul
1. Pastikan akun dalam status "connecting"
2. Refresh halaman atau reconnect akun
3. Periksa log console untuk error

### Pesan Tidak Terkirim
1. Pastikan akun WhatsApp dalam status "connected"
2. Periksa format nomor telepon (628xxx)
3. Pastikan nomor target terdaftar di WhatsApp
4. Periksa delay antar pesan (minimal 5 detik)

## 📝 License

MIT License - lihat file [LICENSE](LICENSE) untuk detail.

## 🤝 Contributing

1. Fork repository
2. Buat feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## 📧 Support

Jika Anda mengalami masalah atau memiliki pertanyaan:

1. Cek [Issues](https://github.com/yourusername/wazper-whatsapp-blaster/issues) yang ada
2. Buat issue baru dengan detail masalah
3. Sertakan log error dan konfigurasi (tanpa password)

## ⚠️ Disclaimer

**PENTING**: Penggunaan aplikasi ini harus mematuhi:

1. **Terms of Service WhatsApp** - Jangan spam atau kirim pesan yang melanggar aturan
2. **Regulasi Lokal** - Patuhi undang-undang tentang pemasaran digital di wilayah Anda
3. **Etika Marketing** - Hanya kirim pesan ke kontak yang sudah memberikan persetujuan

Pengembang tidak bertanggung jawab atas penyalahgunaan aplikasi ini. Gunakan dengan bijak dan bertanggung jawab.

## 🎯 Roadmap

- [ ] Scheduling pesan untuk waktu tertentu
- [ ] Integration dengan CRM external
- [ ] Export/Import data dalam format Excel
- [ ] Multi-language support
- [ ] API webhooks untuk integration
- [ ] Advanced analytics dan reporting
- [ ] Auto-reply chatbot sederhana
- [ ] Backup & restore data otomatis

---

**Wazper** - Making WhatsApp Marketing Easy and Efficient 🚀