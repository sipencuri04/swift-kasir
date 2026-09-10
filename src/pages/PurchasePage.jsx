import React, { useEffect, useState } from 'react';
import { dbService } from '../services/DatabaseService';
import { ShoppingCart, Plus, Minus, Check, Truck, Search, X, ArrowLeft } from 'lucide-react';
import CameraScanner from '../components/CameraScanner';
import { AlertService } from '../utils/AlertService';

const PurchasePage = () => {
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [search, setSearch] = useState('');
    const [purchases, setPurchases] = useState([]);
    const [showCartSheet, setShowCartSheet] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const s = await dbService.getSuppliers();
        const p = await dbService.getProducts();
        const purch = await dbService.getPurchases();
        const recipes = await dbService.getRecipes();
        
        // Filter produk F&B (yang punya resep) agar tidak muncul di halaman restok produk biasa
        const nonFnbProducts = p.filter(prod => !recipes.some(r => r.productId === prod.id));

        setSuppliers(s);
        setProducts(nonFnbProducts);
        setPurchases(purch.slice(0, 10)); // Top 10 recent
    };

    const updateCartItem = (id, field, value) => {
        setCart(cart.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(i => i.id !== id));
    };

    const handleCheckout = async () => {
        if (cart.length === 0) {
            AlertService.error('Ups!', 'Belum ada barang yang dipilih!');
            return;
        }

        const totalCost = cart.reduce((acc, i) => acc + ((parseFloat(i.cost) || 0) * (parseFloat(i.qty) || 0)), 0);

        if (await AlertService.confirm('Konfirmasi Restok', `Proses Restok Total: Rp ${totalCost.toLocaleString('id-ID')}?`)) {
            await dbService.createPurchase(selectedSupplier, cart.map(i => ({...i, cost: parseFloat(i.cost) || 0, qty: parseFloat(i.qty) || 0})), totalCost);
            AlertService.success('Berhasil!', 'Restok Berhasil!');
            setCart([]);
            setSelectedSupplier('');
            setShowCartSheet(false);
            loadData();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleBarcodeScan(search);
        }
    };

    const handleBarcodeScan = (barcodeText) => {
        const matches = products.filter(p => 
            String(p.name || '').toLowerCase().includes(barcodeText.toLowerCase()) ||
            String(p.barcode || '').toLowerCase() === barcodeText.toLowerCase()
        );
        if (matches.length === 1) {
            addToCart(matches[0]);
            setSearch('');
        } else if (matches.length > 1) {
            const exact = matches.find(p => 
                String(p.name || '').toLowerCase() === barcodeText.toLowerCase() ||
                String(p.barcode || '').toLowerCase() === barcodeText.toLowerCase()
            );
            if (exact) {
                addToCart(exact);
                setSearch('');
            } else {
                setSearch(barcodeText);
            }
        } else {
            setSearch(barcodeText);
        }
    };

    const addToCart = (product) => {
        const existing = cart.find(i => i.id === product.id);
        if (existing) {
            setCart(cart.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
        } else {
            setCart([...cart, {
                id: product.id,
                name: product.name,
                currentStock: product.stock,
                qty: 1,
                cost: product.buyPrice || 0
            }]);
        }
        setSearch(''); // Clear search after adding
    };

    const totalEstimate = cart.reduce((acc, i) => acc + ((parseFloat(i.cost) || 0) * (parseFloat(i.qty) || 0)), 0);

    const filteredProducts = search.trim() === '' 
        ? products.slice(0, 40) // Limit default list to prevent lag
        : products.filter(p => 
            String(p.name || '').toLowerCase().includes(search.toLowerCase()) ||
            String(p.barcode || '').toLowerCase().includes(search.toLowerCase())
        ).slice(0, 40);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

            <style>{`
                .restock-container {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    padding-bottom: 90px;
                    overflow-y: auto;
                    height: 100%;
                }
                @media (min-width: 768px) and (orientation: landscape), (min-width: 1024px) {
                    .restock-container {
                        display: grid;
                        grid-template-columns: 340px 1fr;
                        align-items: start;
                        padding-bottom: 16px;
                        overflow-y: visible;
                    }
                    .cart-table-wrapper {
                        position: sticky;
                        top: 0;
                    }
                }
                .product-pick-list {
                    margin-top: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    flex: 1;
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding-right: 4px;
                }
                @media (orientation: portrait) { 
                    .desktop-only { display: none !important; } 
                }
                @media (orientation: landscape), (min-width: 1024px) { 
                    .mobile-only { display: none !important; } 
                }
                .product-list-item {
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    transition: all 0.2s;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 12px;
                    background: var(--bg-color);
                }
                .product-list-item:hover {
                    border-color: var(--primary);
                    background: var(--input-bg);
                }
                .product-list-add {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: var(--primary);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-left: auto;
                }
                
                /* Custom scrollbar for the product pick list and table */
                .product-pick-list::-webkit-scrollbar, .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .product-pick-list::-webkit-scrollbar-track, .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .product-pick-list::-webkit-scrollbar-thumb, .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            `}</style>

            <div className="restock-container">
                {/* LEFT PANEL: Selection */}
                <div className="card bg-dark" style={{ margin: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div className="flex items-center gap-2 mb-4">
                        <Truck className="text-accent" />
                        <h2 style={{ margin: 0, fontSize: 18 }}>Pilih Barang Restok</h2>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--text-muted)' }}>Pilih Supplier</label>
                        <select
                            value={selectedSupplier}
                            onChange={e => setSelectedSupplier(e.target.value)}
                            className="modern-input"
                            style={{ width: '100%' }}
                        >
                            <option value="">-- Tanpa Supplier / Umum --</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <div className="flex gap-2">
                            <div className="modern-input-group" style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                                <Search size={20} className="text-muted" />
                                <input
                                    placeholder="Cari / scan barcode..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    style={{ fontSize: 14, width: '100%', outline: 'none' }}
                                />
                                {search && <X size={16} className="text-muted" onClick={() => setSearch('')} style={{ cursor: 'pointer' }} />}
                            </div>
                            <div style={{ flexShrink: 0 }}>
                                <CameraScanner onScan={handleBarcodeScan} />
                            </div>
                        </div>

                        {/* Inline Product List */}
                        <div className="product-pick-list">
                            {filteredProducts.length === 0 ? (
                                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Barang tidak ditemukan</div>
                            ) : (
                                filteredProducts.map(p => (
                                    <div 
                                        key={p.id} 
                                        onClick={() => addToCart(p)}
                                        className="product-list-item"
                                    >
                                        <div className="product-list-img" style={{ width: 40, height: 40, background: 'var(--input-bg)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                            {p.image ? (
                                                <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <span className="placeholder" style={{ fontSize: 16 }}>📦</span>
                                            )}
                                        </div>
                                        <div className="product-list-info" style={{ flex: 1 }}>
                                            <div className="product-list-name" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 2, whiteSpace: 'normal', wordBreak: 'break-word', display: 'block' }}>{p.name}</div>
                                            <div className="product-list-stock" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stok saat ini: {p.stock}</div>
                                        </div>
                                        <div className="product-list-add">
                                            <Plus size={14} />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL: Cart & Checkout */}
                <div className="cart-table-wrapper desktop-only">
                    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--input-bg)', fontWeight: 'bold', color: 'var(--text-main)' }}>
                            Daftar Restok ({cart.length} Item)
                        </div>
                        <div className="table-container custom-scrollbar" style={{ border: 'none', borderRadius: 0, overflowY: 'auto', overflowX: 'auto', maxHeight: '40vh' }}>
                            <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: 14 }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'var(--input-bg)', zIndex: 10 }}>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Barang</th>
                                        <th style={{ padding: '12px 16px', width: 100, textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Jml Restok</th>
                                        <th style={{ padding: '12px 16px', width: 150, textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Harga Beli</th>
                                        <th style={{ padding: '12px 16px', width: 140, textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Total</th>
                                        <th style={{ padding: '12px 16px', width: 50 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                                                <ShoppingCart size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                                                Belum ada barang yang dipilih.<br/>Cari atau scan barang di samping untuk memulai.
                                            </td>
                                        </tr>
                                    ) : (
                                        cart.map(item => (
                                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '16px' }}>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.name}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Sisa Stok: {item.currentStock}</div>
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                    <input
                                                        type="number"
                                                        value={item.qty === 0 ? '' : item.qty}
                                                        onChange={e => updateCartItem(item.id, 'qty', e.target.value)}
                                                        style={{ width: '70px', padding: '8px', textAlign: 'center', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: 14 }}
                                                    />
                                                </td>
                                                <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                        <span style={{ position: 'absolute', left: 10, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Rp</span>
                                                        <input
                                                            type="number"
                                                            value={item.cost === 0 ? '' : item.cost}
                                                            onChange={e => updateCartItem(item.id, 'cost', e.target.value)}
                                                            style={{ width: '100%', padding: '8px 8px 8px 32px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: 14 }}
                                                        />
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'right', verticalAlign: 'middle', fontWeight: 'bold', color: 'var(--text-main)', fontSize: 15 }}>
                                                    Rp {((parseFloat(item.qty) || 0) * (parseFloat(item.cost) || 0)).toLocaleString('id-ID')}
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                    <button
                                                        onClick={() => removeFromCart(item.id)}
                                                        className="btn-icon"
                                                        style={{ color: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)', border: 'none', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="card" style={{ background: 'var(--card-bg)' }}>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <span className="text-muted" style={{ fontWeight: 600 }}>Total Estimasi Restok</span>
                                <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--primary)', marginTop: 4 }}>
                                    Rp {totalEstimate.toLocaleString('id-ID')}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <button className="btn" onClick={handleCheckout} disabled={cart.length === 0} style={{ minWidth: 150, height: 48 }}>
                                    <Check size={20} /> Simpan Restok
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile: Cart Bar */}
            {cart.length > 0 && !showCartSheet && (
                <div className="cart-compact-bar mobile-only" onClick={() => setShowCartSheet(true)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShoppingCart size={20} />
                        <span style={{ fontWeight: 'bold' }}>{cart.length} Item Restok</span>
                    </div>
                    <div style={{ fontWeight: 'bold' }}>Rp {totalEstimate.toLocaleString('id-ID')}</div>
                </div>
            )}

            {/* Mobile: Cart Sheet */}
            {showCartSheet && (
                <>
                    <div className="cart-sheet-overlay mobile-only" onClick={() => setShowCartSheet(false)} />
                    <div className="cart-sheet mobile-only" style={{ padding: 0 }}>
                        <div style={{ background: 'var(--card-bg)', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--input-bg)', fontWeight: 'bold', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', borderRadius: '20px 20px 0 0' }}>
                                <span>Daftar Restok ({cart.length} Item)</span>
                                <X size={20} onClick={() => setShowCartSheet(false)} style={{ cursor: 'pointer' }} />
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                                {cart.map(item => (
                                    <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, background: 'var(--bg-color)', padding: 12, borderRadius: 10, border: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ fontWeight: 600, flex: 1, paddingRight: 8 }}>{item.name}</div>
                                            <button onClick={() => removeFromCart(item.id)} className="btn-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: 'none', padding: 4, borderRadius: 4, cursor: 'pointer' }}>
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jml Restok</label>
                                                <input type="number" value={item.qty === 0 ? '' : item.qty} onChange={e => updateCartItem(item.id, 'qty', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--card-bg)' }} />
                                            </div>
                                            <div style={{ flex: 2 }}>
                                                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Harga Beli</label>
                                                <input type="number" value={item.cost === 0 ? '' : item.cost} onChange={e => updateCartItem(item.id, 'cost', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--card-bg)' }} />
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)', marginTop: 4 }}>
                                            Total: Rp {((parseFloat(item.qty) || 0) * (parseFloat(item.cost) || 0)).toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ padding: 16, borderTop: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <span style={{ fontWeight: 600 }}>Total Estimasi</span>
                                    <span style={{ fontWeight: 'bold', fontSize: 18, color: 'var(--primary)' }}>Rp {totalEstimate.toLocaleString('id-ID')}</span>
                                </div>
                                <button className="btn" onClick={handleCheckout} disabled={cart.length === 0} style={{ width: '100%' }}>
                                    <Check size={20} /> Simpan Restok
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default PurchasePage;
