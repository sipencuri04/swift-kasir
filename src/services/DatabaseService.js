import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { JeepSqlite } from 'jeep-sqlite/dist/components/jeep-sqlite';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'kasir_db';
const DB_PREFIX = 'kasir_offline_';

class DatabaseService {
    constructor() {
        this.ready = false;
        this.platform = Capacitor.getPlatform();
        this.sqlite = null;
        this.db = null;
    }

    async init() {
        console.log(`Initializing Database Service on ${this.platform}...`);

        if (this.platform !== 'web') {
            try {
                this.sqlite = new SQLiteConnection(CapacitorSQLite);
                this.db = await this.sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
                await this.db.open();

                // Initialize Tables
                await this.db.execute(`
                    CREATE TABLE IF NOT EXISTS products (
                        id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        price REAL,
                        buyPrice REAL,
                        stock INTEGER,
                        supplierId INTEGER,
                        brandId INTEGER,
                        categoryId INTEGER
                    );
                    CREATE TABLE IF NOT EXISTS transactions (
                        id INTEGER PRIMARY KEY,
                        date TEXT,
                        total REAL,
                        profit REAL,
                        items TEXT,
                        discount REAL,
                        tax REAL,
                        paymentMethod TEXT,
                        sync_id TEXT UNIQUE,
                        device_id TEXT,
                        is_synced INTEGER DEFAULT 0,
                        synced_at TEXT
                    );
                    CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY, name TEXT, phone TEXT, address TEXT);
                    CREATE TABLE IF NOT EXISTS brands (id INTEGER PRIMARY KEY, name TEXT);
                    CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, name TEXT, icon TEXT);
                    CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY, date TEXT, total REAL, items TEXT, supplierId INTEGER);
                    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT, name TEXT);
                    CREATE TABLE IF NOT EXISTS shifts (
                        id INTEGER PRIMARY KEY, 
                        userId INTEGER,
                        startTime TEXT, 
                        endTime TEXT, 
                        initialCash REAL, 
                        expectedCash REAL, 
                        actualCash REAL,
                        status TEXT
                    );
                    CREATE TABLE IF NOT EXISTS stock_opname (
                        id INTEGER PRIMARY KEY,
                        productId INTEGER,
                        productName TEXT,
                        systemStock INTEGER,
                        actualStock INTEGER,
                        difference INTEGER,
                        date TEXT,
                        userId INTEGER,
                        notes TEXT
                    );
                    CREATE TABLE IF NOT EXISTS ingredients (
                        id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        stock REAL DEFAULT 0,
                        unit TEXT NOT NULL,
                        buyPrice REAL DEFAULT 0,
                        supplierId INTEGER
                    );
                    CREATE TABLE IF NOT EXISTS recipes (
                        id INTEGER PRIMARY KEY,
                        productId INTEGER NOT NULL,
                        ingredientId INTEGER NOT NULL,
                        quantity REAL NOT NULL
                    );
                `);
                try { await this.db.execute("ALTER TABLE products ADD COLUMN barcode TEXT;"); } catch(e) {}
                try { await this.db.execute("ALTER TABLE products ADD COLUMN image TEXT;"); } catch(e) {}
                try { await this.db.execute("ALTER TABLE products ADD COLUMN categoryId INTEGER;"); } catch(e) {}
                try { await this.db.execute("ALTER TABLE transactions ADD COLUMN paymentProof TEXT;"); } catch(e) {}
                try { await this.db.execute("ALTER TABLE products ADD COLUMN oldPrice REAL;"); } catch(e) {}
                try { await this.db.execute("ALTER TABLE products ADD COLUMN priceUpdatedAt TEXT;"); } catch(e) {}

                // Seed Default User (Owner) if empty
                const res = await this.db.query("SELECT * FROM users WHERE username = 'owner'");
                if (res.values.length === 0) {
                    await this.db.run("INSERT INTO users (id, username, password, role, name) VALUES (?,?,?,?,?)",
                        [1, 'owner', '123', 'superuser', 'Super User']);
                }

                console.log("SQLite Database Ready");
            } catch (err) {
                console.error("SQLite Init Error:", err);
            }
        } else {
            // WEB / LocalStorage Fallback
            await new Promise(r => setTimeout(r, 500));
            const collections = ['products', 'transactions', 'users', 'suppliers', 'brands', 'categories', 'purchases', 'shifts', 'ingredients', 'recipes'];
            collections.forEach(c => {
                if (!localStorage.getItem(DB_PREFIX + c)) {
                    localStorage.setItem(DB_PREFIX + c, JSON.stringify([]));
                }
            });
            // Seed default categories
            const cats = JSON.parse(localStorage.getItem(DB_PREFIX + 'categories') || '[]');
            if (cats.length === 0) {
                const defaultCats = [
                    { id: 1, name: 'Makanan', icon: '🍔' },
                    { id: 2, name: 'Minuman', icon: '🥤' },
                    { id: 3, name: 'Rokok', icon: '🚬' },
                    { id: 4, name: 'Kebersihan', icon: '🧼' },
                    { id: 5, name: 'Lainnya', icon: '📦' },
                ];
                localStorage.setItem(DB_PREFIX + 'categories', JSON.stringify(defaultCats));
            }
            // Seed Users
            const users = JSON.parse(localStorage.getItem(DB_PREFIX + 'users'));
            if (users.length === 0) {
                const defaultUser = [{ id: 1, username: 'owner', password: '123', role: 'superuser', name: 'Super User' }];
                localStorage.setItem(DB_PREFIX + 'users', JSON.stringify(defaultUser));
            }
            if (!localStorage.getItem(DB_PREFIX + 'stock_opname')) {
                localStorage.setItem(DB_PREFIX + 'stock_opname', JSON.stringify([]));
            }
            console.log("LocalStorage Service ready");
        }

        this.ready = true;
    }

    async _get(table) {
        if (this.platform !== 'web' && this.db) {
            const res = await this.db.query(`SELECT * FROM ${table}`);
            return res.values.map(row => {
                if (table === 'transactions' || table === 'purchases') {
                    if (row.items && typeof row.items === 'string') {
                        try { row.items = JSON.parse(row.items); } catch (e) { }
                    }
                }
                return row;
            });
        }
        return JSON.parse(localStorage.getItem(DB_PREFIX + table) || '[]');
    }

    async _save(table, data) {
        if (this.platform === 'web' || !this.db) {
            localStorage.setItem(DB_PREFIX + table, JSON.stringify(data));
        }
    }

    async getOpenShift() {
        if (this.platform !== 'web' && this.db) {
            const res = await this.db.query(`SELECT * FROM shifts WHERE status = 'open' LIMIT 1`);
            return res.values.length > 0 ? res.values[0] : null;
        } else {
            const shifts = await this._get('shifts');
            return shifts.find(s => s.status === 'open') || null;
        }
    }

    async getShiftStats(shiftId) {
        const transactions = await this.getTransactions();
        let shift = null;
        if (this.platform !== 'web' && this.db) {
            const res = await this.db.query(`SELECT * FROM shifts WHERE id = ?`, [shiftId]);
            shift = res.values[0];
        } else {
            const shifts = await this._get('shifts');
            shift = shifts.find(s => s.id === shiftId);
        }
        if (!shift) throw new Error("Shift not found");
        const shiftTrans = transactions.filter(t =>
            new Date(t.date) >= new Date(shift.startTime) &&
            (!t.paymentMethod || t.paymentMethod === 'cash')
        );
        const cashIncome = shiftTrans.reduce((acc, t) => acc + (t.total || 0), 0);
        const expected = (shift.initialCash || 0) + cashIncome;
        return { initialCash: shift.initialCash, cashIncome, expected };
    }

    async startShift(userId, initialCash) {
        const id = Date.now();
        const shift = { id, userId, startTime: new Date().toISOString(), endTime: null, initialCash: parseFloat(initialCash), expectedCash: 0, actualCash: 0, status: 'open' };
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`INSERT INTO shifts (id, userId, startTime, initialCash, status) VALUES (?,?,?,?,?)`, [id, userId, shift.startTime, shift.initialCash, 'open']);
        } else {
            const shifts = await this._get('shifts');
            shifts.push(shift);
            localStorage.setItem(DB_PREFIX + 'shifts', JSON.stringify(shifts));
        }
        return shift;
    }

    async endShift(shiftId, actualCash) {
        const transactions = await this.getTransactions();
        let shift = null;
        if (this.platform !== 'web' && this.db) {
            const res = await this.db.query(`SELECT * FROM shifts WHERE id = ?`, [shiftId]);
            shift = res.values[0];
        } else {
            const shifts = await this._get('shifts');
            shift = shifts.find(s => s.id === shiftId);
        }
        if (!shift) throw new Error("Shift not found");
        const shiftTrans = transactions.filter(t => new Date(t.date) >= new Date(shift.startTime) && (!t.paymentMethod || t.paymentMethod === 'cash'));
        const cashIncome = shiftTrans.reduce((acc, t) => acc + (t.total || 0), 0);
        const expected = (shift.initialCash || 0) + cashIncome;
        const endTime = new Date().toISOString();
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`UPDATE shifts SET endTime=?, expectedCash=?, actualCash=?, status='closed' WHERE id=?`, [endTime, expected, actualCash, shiftId]);
        } else {
            const shifts = await this._get('shifts');
            const s = shifts.find(i => i.id === shiftId);
            if (s) {
                s.endTime = endTime; s.expectedCash = expected; s.actualCash = actualCash; s.status = 'closed';
                localStorage.setItem(DB_PREFIX + 'shifts', JSON.stringify(shifts));
            }
        }
        return { expected, actualCash, difference: actualCash - expected, cashIncome };
    }

    async getShiftHistory() {
        const shifts = await this._get('shifts');
        return shifts.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    }

    async login(username, password) {
        const users = await this._get('users');
        const user = users.find(u => u.username === username && u.password === password);
        return user || null;
    }

    async getUsers() { return await this._get('users'); }

    async createUser(userData) {
        if (this.platform !== 'web' && this.db) {
            const id = Date.now();
            await this.db.run(`INSERT INTO users (id, username, password, role, name) VALUES (?,?,?,?,?)`, [id, userData.username, userData.password, userData.role, userData.name]);
        } else {
            const users = await this._get('users');
            if (users.find(u => u.username === userData.username)) throw new Error("Username already exists");
            users.push({ ...userData, id: Date.now() });
            localStorage.setItem(DB_PREFIX + 'users', JSON.stringify(users));
        }
    }

    async deleteUser(id) {
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`DELETE FROM users WHERE id = ?`, [id]);
        } else {
            let users = await this._get('users');
            users = users.filter(u => u.id !== id);
            localStorage.setItem(DB_PREFIX + 'users', JSON.stringify(users));
        }
    }

    async updateUser(id, data) {
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`UPDATE users SET username=?, password=?, role=?, name=? WHERE id=?`, [data.username, data.password, data.role, data.name, id]);
        } else {
            let users = await this._get('users');
            users = users.map(u => u.id === id ? { ...u, username: data.username, password: data.password, role: data.role, name: data.name } : u);
            localStorage.setItem(DB_PREFIX + 'users', JSON.stringify(users));
        }
    }

    async getSuppliers() { return await this._get('suppliers'); }
    async addSupplier(name, phone, address) {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`INSERT INTO suppliers (id, name, phone, address) VALUES (?,?,?,?)`, [id, name, phone, address]);
        } else {
            const list = await this._get('suppliers');
            list.push({ id, name, phone, address });
            localStorage.setItem(DB_PREFIX + 'suppliers', JSON.stringify(list));
        }
        return { id, name, phone, address };
    }
    async deleteSupplier(id) {
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`DELETE FROM suppliers WHERE id = ?`, [id]);
        } else {
            let list = await this._get('suppliers');
            localStorage.setItem(DB_PREFIX + 'suppliers', JSON.stringify(list.filter(i => i.id !== id)));
        }
    }

    async getBrands() { return await this._get('brands'); }
    async addBrand(name) {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`INSERT INTO brands (id, name) VALUES (?,?)`, [id, name]);
        } else {
            const list = await this._get('brands');
            list.push({ id, name });
            localStorage.setItem(DB_PREFIX + 'brands', JSON.stringify(list));
        }
        return { id, name };
    }
    async deleteBrand(id) {
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`DELETE FROM brands WHERE id = ?`, [id]);
        } else {
            let list = await this._get('brands');
            localStorage.setItem(DB_PREFIX + 'brands', JSON.stringify(list.filter(i => i.id !== id)));
        }
    }

    async getCategories() { return await this._get('categories'); }
    async addCategory(name, icon = '📦') {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`INSERT INTO categories (id, name, icon) VALUES (?,?,?)`, [id, name, icon]);
        } else {
            const list = await this._get('categories');
            list.push({ id, name, icon });
            localStorage.setItem(DB_PREFIX + 'categories', JSON.stringify(list));
        }
        return { id, name, icon };
    }
    async deleteCategory(id) {
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`DELETE FROM categories WHERE id = ?`, [id]);
        } else {
            let list = await this._get('categories');
            localStorage.setItem(DB_PREFIX + 'categories', JSON.stringify(list.filter(i => i.id !== id)));
        }
    }

    async getProducts() {
        const products = await this._get('products');
        return products.map(p => ({
            ...p,
            stock: p.stock !== undefined ? parseInt(p.stock) : 0,
            buyPrice: p.buyPrice !== undefined ? parseFloat(p.buyPrice) : 0,
            oldPrice: p.oldPrice !== undefined ? parseFloat(p.oldPrice) : null,
            priceUpdatedAt: p.priceUpdatedAt || null,
            supplierId: p.supplierId || null,
            brandId: p.brandId || null,
            categoryId: p.categoryId || null,
            image: p.image || null
        })).sort((a, b) => a.name.localeCompare(b.name));
    }

    async addProduct(data) {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        const p = { id, name: data.name, price: parseFloat(data.price), buyPrice: parseFloat(data.buyPrice || 0), stock: parseInt(data.stock || 0), supplierId: data.supplierId, brandId: data.brandId, categoryId: data.categoryId || null, barcode: data.barcode || '', image: data.image || null };
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`INSERT INTO products (id, name, price, buyPrice, stock, supplierId, brandId, categoryId, barcode, image) VALUES (?,?,?,?,?,?,?,?,?,?)`, [p.id, p.name, p.price, p.buyPrice, p.stock, p.supplierId, p.brandId, p.categoryId, p.barcode, p.image]);
        } else {
            const products = await this._get('products');
            products.push(p);
            localStorage.setItem(DB_PREFIX + 'products', JSON.stringify(products));
        }
        return p;
    }

    async updateProduct(id, data) {
        let oldPrice = null;
        let priceUpdatedAt = null;

        // Cek harga lama
        let currentProduct = null;
        if (this.platform !== 'web' && this.db) {
            const res = await this.db.query(`SELECT * FROM products WHERE id=?`, [id]);
            if (res.values && res.values.length > 0) currentProduct = res.values[0];
        } else {
            const products = await this._get('products');
            currentProduct = products.find(p => p.id === id);
        }

        if (currentProduct) {
            if (parseFloat(data.price) !== parseFloat(currentProduct.price)) {
                oldPrice = currentProduct.price;
                priceUpdatedAt = new Date().toISOString();
            } else {
                oldPrice = currentProduct.oldPrice || null;
                priceUpdatedAt = currentProduct.priceUpdatedAt || null;
            }
        }

        if (this.platform !== 'web' && this.db) {
            await this.db.run(`UPDATE products SET name=?, price=?, buyPrice=?, stock=?, supplierId=?, brandId=?, categoryId=?, barcode=?, image=?, oldPrice=?, priceUpdatedAt=? WHERE id=?`, 
                [data.name, parseFloat(data.price), parseFloat(data.buyPrice), parseInt(data.stock), data.supplierId, data.brandId, data.categoryId || null, data.barcode || '', data.image || null, oldPrice, priceUpdatedAt, id]);
        } else {
            let products = await this._get('products');
            products = products.map(p => p.id === id ? { ...p, name: data.name, price: parseFloat(data.price), buyPrice: parseFloat(data.buyPrice || 0), stock: parseInt(data.stock), supplierId: data.supplierId, brandId: data.brandId, categoryId: data.categoryId || null, barcode: data.barcode || '', image: data.image || null, oldPrice: oldPrice, priceUpdatedAt: priceUpdatedAt } : p);
            localStorage.setItem(DB_PREFIX + 'products', JSON.stringify(products));
        }
    }

    async deleteProduct(id) {
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`DELETE FROM products WHERE id=?`, [id]);
        } else {
            let products = await this._get('products');
            localStorage.setItem(DB_PREFIX + 'products', JSON.stringify(products.filter(p => p.id !== id)));
        }
    }

    async createPurchase(supplierId, items, totalCost) {
        const id = Date.now();
        let products = await this.getProducts();
        let ingredients = await this.getIngredients();
        for (const item of items) {
            if (item.isIngredient) {
                const ingredient = ingredients.find(ing => ing.id === item.id);
                if (ingredient) {
                    const newStock = (ingredient.stock || 0) + parseFloat(item.qty);
                    const newBuyPrice = parseFloat(item.cost);
                    if (this.platform !== 'web' && this.db) {
                        await this.db.run(`UPDATE ingredients SET stock=?, buyPrice=? WHERE id=?`, [newStock, newBuyPrice, ingredient.id]);
                    } else {
                        ingredient.stock = newStock;
                        ingredient.buyPrice = newBuyPrice;
                    }
                }
            } else {
                const product = products.find(p => p.id === item.id);
                if (product) {
                    const newStock = (product.stock || 0) + parseInt(item.qty);
                    const newBuyPrice = parseFloat(item.cost);
                    if (this.platform !== 'web' && this.db) {
                        await this.db.run(`UPDATE products SET stock=?, buyPrice=? WHERE id=?`, [newStock, newBuyPrice, product.id]);
                    } else {
                        product.stock = newStock; product.buyPrice = newBuyPrice;
                    }
                }
            }
        }
        if (this.platform === 'web' || !this.db) {
            localStorage.setItem(DB_PREFIX + 'products', JSON.stringify(products));
            localStorage.setItem(DB_PREFIX + 'ingredients', JSON.stringify(ingredients));
        }

        // Sync buyPrice otomatis untuk semua produk yang punya resep menggunakan bahan yang diupdate
        const updatedIngredientIds = items.filter(i => i.isIngredient).map(i => i.id);
        if (updatedIngredientIds.length > 0) {
            await this._syncAllRecipeBuyPrices(updatedIngredientIds);
        }

        const itemsJson = JSON.stringify(items);
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`INSERT INTO purchases (id, supplierId, date, total, items) VALUES (?,?,?,?,?)`, [id, supplierId, new Date().toISOString(), totalCost, itemsJson]);
        } else {
            const list = await this._get('purchases');
            list.push({ id, supplierId, date: new Date().toISOString(), total: totalCost, items: items });
            localStorage.setItem(DB_PREFIX + 'purchases', JSON.stringify(list));
        }
        return id;
    }

    /**
     * Sync ulang buyPrice semua produk yang menggunakan bahan (ingredientIds) tertentu di resepnya.
     * Dipanggil setelah update harga bahan baku agar harga modal produk tetap akurat.
     */
    async _syncAllRecipeBuyPrices(changedIngredientIds = []) {
        const allRecipes = await this.getRecipes();
        const ingredients = await this.getIngredients();

        // Kumpulkan productId unik yang terdampak
        const affectedProductIds = [...new Set(
            allRecipes
                .filter(r => changedIngredientIds.includes(r.ingredientId))
                .map(r => r.productId)
        )];

        for (const productId of affectedProductIds) {
            const productRecipes = allRecipes.filter(r => r.productId === productId);
            let totalCost = 0;
            for (const r of productRecipes) {
                const ing = ingredients.find(i => i.id === r.ingredientId);
                if (ing) totalCost += parseFloat(r.quantity) * (ing.buyPrice || 0);
            }
            const newBuyPrice = Math.round(totalCost);
            if (this.platform !== 'web' && this.db) {
                await this.db.run(`UPDATE products SET buyPrice=? WHERE id=?`, [newBuyPrice, productId]);
            } else {
                let products = await this._get('products');
                products = products.map(p => p.id === productId ? { ...p, buyPrice: newBuyPrice } : p);
                localStorage.setItem(DB_PREFIX + 'products', JSON.stringify(products));
            }
        }
    }

    /**
     * Sinkronkan buyPrice untuk SEMUA produk yang punya resep.
     * Berguna untuk migrasi data lama atau saat pertama kali tab Resep dibuka.
     */
    async syncAllProductsBuyPrice() {
        const allRecipes = await this.getRecipes();
        if (allRecipes.length === 0) return;

        const ingredients = await this.getIngredients();
        const uniqueProductIds = [...new Set(allRecipes.map(r => r.productId))];

        for (const productId of uniqueProductIds) {
            const productRecipes = allRecipes.filter(r => r.productId === productId);
            let totalCost = 0;
            for (const r of productRecipes) {
                const ing = ingredients.find(i => i.id === r.ingredientId);
                if (ing) totalCost += parseFloat(r.quantity) * (ing.buyPrice || 0);
            }
            const newBuyPrice = Math.round(totalCost);
            if (this.platform !== 'web' && this.db) {
                await this.db.run(`UPDATE products SET buyPrice=? WHERE id=?`, [newBuyPrice, productId]);
            } else {
                let products = await this._get('products');
                products = products.map(p => p.id === productId ? { ...p, buyPrice: newBuyPrice } : p);
                localStorage.setItem(DB_PREFIX + 'products', JSON.stringify(products));
            }
        }
    }

    async getPurchases() {
        const res = await this._get('purchases');
        return res.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    async createTransaction(arg1, arg2) {
        let items, total, discount = 0, tax = 0, paymentMethod = 'cash', paymentProof = null;
        if (Array.isArray(arg1)) { 
            items = arg1; 
            total = arg2; 
        } else { 
            items = arg1.cart; 
            total = arg1.total; 
            discount = arg1.discount || 0; 
            tax = arg1.tax || 0; 
            paymentMethod = arg1.paymentMethod || 'cash'; 
            paymentProof = arg1.paymentProof || null;
        }
        const id = Date.now();
        let totalProfit = 0;
        const transactionItems = [];
        let products = await this.getProducts();
        let ingredients = await this.getIngredients();
        const allRecipes = await this.getRecipes();

        for (const item of items) {
            const product = products.find(p => p.id === item.id);
            if (!product) continue;

            const productRecipe = allRecipes.filter(r => r.productId === product.id);
            const buyPrice = product.buyPrice || 0;

            if (productRecipe.length > 0) {
                // F&B Recipe-based product
                // 1. Check if ingredients have enough stock
                for (const recipeItem of productRecipe) {
                    const ing = ingredients.find(i => i.id === recipeItem.ingredientId);
                    if (!ing) continue;
                    const required = recipeItem.quantity * item.qty;
                    if (ing.stock < required) {
                        throw new Error(`Stok bahan ${ing.name} tidak cukup untuk membuat ${product.name}! Sisa: ${ing.stock} ${ing.unit}, Butuh: ${required} ${ing.unit}`);
                    }
                }
                // 2. Deduct ingredient stock
                for (const recipeItem of productRecipe) {
                    const ing = ingredients.find(i => i.id === recipeItem.ingredientId);
                    if (!ing) continue;
                    ing.stock = ing.stock - (recipeItem.quantity * item.qty);
                    if (this.platform !== 'web' && this.db) {
                        await this.db.run(`UPDATE ingredients SET stock=? WHERE id=?`, [ing.stock, ing.id]);
                    }
                }
            } else {
                // Regular retail product
                if ((product.stock || 0) < item.qty) {
                    throw new Error(`Stok ${product.name} tidak cukup! sisa: ${product.stock}`);
                }
                const newStock = product.stock - item.qty;
                if (this.platform !== 'web' && this.db) {
                    await this.db.run(`UPDATE products SET stock=? WHERE id=?`, [newStock, product.id]);
                } else {
                    product.stock = newStock;
                }
            }

            const profitPerItem = item.price - buyPrice;
            const totalItemProfit = profitPerItem * item.qty;
            totalProfit += totalItemProfit;
            transactionItems.push({ ...item, buyPrice: buyPrice, profit: totalItemProfit });
        }

        totalProfit = totalProfit - discount;
        if (this.platform === 'web' || !this.db) {
            localStorage.setItem(DB_PREFIX + 'products', JSON.stringify(products));
            localStorage.setItem(DB_PREFIX + 'ingredients', JSON.stringify(ingredients));
        }
        const itemsJson = JSON.stringify(transactionItems);
        const dateStr = new Date().toISOString();
        const syncId = uuidv4();
        const deviceId = localStorage.getItem('device_id') || 'unknown-device';
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`INSERT INTO transactions (id, date, total, profit, items, discount, tax, paymentMethod, sync_id, device_id, is_synced, paymentProof) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [id, dateStr, total, totalProfit, itemsJson, discount, tax, paymentMethod, syncId, deviceId, 0, paymentProof]);
        } else {
            const list = await this._get('transactions');
            list.push({ id, date: dateStr, total, profit: totalProfit, items: transactionItems, discount, tax, paymentMethod, sync_id: syncId, device_id: deviceId, is_synced: 0, paymentProof });
            localStorage.setItem(DB_PREFIX + 'transactions', JSON.stringify(list));
        }
        return id;
    }

    async getDailyStats(date = null) {
        const transactions = await this._get('transactions');
        const targetDate = date || new Date().toISOString().split('T')[0];
        const filtered = transactions.filter(t => t.date.startsWith(targetDate));
        const total = filtered.reduce((acc, t) => acc + (t.total || 0), 0);
        const profit = filtered.reduce((acc, t) => acc + (t.profit || 0), 0);
        return { total, profit, count: filtered.length };
    }

    async getTransactions(filterDate) {
        let transactions = await this._get('transactions');
        if (filterDate) { transactions = transactions.filter(t => t.date.startsWith(filterDate)); }
        return transactions.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);
    }

    async getTransactionsRange(startDate, endDate) {
        let transactions = await this._get('transactions');
        if (startDate || endDate) {
            transactions = transactions.filter(t => {
                const txDate = t.date.split('T')[0];
                if (startDate && txDate < startDate) return false;
                if (endDate && txDate > endDate) return false;
                return true;
            });
        }
        return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    }


    async getReturns() {
        if (this.platform !== 'web' && this.db) {
            await this.db.execute(`CREATE TABLE IF NOT EXISTS returns (id INTEGER PRIMARY KEY, date TEXT, total REAL, items TEXT)`);
            const res = await this.db.query(`SELECT * FROM returns`);
            return res.values.map(row => {
                if (row.items && typeof row.items === 'string') { try { row.items = JSON.parse(row.items); } catch (e) { } }
                return row;
            }).sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
            return JSON.parse(localStorage.getItem(DB_PREFIX + 'returns') || '[]').sort((a, b) => new Date(b.date) - new Date(a.date));
        }
    }

    async returnTransaction(transaction) {
        let products = await this.getProducts();
        for (const item of transaction.items) {
            const product = products.find(p => p.id === item.id);
            if (product) {
                const newStock = (product.stock || 0) + (item.qty || 1);
                if (this.platform !== 'web' && this.db) { await this.db.run(`UPDATE products SET stock=? WHERE id=?`, [newStock, product.id]); } else { product.stock = newStock; }
            }
        }
        if (this.platform === 'web' || !this.db) { localStorage.setItem(DB_PREFIX + 'products', JSON.stringify(products)); }
        const itemsJson = JSON.stringify(transaction.items);
        if (this.platform !== 'web' && this.db) {
            await this.db.execute(`CREATE TABLE IF NOT EXISTS returns (id INTEGER PRIMARY KEY, date TEXT, total REAL, items TEXT)`);
            await this.db.run(`INSERT INTO returns (id, date, total, items) VALUES (?,?,?,?)`, [Date.now(), new Date().toISOString(), transaction.total, itemsJson]);
            await this.db.run(`DELETE FROM transactions WHERE id=?`, [transaction.id]);
        } else {
            let returnsList = []; try { returnsList = JSON.parse(localStorage.getItem(DB_PREFIX + 'returns') || '[]'); } catch(e){}
            returnsList.push({ id: Date.now(), date: new Date().toISOString(), total: transaction.total, items: transaction.items });
            localStorage.setItem(DB_PREFIX + 'returns', JSON.stringify(returnsList));
            let list = await this._get('transactions'); list = list.filter(t => t.id !== transaction.id);
            localStorage.setItem(DB_PREFIX + 'transactions', JSON.stringify(list));
        }
    }

    async getDashboardStats() {
        const products = await this.getProducts();
        const transactions = await this._get('transactions');
        const totalStock = products.reduce((acc, p) => acc + (p.stock || 0), 0);
        const lowStock = products.filter(p => (p.stock || 0) < 5);
        const today = new Date().toISOString().split('T')[0];
        const todayTrans = transactions.filter(t => t.date.startsWith(today));
        const todayProfit = todayTrans.reduce((acc, t) => acc + (t.profit || 0), 0);
        const todaySales = todayTrans.reduce((acc, t) => acc + (t.total || 0), 0);
        const salesMap = {};
        transactions.forEach(t => {
            let items = t.items; if (typeof items === 'string') try { items = JSON.parse(items) } catch (e) { }
            if (Array.isArray(items)) {
                items.forEach(item => {
                    if (!salesMap[item.name]) salesMap[item.name] = 0;
                    salesMap[item.name] += item.qty;
                });
            }
        });
        const bestSelling = Object.entries(salesMap).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i); const dateStr = d.toISOString().split('T')[0];
            const dayTrans = transactions.filter(t => t.date.startsWith(dateStr));
            const dayTotal = dayTrans.reduce((acc, t) => acc + t.total, 0);
            const dayProfit = dayTrans.reduce((acc, t) => acc + (t.profit || 0), 0);
            last7Days.push({ name: dateStr, total: dayTotal, profit: dayProfit });
        }
        return { totalStock, lowStockCount: lowStock.length, lowStockItems: lowStock, todayProfit, todaySales, bestSelling, salesTrend: last7Days };
    }

    async exportFullDatabase() {
        const keys = ['products', 'transactions', 'users', 'suppliers', 'brands', 'purchases', 'shifts', 'stock_opname', 'ingredients', 'recipes'];
        const data = {};
        for (const k of keys) { data[k] = await this._get(k); }
        return data;
    }

    async getStockOpnameHistory() {
        const history = await this._get('stock_opname');
        return (history || []).sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    async createStockOpname(data) {
        const id = Date.now();
        const opname = {
            id,
            productId: data.productId,
            productName: data.productName,
            systemStock: data.systemStock,
            actualStock: data.actualStock,
            difference: data.actualStock - data.systemStock,
            date: new Date().toISOString(),
            userId: data.userId,
            notes: data.notes || ''
        };

        if (this.platform !== 'web' && this.db) {
            await this.db.run(`INSERT INTO stock_opname (id, productId, productName, systemStock, actualStock, difference, date, userId, notes) VALUES (?,?,?,?,?,?,?,?,?)`, 
                [opname.id, opname.productId, opname.productName, opname.systemStock, opname.actualStock, opname.difference, opname.date, opname.userId, opname.notes]);
            
            // Update product stock
            await this.db.run(`UPDATE products SET stock=? WHERE id=?`, [opname.actualStock, opname.productId]);
        } else {
            const list = await this._get('stock_opname');
            list.push(opname);
            localStorage.setItem(DB_PREFIX + 'stock_opname', JSON.stringify(list));

            // Update product stock
            let products = await this._get('products');
            products = products.map(p => p.id === data.productId ? { ...p, stock: data.actualStock } : p);
            localStorage.setItem(DB_PREFIX + 'products', JSON.stringify(products));
        }
        return opname;
    }

    async getIngredients() {
        const ingredients = await this._get('ingredients');
        return ingredients.map(i => ({
            ...i,
            stock: i.stock !== undefined ? parseFloat(i.stock) : 0,
            buyPrice: i.buyPrice !== undefined ? parseFloat(i.buyPrice) : 0,
            supplierId: i.supplierId || null
        })).sort((a, b) => a.name.localeCompare(b.name));
    }

    async addIngredient(data) {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        const ing = {
            id,
            name: data.name,
            stock: parseFloat(data.stock || 0),
            unit: data.unit || 'gram',
            buyPrice: parseFloat(data.buyPrice || 0),
            supplierId: data.supplierId ? parseInt(data.supplierId) : null
        };
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`INSERT INTO ingredients (id, name, stock, unit, buyPrice, supplierId) VALUES (?,?,?,?,?,?)`,
                [ing.id, ing.name, ing.stock, ing.unit, ing.buyPrice, ing.supplierId]);
        } else {
            const list = await this._get('ingredients');
            list.push(ing);
            localStorage.setItem(DB_PREFIX + 'ingredients', JSON.stringify(list));
        }
        return ing;
    }

    async updateIngredient(id, data) {
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`UPDATE ingredients SET name=?, stock=?, unit=?, buyPrice=?, supplierId=? WHERE id=?`,
                [data.name, parseFloat(data.stock), data.unit, parseFloat(data.buyPrice), data.supplierId ? parseInt(data.supplierId) : null, id]);
        } else {
            let list = await this._get('ingredients');
            list = list.map(i => i.id === id ? {
                ...i,
                name: data.name,
                stock: parseFloat(data.stock),
                unit: data.unit,
                buyPrice: parseFloat(data.buyPrice),
                supplierId: data.supplierId ? parseInt(data.supplierId) : null
            } : i);
            localStorage.setItem(DB_PREFIX + 'ingredients', JSON.stringify(list));
        }
    }

    async deleteIngredient(id) {
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`DELETE FROM ingredients WHERE id=?`, [id]);
            // Also clean up any recipes containing this ingredient
            await this.db.run(`DELETE FROM recipes WHERE ingredientId=?`, [id]);
        } else {
            let list = await this._get('ingredients');
            localStorage.setItem(DB_PREFIX + 'ingredients', JSON.stringify(list.filter(i => i.id !== id)));
            let recipes = await this._get('recipes');
            localStorage.setItem(DB_PREFIX + 'recipes', JSON.stringify(recipes.filter(r => r.ingredientId !== id)));
        }
    }

    async getRecipes() {
        return await this._get('recipes');
    }

    async updateRecipe(productId, recipeItems) {
        // recipeItems is an array of { ingredientId, quantity }
        if (this.platform !== 'web' && this.db) {
            await this.db.run(`DELETE FROM recipes WHERE productId=?`, [productId]);
            for (const item of recipeItems) {
                const id = Date.now() + Math.floor(Math.random() * 1000);
                await this.db.run(`INSERT INTO recipes (id, productId, ingredientId, quantity) VALUES (?,?,?,?)`,
                    [id, productId, parseInt(item.ingredientId), parseFloat(item.quantity)]);
            }
        } else {
            let recipes = await this._get('recipes');
            // Remove old ones
            recipes = recipes.filter(r => r.productId !== productId);
            // Add new ones
            recipeItems.forEach(item => {
                recipes.push({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    productId,
                    ingredientId: parseInt(item.ingredientId),
                    quantity: parseFloat(item.quantity)
                });
            });
            localStorage.setItem(DB_PREFIX + 'recipes', JSON.stringify(recipes));
        }

        // Auto-update product buyPrice from recipe ingredient costs
        await this._syncRecipeBuyPrice(productId, recipeItems);
    }

    /**
     * Hitung total harga modal dari resep dan update buyPrice produk secara otomatis.
     * Dipanggil setiap kali resep disimpan.
     */
    async _syncRecipeBuyPrice(productId, recipeItems) {
        const ingredients = await this.getIngredients();
        let totalCost = 0;
        for (const item of recipeItems) {
            const ing = ingredients.find(i => i.id === parseInt(item.ingredientId));
            if (ing) {
                totalCost += parseFloat(item.quantity) * (ing.buyPrice || 0);
            }
        }
        const newBuyPrice = Math.round(totalCost);

        if (this.platform !== 'web' && this.db) {
            await this.db.run(`UPDATE products SET buyPrice=? WHERE id=?`, [newBuyPrice, productId]);
        } else {
            let products = await this._get('products');
            products = products.map(p => p.id === productId ? { ...p, buyPrice: newBuyPrice } : p);
            localStorage.setItem(DB_PREFIX + 'products', JSON.stringify(products));
        }
        return newBuyPrice;
    }

    async importFullDatabase(data) {
        if (!data) throw new Error("Data kosong");
        const keys = ['products', 'transactions', 'users', 'suppliers', 'brands', 'purchases', 'shifts', 'stock_opname', 'ingredients', 'recipes'];
        if (this.platform !== 'web' && this.db) {
            for (const k of keys) {
                if (data[k]) {
                    await this.db.run(`DELETE FROM ${k}`);
                    for (const row of data[k]) {
                        const cols = Object.keys(row).join(', ');
                        const placeholders = Object.keys(row).map(() => '?').join(', ');
                        const values = Object.values(row).map(v => {
                            if (typeof v === 'object') return JSON.stringify(v);
                            return v;
                        });
                        await this.db.run(`INSERT INTO ${k} (${cols}) VALUES (${placeholders})`, values);
                    }
                }
            }
        } else {
            keys.forEach(k => { if (data[k]) { localStorage.setItem(DB_PREFIX + k, JSON.stringify(data[k])); } });
        }
    }
}

export const dbService = new DatabaseService();
