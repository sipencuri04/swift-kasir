import { Network } from '@capacitor/network';
import { dbService } from './DatabaseService';
import { licenseService } from './LicenseService';

class SyncService {
    constructor() {
        this.isSyncing = false;
        this.syncInterval = null;
    }

    async init() {
        console.log("Sync Service Disabled (Offline Only Mode)");
    }

    async syncNow() {
        // No-op for offline mode
    }

    async syncTransactions() {
        // No-op for offline mode
    }

    async syncProducts() {
        // No-op for offline mode
    }
}

export const syncService = new SyncService();

