# 🔑 Swift Kasir Key Generator - Deployment Guide

Generator kode aktivasi untuk aplikasi Swift Kasir yang siap di-deploy ke Vercel.

## 📋 Fitur

- ✅ Generate kode aktivasi berdasarkan Device ID
- ✅ Generate akun login darurat otomatis
- ✅ Copy to clipboard dengan satu klik
- ✅ UI modern dengan animasi smooth
- ✅ Responsive untuk mobile & desktop
- ✅ 100% client-side (tidak butuh server)

## 🚀 Cara Deploy ke Vercel

### Opsi 1: Deploy via GitHub (Recommended)

1. **Push ke GitHub Repository**
   ```bash
   cd keygen-deploy
   git init
   git add .
   git commit -m "Add Swift Kasir Key Generator"
   git branch -M main
   git remote add origin https://github.com/username/swift-kasir-keygen.git
   git push -u origin main
   ```

2. **Connect ke Vercel**
   - Buka [vercel.com](https://vercel.com)
   - Login dengan GitHub
   - Klik "Add New Project"
   - Pilih repository `swift-kasir-keygen`
   - Klik "Deploy"
   - Selesai! 🎉

### Opsi 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login ke Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   cd keygen-deploy
   vercel
   ```
   - Jawab semua pertanyaan
   - Link deployment akan muncul otomatis

### Opsi 3: Deploy via Drag & Drop

1. Buka [vercel.com/new](https://vercel.com/new)
2. Drag & drop folder `keygen-deploy` ke browser
3. Tunggu proses upload & deployment
4. Selesai! 🎉

## 📦 Struktur Folder

```
keygen-deploy/
├── index.html      # Key generator (halaman utama)
├── vercel.json     # Konfigurasi Vercel
└── README.md       # Dokumentasi ini
```

## 🔒 Keamanan

File `vercel.json` sudah dikonfigurasi dengan:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block

## 🌐 Custom Domain (Opsional)

Setelah deploy, Anda bisa menambahkan custom domain:
1. Buka project di Vercel Dashboard
2. Settings → Domains
3. Tambahkan domain Anda
4. Update DNS sesuai instruksi

## 🎨 Customization

Untuk mengubah tampilan, edit file `index.html`:
- **Warna tema**: Ubah gradient di `body` background
- **Font**: Ganti Google Fonts di `<head>`
- **Logo**: Tambahkan emoji atau image di header

## 📝 Cara Penggunaan

1. Buka URL deployment (contoh: `https://swift-kasir-keygen.vercel.app`)
2. Dapatkan Device ID dari aplikasi Swift Kasir customer
3. Masukkan Device ID ke form
4. Klik "Generate Key"
5. Kode aktivasi & akun darurat akan muncul
6. Klik "Copy" untuk menyalin kode aktivasi

## 🔑 Format Output

**Kode Aktivasi:**
```
ABCD-EFGH-IJKL-MNOP
```

**Akun Darurat:**
```
Username: ADMIN-ABCD
Password: EFGHIJKL
```

## 💡 Tips

- Simpan URL deployment di tempat aman
- Bagikan hanya kepada yang berwenang
- Gunakan custom domain untuk branding professional
- Enable password protection di Vercel (Premium feature)

## 🆘 Troubleshooting

**Q: Deployment gagal?**
- Pastikan semua file ada (index.html & vercel.json)
- Cek syntax error di vercel.json
- Lihat error log di Vercel Dashboard

**Q: Kode aktivasi tidak match dengan app?**
- Pastikan SALT value sama dengan di app
- Cek algorithm hash (SHA-256)
- Verifikasi Device ID format

**Q: Ingin password protect?**
- Upgrade ke Vercel Pro
- Enable Password Protection di Settings
- Atau gunakan Vercel Basic Auth

## 📞 Support

Untuk bantuan lebih lanjut, hubungi developer Swift Kasir.

---

**Powered by Swift Kasir © 2025**
