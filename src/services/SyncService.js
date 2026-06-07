import { Network } from '@capacitor/network';
import { dbService } from './DatabaseService';
import { supabase } from './supabaseClient';
import { licenseService } from './LicenseService';

class SyncService {
    constructor() {
        this.isSyncing = false;
        this.syncInterval = null;
    }

    async init() {
        console.log("Initializing Sync Service...");
        
        // Listen for network changes
        Network.addListener('networkStatusChange', status => {
            console.log('Network status changed', status);
            if (status.connected) {
                this.syncNow();
            }
        });

        // Start background sync interval (every 30 seconds)
        this.syncInterval = setInterval(() => {
            this.syncNow();
        }, 30000);

        // Try syncing immediately on startup
        this.syncNow();
    }

    async syncNow() {
        if (this.isSyncing) return;
        
        const status = await Network.getStatus();
        if (!status.connected) {
            console.log("Sync skipped: No internet connection");
            return;
        }

        this.isSyncing = true;
        try {
            console.log("Starting sync process...");
            await this.syncTransactions();
            await this.syncProducts(); // Sinkronisasi stok produk
            console.log("Sync process completed successfully");
        } catch (error) {
            console.error("Sync failed:", error);
        } finally {
            this.isSyncing = false;
        }
    }

    async syncTransactions() {
        // Get unsynced transactions
        let unsynced = [];
        
        if (dbService.platform !== 'web' && dbService.db) {
            const res = await dbService.db.query("SELECT * FROM transactions WHERE is_synced = 0 OR is_synced IS NULL");
            unsynced = res.values;
        } else {
            // LocalStorage fallback
            const transactions = JSON.parse(localStorage.getItem('kasir_offline_transactions') || '[]');
            unsynced = transactions.filter(t => !t.is_synced);
        }

        if (!unsynced || unsynced.length === 0) {
            return;
        }

        console.log(`Found ${unsynced.length} unsynced transactions. Sending to Supabase...`);

        const deviceId = await licenseService.getDeviceId();

        // Format for Supabase
        const payload = unsynced.map(t => {
            let items = t.items;
            if (typeof items === 'string') {
                try { items = JSON.parse(items); } catch (e) { items = []; }
            }
            
            return {
                sync_id: t.sync_id,
                device_id: t.device_id || deviceId,
                local_id: t.id,
                date: t.date,
                total: t.total,
                profit: t.profit,
                items: items,
                discount: t.discount,
                tax: t.tax,
                payment_method: t.paymentMethod || t.payment_method
            };
        });

        // Use UPSERT to prevent duplicates
        const { data, error } = await supabase
            .from('transactions')
            .upsert(payload, { onConflict: 'sync_id' });

        if (error) {
            throw error;
        }

        // Mark as synced locally
        const syncedAt = new Date().toISOString();
        const syncIds = payload.map(p => p.sync_id);

        if (dbService.platform !== 'web' && dbService.db) {
            // Update in SQLite
            const marks = syncIds.map(() => '?').join(',');
            await dbService.db.run(`UPDATE transactions SET is_synced = 1, synced_at = ? WHERE sync_id IN (${marks})`, [syncedAt, ...syncIds]);
        } else {
            // Update in LocalStorage
            let transactions = JSON.parse(localStorage.getItem('kasir_offline_transactions') || '[]');
            transactions = transactions.map(t => {
                if (syncIds.includes(t.sync_id)) {
                    return { ...t, is_synced: 1, synced_at: syncedAt };
                }
                return t;
            });
            localStorage.setItem('kasir_offline_transactions', JSON.stringify(transactions));
        }
    }

    async syncProducts() {
        // Sync all products as a snapshot for the web dashboard to read
        let products = [];
        let suppliers = [];
        
        if (dbService.platform !== 'web' && dbService.db) {
            products = (await dbService.db.query("SELECT * FROM products")).values || [];
            suppliers = (await dbService.db.query("SELECT * FROM suppliers")).values || [];
        } else {
            products = JSON.parse(localStorage.getItem('kasir_offline_products') || '[]');
            suppliers = JSON.parse(localStorage.getItem('kasir_offline_suppliers') || '[]');
        }

        if (!products || products.length === 0) return;

        const deviceId = await licenseService.getDeviceId();

        const payload = products.map(p => {
            // Temukan supplier berdasarkan supplierId
            const sup = suppliers.find(s => String(s.id) === String(p.supplierId));
            const supName = sup?.name || '-';
            const supPhone = sup?.phone || '-';

            return {
                id: `${deviceId}_${p.id}`,
                device_id: deviceId,
                product_id: p.id,
                name: p.name,
                price: p.price,
                buy_price: p.buyPrice || p.buy_price,
                stock: p.stock,
                supplier: supName,
                supplier_phone: supPhone,
                last_updated: new Date().toISOString()
            };
        });

        const { error } = await supabase
            .from('store_products')
            .upsert(payload, { onConflict: 'id' });

        if (error) {
            console.error("Failed to sync products:", error);
        } else {
            console.log(`Synced ${payload.length} products to Supabase.`);
        }
    }
}

export const syncService = new SyncService();
