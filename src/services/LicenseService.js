import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences'; // Using Preferences (formerly Storage) if available, or localStorage

const SALT = 'SWIFT_KASIR_SECURE_V1_2025';
const STORAGE_KEY = 'kasir_license_key';
const TRIAL_START_KEY = 'kasir_trial_start_date';
// const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days (Original)
const TRIAL_DURATION_MS = 2 * 60 * 1000; // 2 Minutes (Testing)

export const licenseService = {
    deviceId: null,

    async getDeviceId() {
        if (this.deviceId) return this.deviceId;
        try {
            const info = await Device.getId();
            this.deviceId = info.identifier || 'UNKNOWN_DEVICE';
        } catch (e) {
            // Fallback for web dev
            let fallback = localStorage.getItem('mock_device_id');
            if (!fallback) {
                fallback = 'WEB-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                localStorage.setItem('mock_device_id', fallback);
            }
            this.deviceId = fallback;
        }
        return this.deviceId;
    },

    async isActivated() {
        const savedKey = localStorage.getItem(STORAGE_KEY);
        if (savedKey) {
            const deviceId = await this.getDeviceId();
            const expectedKey = await this.generateExpectedKey(deviceId);
            if (savedKey === expectedKey) return true;
        }
        return false;
    },

    async activate(inputKey) {
        const deviceId = await this.getDeviceId();
        const expectedKey = await this.generateExpectedKey(deviceId);

        if (inputKey === expectedKey) {
            localStorage.setItem(STORAGE_KEY, inputKey);
            return true;
        }
        return false;
    },

    async generateExpectedKey(deviceId) {
        // Simple consistent hash mechanism
        // Force DeviceID to UPPERCASE to avoid mismatch with KeyGen
        const text = String(deviceId).toUpperCase() + SALT;
        const msgBuffer = new TextEncoder().encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

        // Take first 16 chars and format: XXXX-XXXX-XXXX-XXXX
        const raw = hashHex.substring(0, 16);
        return raw.match(/.{1,4}/g).join('-');
    },

    async checkEmergencyCredentials(username, password) {
        // Emergency Account logic:
        // Based on the Validation Key (XXXX-YYYY-ZZZZ-AAAA)
        // Username: ADMIN-{XXXX}
        // Password: {YYYY}{ZZZZ}

        try {
            const deviceId = await this.getDeviceId();
            const key = await this.generateExpectedKey(deviceId); // XXXX-YYYY-ZZZZ-AAAA
            const parts = key.split('-');
            if (parts.length !== 4) return false;

            const expectedUser = `ADMIN-${parts[0]}`;
            const expectedPass = `${parts[1]}${parts[2]}`;

            // Case insensitive for username, exact for password (or case insensitive too since it's hex)
            if (username.toUpperCase() === expectedUser && password.toUpperCase() === expectedPass) {
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
};
