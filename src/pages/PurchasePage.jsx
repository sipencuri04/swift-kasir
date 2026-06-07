import React, { useEffect, useState } from 'react';
import { dbService } from '../services/DatabaseService';
import { ShoppingCart, Plus, Minus, Check, Truck, Search, X } from 'lucide-react';
import CameraScanner from '../components/CameraScanner';
import { AlertService } from '../utils/AlertService';

const PurchasePage = () => {
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [search, setSearch] = useState('');
    const [purchases, setPurchases] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const s = await dbService.getSuppliers();
        const p = await dbService.getProducts();
        const purch = await dbService.getPurchases();
        setSuppliers(s);
        setProducts(p);
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
            (p.name || '').toLowerCase().includes(barcodeText.toLowerCase()) ||
            (p.barcode || '').toLowerCase() === barcodeText.toLowerCase()
        );
        if (matches.length === 1) {
            addToCart(matches[0]);
            setSearch('');
        } else if (matches.length > 1) {
            const exact = matches.find(p => 
                (p.name || '').toLowerCase() === barcodeText.toLowerCase() ||
                (p.barcode || '').toLowerCase() === barcodeText.toLowerCase()
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
            (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.barcode || '').toLowerCase().includes(search.toLowerCase())
        ).slice(0, 40);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <style>{`
                .restock-container {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    overflow-x: hidden;
                }
                @media (min-width: 768px), (orientation: landscape) {
                    .restock-container {
                        display: grid;
                        grid-template-columns: 340px 1fr;
                        align-items: start;
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
                    max-height: calc(100vh - 400px);
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding-right: 4px;
                }
                
                /* Custom scrollbar for the product pick list and table */
                .product-pick-list::-webkit-scrollbar, .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .product-pick-list::-webkit-scrollbar-track, .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .product-pick-list::-webkit-scrollbar-thumb, .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            `}</style>

            <div className="restock-container">
                {/* LEFT PANEL: Selection */}
                <div className="card bg-dark" style={{ margin: 0 }}>
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
                                        style={{ padding: '8px 12px', background: 'var(--bg-color)' }}
                                    >
                                        <div className="product-list-img" style={{ width: 40, height: 40 }}>
                                            {p.image ? (
                                                <img src={p.image} alt={p.name} />
                                            ) : (
                                                <span className="placeholder" style={{ fontSize: 16 }}>📦</span>
                                            )}
                                        </div>
                                        <div className="product-list-info">
                                            <div className="product-list-name" style={{ fontSize: 13 }}>{p.name}</div>
                                            <div className="product-list-stock" style={{ fontSize: 11 }}>Stok: {p.stock}</div>
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
                <div className="cart-table-wrapper">
                    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--input-bg)', fontWeight: 'bold', color: 'var(--text-main)' }}>
                            Daftar Restok ({cart.length} Item)
                        </div>
                        <div className="table-container custom-scrollbar" style={{ border: 'none', borderRadius: 0, maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'var(--input-bg)', zIndex: 10 }}>
                                    <tr className="table-header-row">
                                        <th style={{ padding: 12 }}>Barang</th>
                                        <th style={{ padding: 12, width: 80, display: 'none' }} className="hide-mobile">Stok Saat Ini</th>
                                        <th style={{ padding: 12, width: 100 }}>Jml Restok</th>
                                        <th style={{ padding: 12, width: 140 }}>Harga Beli</th>
                                        <th style={{ padding: 12, width: 140, textAlign: 'right' }}>Total</th>
                                        <th style={{ padding: 12, width: 50 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                                                Belum ada barang yang dipilih. Cari barang di atas untuk memulai.
                                            </td>
                                        </tr>
                                    ) : (
                                        cart.map(item => (
                                            <tr key={item.id} className="table-row">
                                                <td style={{ padding: 12 }}>
                                                    <div style={{ fontWeight: 500 }}>{item.name}</div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Sisa: {item.currentStock}</div>
                                                </td>
                                                <td style={{ padding: 12, color: 'var(--text-muted)', display: 'none' }} className="hide-mobile">{item.currentStock}</td>
                                                <td style={{ padding: 12 }}>
                                                    <input
                                                        type="number"
                                                        value={item.qty === 0 ? '' : item.qty}
                                                        onChange={e => updateCartItem(item.id, 'qty', e.target.value)}
                                                        className="modern-input"
                                                        style={{ width: '100%', padding: '8px', textAlign: 'center' }}
                                                    />
                                                </td>
                                                <td style={{ padding: 12 }}>
                                                    <input
                                                        type="number"
                                                        value={item.cost === 0 ? '' : item.cost}
                                                        onChange={e => updateCartItem(item.id, 'cost', e.target.value)}
                                                        className="modern-input"
                                                        style={{ width: '100%', padding: '8px' }}
                                                    />
                                                </td>
                                                <td style={{ padding: 12, textAlign: 'right', fontWeight: 'bold' }}>
                                                    Rp {((parseFloat(item.qty) || 0) * (parseFloat(item.cost) || 0)).toLocaleString('id-ID')}
                                                </td>
                                                <td style={{ padding: 12, textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => removeFromCart(item.id)}
                                                        className="btn-icon"
                                                        style={{ color: 'var(--error)', background: 'transparent', border: 'none' }}
                                                    >
                                                        <X size={18} />
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
        </div>
    );
};

export default PurchasePage;
