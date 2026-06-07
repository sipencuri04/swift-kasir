import React, { useEffect, useState } from 'react';
import { dbService } from '../services/DatabaseService';
import { Plus, Search, Save, Trash, ShoppingCart, Archive, TrendingUp } from 'lucide-react';
import { AlertService } from '../utils/AlertService';

const RestockPage = () => {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]); // { product, qty, cost }
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        const data = await dbService.getProducts();
        setProducts(data);
    };

    const addToCart = (product) => {
        const existing = cart.find(i => i.id === product.id);
        if (existing) {
            setCart(cart.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
        } else {
            setCart([...cart, { ...product, id: product.id, qty: 1, cost: product.buyPrice || 0 }]);
        }
    };

    const updateItem = (id, field, value) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(i => i.id !== id));
    };

    const handleSubmit = async () => {
        if (cart.length === 0) return;
        setLoading(true);
        try {
            const total = cart.reduce((acc, item) => acc + (item.cost * item.qty), 0);
            const items = cart.map(i => ({
                id: i.id,
                qty: parseInt(i.qty),
                cost: parseFloat(i.cost)
            }));

            await dbService.createPurchase(null, items, total); // supplierId null for now
            AlertService.success('Berhasil', 'Stok berhasil ditambahkan!');
            setCart([]);
            loadProducts(); // Refresh stock counts
        } catch (e) {
            AlertService.error('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredAndSorted = products
        .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.stock - b.stock); // Show low stock first

    const totalCost = cart.reduce((acc, item) => acc + (item.cost * item.qty), 0);

    return (
        <div className="page-container">
            <h1 style={{ borderLeftColor: '#3b82f6' }}>Restok Barang</h1>

            <div className="grid-2" style={{ alignItems: 'start', gridTemplateColumns: '1.2fr 0.8fr' }}>

                {/* Product List */}
                <div className="card" style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
                    <div className="input-group">
                        <div className="modern-input-group">
                            <Search size={18} color="#94a3b8" />
                            <input
                                type="text"
                                placeholder="Cari barang..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }} className="product-list">
                        {filteredAndSorted.map(p => (
                            <div key={p.id} className="product-card" onClick={() => addToCart(p)}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                        Current Stock: <span style={{ color: p.stock < 5 ? '#ef4444' : '#22c55e' }}>{p.stock}</span>
                                    </div>
                                </div>
                                <button className="btn btn-circle btn-outline" style={{ width: 32, height: 32 }}>
                                    <Plus size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Cart / Purchase Order */}
                <div className="card" style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: 16, pb: 16, borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600 }}>Purchase Order</span>
                        <span style={{ fontWeight: 600 }}>{cart.length} Items</span>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {cart.length === 0 ? (
                            <div style={{ textAlign: 'center', opacity: 0.5, marginTop: 40 }}>
                                <Archive size={40} style={{ marginBottom: 12 }} />
                                <div>Pilih barang untuk restok</div>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.id} style={{ background: '#0f172a', padding: 12, borderRadius: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <span style={{ fontWeight: 500 }}>{item.name}</span>
                                        <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                            <Trash size={14} />
                                        </button>
                                    </div>
                                    <div className="grid-2" style={{ gap: 8 }}>
                                        <div>
                                            <label style={{ fontSize: 10 }}>Qty</label>
                                            <input
                                                type="number"
                                                value={item.qty}
                                                onChange={e => updateItem(item.id, 'qty', e.target.value)}
                                                style={{ padding: 6, fontSize: 13 }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 10 }}>Buy Price</label>
                                            <input
                                                type="number"
                                                value={item.cost}
                                                onChange={e => updateItem(item.id, 'cost', e.target.value)}
                                                style={{ padding: 6, fontSize: 13 }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12, textAlign: 'right', marginTop: 4, color: '#94a3b8' }}>
                                        Subtotal: Rp {(item.cost * item.qty).toLocaleString()}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #334155' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 18, fontWeight: 'bold' }}>
                            <span>Total</span>
                            <span>Rp {totalCost.toLocaleString()}</span>
                        </div>
                        <button
                            className="btn btn-success"
                            disabled={loading || cart.length === 0}
                            onClick={handleSubmit}
                        >
                            {loading ? 'Processing...' : 'Simpan Restok'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RestockPage;
