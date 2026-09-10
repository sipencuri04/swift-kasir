import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences';

// ── Lama: dipertahankan untuk backward-compatibility ──────────────────
const SALT = 'SWIFT_KASIR_SECURE_V1_2025';
const STORAGE_KEY = 'kasir_license_key';
const TRIAL_START_KEY = 'kasir_trial_start_date';
// const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 Hari (Production)
const TRIAL_DURATION_MS = 2 * 60 * 1000; // 2 Menit (Testing)

// ── Baru: QR Token ────────────────────────────────────────────────────
const QR_SALT = 'SWIFT_KASIR_QR_ACTIVATION_2025';
const QR_LICENSE_KEY = 'kasir_qr_license';     // data lisensi QR aktif
const USED_TOKENS_KEY = 'kasir_used_tokens';    // array token yang sudah dipakai

export const licenseService = {
    deviceId: null,

    // ── Dapatkan Device ID ─────────────────────────────────────────────
    async getDeviceId() {
        if (this.deviceId) return this.deviceId;
        try {
            const info = await Device.getId();
            this.deviceId = info.identifier || 'UNKNOWN_DEVICE';
        } catch (e) {
            // Fallback untuk web / dev mode
            let fallback = localStorage.getItem('mock_device_id');
            if (!fallback) {
                fallback = 'WEB-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                localStorage.setItem('mock_device_id', fallback);
            }
            this.deviceId = fallback;
        }
        return this.deviceId;
    },

    // ── Cek apakah sudah diaktivasi (QR ATAU kode lama) ──────────────
    async isActivated() {
        // 1. Cek lisensi QR baru
        const qrLicense = this.getLocalQRLicense();
        if (qrLicense) {
            // Cek expired
            if (qrLicense.expired_at) {
                const now = new Date();
                const exp = new Date(qrLicense.expired_at);
                if (now > exp) return false; // Lisensi QR kedaluwarsa
            }
            return true;
        }

        // 2. Backward-compat: cek kode aktivasi lama
        const savedKey = localStorage.getItem(STORAGE_KEY);
        if (savedKey) {
            const deviceId = await this.getDeviceId();
            const expectedKey = await this.generateExpectedKey(deviceId);
            if (savedKey === expectedKey) return true;
        }

        return false;
    },

    // ── Aktivasi manual (kode lama, dipertahankan sebagai fallback) ───
    async activate(inputKey) {
        const deviceId = await this.getDeviceId();
        const expectedKey = await this.generateExpectedKey(deviceId);
        if (inputKey === expectedKey) {
            localStorage.setItem(STORAGE_KEY, inputKey);
            return true;
        }
        return false;
    },

    // ── Generate expected key (kode lama) ─────────────────────────────
    async generateExpectedKey(deviceId) {
        const text = String(deviceId).toUpperCase() + SALT;
        const msgBuffer = new TextEncoder().encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        const raw = hashHex.substring(0, 16);
        return raw.match(/.{1,4}/g).join('-');
    },

    // ── Emergency credentials (dipertahankan) ─────────────────────────
    async checkEmergencyCredentials(username, password) {
        try {
            const deviceId = await this.getDeviceId();
            const key = await this.generateExpectedKey(deviceId);
            const parts = key.split('-');
            if (parts.length !== 4) return false;
            const expectedUser = `ADMIN-${parts[0]}`;
            const expectedPass = `${parts[1]}${parts[2]}`;
            if (username.toUpperCase() === expectedUser && password.toUpperCase() === expectedPass) {
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    // ══════════════════════════════════════════════════════════════════
    // FITUR BARU: QR Code Activation
    // ══════════════════════════════════════════════════════════════════

    /**
     * Validasi QR token secara lokal (offline).
     * 
     * Format token: SK-XXXXXXXXXXXX-YYYY
     *   - SK-       : prefix
     *   - XXXX...   : 12 karakter random alphanumeric uppercase
     *   - -YYYY     : 4 karakter checksum (SHA-256 of prefix+body+QR_SALT, 4 char)
     * 
     * Return:
     *   { valid: true, token }            → token valid dan belum dipakai
     *   { valid: false, reason: '...' }   → tidak valid
     */
    async validateQRToken(token) {
        if (!token || typeof token !== 'string') {
            return { valid: false, reason: 'Token kosong atau tidak valid.' };
        }

        // Trim whitespace dan uppercase
        token = token.trim().toUpperCase();

        // Cek format: SK-[12 alnum]-[4 alnum]
        const pattern = /^SK-([A-Z0-9]{12})-([A-Z0-9]{4})$/;
        const match = token.match(pattern);
        if (!match) {
            return { valid: false, reason: 'Format QR tidak dikenali.' };
        }

        const body = match[1];
        const checksum = match[2];

        // Verifikasi checksum
        const text = `SK-${body}${QR_SALT}`;
        const msgBuffer = new TextEncoder().encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        const expectedChecksum = hashHex.substring(0, 4);

        if (checksum !== expectedChecksum) {
            return { valid: false, reason: 'QR tidak valid atau sudah dimodifikasi.' };
        }

        // Cek apakah token sudah pernah dipakai di perangkat ini
        const usedTokens = this.getUsedTokens();
        if (usedTokens.includes(token)) {
            return { valid: false, reason: 'QR ini sudah pernah digunakan di perangkat ini.' };
        }

        return { valid: true, token };
    },

    /**
     * Ekstrak info lisensi dari token (tanpa backend).
     * License type dan durasi di-encode dalam 2 karakter pertama body.
     */
    parseLicenseInfo(token) {
        // Default: standard, 365 hari
        let licenseType = 'standard';
        let durationDays = 365;

        try {
            const body = token.split('-')[1]; // ambil bagian XXXX... (12 char)
            if (!body) return { licenseType, durationDays };

            // 2 karakter pertama encode tipe lisensi
            const typeCode = body.substring(0, 2);
            if (typeCode === 'PR') { licenseType = 'premium'; durationDays = 730; }
            else if (typeCode === 'LT') { licenseType = 'lifetime'; durationDays = 36500; }
            else { licenseType = 'standard'; durationDays = 365; }
        } catch (e) {
            // Gunakan default
        }

        return { licenseType, durationDays };
    },

    /**
     * Aktivasi dengan QR token.
     * Simpan lisensi ke localStorage dan tandai token sebagai terpakai.
     */
    async activateWithQRToken(token, userData = {}) {
        const deviceId = await this.getDeviceId();
        const { licenseType, durationDays } = this.parseLicenseInfo(token);

        const now = new Date();
        const expiredAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

        const licenseData = {
            activation_token: token,
            license_type: licenseType,
            duration_days: durationDays,
            status: 'ACTIVATED',
            activated_at: now.toISOString(),
            expired_at: expiredAt.toISOString(),
            device_id: deviceId,
            store_name: userData.storeName || '',
            store_address: userData.storeAddress || '',
            coordinates: userData.coordinates || null,
            username: userData.username || '',
            phone: userData.phone || '',
        };

        // Simpan lisensi aktif
        localStorage.setItem(QR_LICENSE_KEY, JSON.stringify(licenseData));

        // Tandai token sebagai sudah dipakai
        const usedTokens = this.getUsedTokens();
        usedTokens.push(token);
        localStorage.setItem(USED_TOKENS_KEY, JSON.stringify(usedTokens));

        return licenseData;
    },

    /**
     * Ambil lisensi QR yang tersimpan lokal.
     */
    getLocalQRLicense() {
        try {
            const raw = localStorage.getItem(QR_LICENSE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    },

    /**
     * Ambil array token yang sudah dipakai di perangkat ini.
     */
    getUsedTokens() {
        try {
            const raw = localStorage.getItem(USED_TOKENS_KEY);
            if (!raw) return [];
            return JSON.parse(raw);
        } catch (e) {
            return [];
        }
    },

    /**
     * Info lisensi untuk ditampilkan di Settings.
     */
    getLicenseInfo() {
        const qr = this.getLocalQRLicense();
        if (qr) {
            const now = new Date();
            const exp = qr.expired_at ? new Date(qr.expired_at) : null;
            const daysLeft = exp ? Math.max(0, Math.ceil((exp - now) / (1000 * 60 * 60 * 24))) : null;
            return {
                type: 'qr',
                licenseType: qr.license_type,
                status: qr.status,
                activatedAt: qr.activated_at,
                expiredAt: qr.expired_at,
                daysLeft,
                token: qr.activation_token,
            };
        }
        const oldKey = localStorage.getItem(STORAGE_KEY);
        if (oldKey) {
            return { type: 'legacy', status: 'ACTIVATED', token: oldKey };
        }
        return null;
    },
};
