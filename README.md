# Aplikasi Kasir Offline (UMKM)

Aplikasi kasir mobile offline berbasis React dan Capacitor. Menggunakan SQLite untuk penyimpanan data lokal dan mendukung printer thermal Bluetooth (ESC/POS).

## Fitur
- **Offline First**: Tidak butuh internet.
- **Database Lokal**: Menyimpan produk dan transaksi di HP pengguna.
- **Cetak Struk**: Terhubung ke printer thermal via Bluetooth.
- **Manajemen Produk**: Tambah/Hapus produk dengan mudah.
- **Laporan Harian**: Melihat total pendapatan harian.

## Cara Menjalankan

### 1. Persiapan
Pastikan Anda sudah menginstall:
- Node.js
- Android Studio (untuk build APK/Run di HP)

### 2. Install Dependencies
```bash
npm install
```

### 3. Menjalankan di Browser (Development)
```bash
npm run dev
```
*Catatan: Fitur Bluetooth dan SQLite Native tidak berjalan sempurna di browser. Gunakan mode simulasi yang tersedia di kode.*

### 4. Menjalankan di Android (Real Device/Emulator)

Build project React:
```bash
npm run build
```

Sync ke folder Android:
```bash
npx cap sync
```

Buka di Android Studio:
```bash
npx cap open android
```
Dari Android Studio, klik tombol "Run" (Icon Play) dengan HP yang terhubung.

## Struktur Project
- `src/services/DatabaseService.js`: Logic database SQLite.
- `src/services/PrinterService.js`: Logic koneksi Bluetooth & format struk (ESC/POS).
- `src/pages`: Halaman aplikasi (Pos, Produk, History, Settings).
- `src/components`: Komponen UI (Navbar dll).

## Troubleshooting
- **Printer tidak terdeteksi**: Pastikan Bluetooth HP nyala dan printer sudah dipairing di settingan Bluetooth HP terlebih dahulu.
- **Database error**: Coba clear data aplikasi atau reinstall jika skema berubah.
