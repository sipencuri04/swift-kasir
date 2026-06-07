import React, { useEffect, useState } from 'react';
import { dbService } from '../services/DatabaseService';
import { printerService } from '../services/PrinterService';
import { Plus, Minus, Trash, Printer, Search, ShoppingCart, ChevronDown, Check, X, Delete } from 'lucide-react';
import CameraScanner from '../components/CameraScanner';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import { AlertService } from '../utils/AlertService';

const PosPage = () => {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCartSheet, setShowCartSheet] = useState(false);

    // Transaction State
    const [discount, setDiscount] = useState(0);
    const [taxRate, setTaxRate] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [cashReceived, setCashReceived] = useState('');
    const [showNumpad, setShowNumpad] = useState(() => {
        const saved = localStorage.getItem('pos_showNumpad');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [showPreview, setShowPreview] = useState(false);

    // Numpad logic — no system keyboard
    const handleNumpad = (val) => {
        if (val === 'C') {
            setCashReceived('');
        } else if (val === '⌫') {
            setCashReceived(prev => prev.slice(0, -1));
        } else {
            setCashReceived(prev => {
                const current = prev === '0' ? '' : (prev || '');
                return current + val;
            });
        }
    };

    const handleQuickCash = (amount) => {
        if (amount === 'pas') {
            setCashReceived(total.toString());
        } else {
            setCashReceived(amount.toString());
        }
    };

    useEffect(() => { loadProducts(); }, []);

    useEffect(() => {
        localStorage.setItem('pos_showNumpad', JSON.stringify(showNumpad));
    }, [showNumpad]);

    const loadProducts = async () => {
        const prods = await dbService.getProducts();
        const ingredients = await dbService.getIngredients();
        const recipes = await dbService.getRecipes();

        const mappedProducts = prods.map(p => {
            const productRecipes = recipes.filter(r => r.productId === p.id);
            if (productRecipes.length > 0) {
                const limits = productRecipes.map(r => {
                    const ing = ingredients.find(i => i.id === r.ingredientId);
                    if (!ing) return 0;
                    return (ing.stock || 0) / r.quantity;
                });
                const effectiveStock = Math.floor(Math.min(...limits));
                return { ...p, stock: effectiveStock, isFB: true };
            }
            return { ...p, isFB: false };
        });

        setProducts(mappedProducts);
    };

    const addToCart = (product) => {
        if ((product.stock || 0) <= 0) {
            AlertService.error('Ups!', 'Stok barang habis!');
            return;
        }
        setCart(prev => {
            const existing = prev.find(p => p.id === product.id);
            if (existing) {
                if (existing.qty >= product.stock) return prev;
                return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
            }
            return [...prev, { ...product, qty: 1 }];
        });
    };

    const updateQty = (id, delta) => {
        setCart(prev => prev.map(p => {
            if (p.id === id) {
                const product = products.find(prod => prod.id === id);
                const newQty = Math.max(1, p.qty + delta);
                if (product && newQty > product.stock) return p;
                return { ...p, qty: newQty };
            }
            return p;
        }));
    };

    const removeFromCart = (id) => {
        setCart(prev => prev.filter(p => p.id !== id));
        if (cart.length <= 1) setShowCartSheet(false);
    };

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const parsedDiscount = parseFloat(discount) || 0;
    const taxAmount = (subtotal - parsedDiscount) * (taxRate / 100);
    const total = Math.max(0, (subtotal - parsedDiscount) + taxAmount);
    const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);

    const cashVal = parseFloat(cashReceived) || 0;
    const change = cashVal - total;
    const canPay = cart.length > 0 && (paymentMethod === 'qris' || cashVal >= total);

    const handlePayAndPrint = async (proof = null) => {
        if (cart.length === 0) {
            AlertService.error('Keranjang Kosong', 'Silakan pilih produk terlebih dahulu.');
            return;
        }
        if (paymentMethod === 'cash' && cashVal < total) {
            AlertService.error('Pembayaran Gagal', `Uang masih kurang Rp ${(total - cashVal).toLocaleString('id-ID')}.`);
            return;
        }

        setLoading(true);
        try {
            // 1. Simpan data transaksi
            const transactionData = { cart, total, subtotal, discount: parsedDiscount, tax: taxAmount, paymentMethod, cashReceived: cashVal, change, paymentProof: proof };
            const transactionId = await dbService.createTransaction(transactionData);

            // 2. Siapkan data untuk struk & alert sebelum cart direset
            const finalChange = change;
            const finalCart = [...cart];
            const finalTotal = total;
            const dateStr = new Date().toLocaleString('id-ID');
            const sName = localStorage.getItem('store_name') || 'SWIFT KASIR';
            const sAddr = localStorage.getItem('store_address') || '';

            // 3. Reset UI & Loading segera (agar user tidak merasa "stuck")
            setCart([]); 
            setDiscount(0); 
            setTaxRate(0);
            setCashReceived(''); 
            setPaymentMethod('cash');
            setShowCartSheet(false);
            setLoading(false);
            loadProducts();

            // 4. Tampilkan Alert Sukses
            await AlertService.success('Transaksi Berhasil!', '', `
                <div style="text-align:center;">
                    <p style="color:var(--text-muted);margin-bottom:8px;">Kembalian Pelanggan:</p>
                    <h1 style="font-size:36px;font-weight:800;color:var(--primary);margin:0;">Rp ${finalChange.toLocaleString('id-ID')}</h1>
                </div>`);

            // 5. Cetak Struk (dilakukan setelah alert ditutup agar tidak mengganggu UI)
            try {
                await printerService.printReceipt(sName, finalCart, finalTotal, dateStr, sAddr, transactionId);
            } catch (printErr) {
                console.error("Print error:", printErr);
                AlertService.info('Printer Tidak Terhubung', 'Transaksi tersimpan, namun gagal mencetak struk.');
            }

        } catch (err) {
            console.error("Transaction error:", err);
            AlertService.error('Gagal', err.message);
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(p =>
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode || '').toLowerCase().includes(search.toLowerCase())
    );

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleBarcodeScan(search); }
    };

    const handleCheckoutAttempt = () => {
        if (cart.length === 0) {
            AlertService.error('Keranjang Kosong', 'Silakan pilih produk terlebih dahulu.');
            return;
        }
        if (paymentMethod === 'cash' && cashVal < total) {
            AlertService.error('Pembayaran Gagal', `Uang masih kurang Rp ${(total - cashVal).toLocaleString('id-ID')}.`);
            return;
        }
        setShowPreview(true);
    };

    useEffect(() => {
        let buffer = '';
        let lastTime = 0;

        const handler = (e) => {
            const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

            if (e.key === 'Enter') {
                if (isInput) {
                    if (document.activeElement?.placeholder?.includes('Cari')) return;
                } else {
                    if (buffer.length > 2) {
                        e.preventDefault();
                        handleBarcodeScan(buffer);
                        buffer = '';
                        return;
                    }
                    if (document.activeElement?.tagName === 'BUTTON') return;
                    e.preventDefault();
                    handleCheckoutAttempt();
                }
            } else {
                if (!isInput) {
                    const currentTime = new Date().getTime();
                    if (currentTime - lastTime > 50) { 
                        buffer = '';
                    }
                    if (e.key.length === 1) {
                        buffer += e.key;
                    }
                    lastTime = currentTime;
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    });

    const handleBarcodeScan = (text) => {
        const matches = products.filter(p =>
            (p.name || '').toLowerCase().includes(text.toLowerCase()) ||
            (p.barcode || '').toLowerCase() === text.toLowerCase()
        );
        if (matches.length === 1) { addToCart(matches[0]); setSearch(''); }
        else if (matches.length > 1) {
            const exact = matches.find(p => (p.barcode || '').toLowerCase() === text.toLowerCase());
            if (exact) { addToCart(exact); setSearch(''); } else setSearch(text);
        } else setSearch(text);
    };

    // ─── CART PANEL ───────────────────────────────────────────────────────────
    const cartContent = (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, flex: 1, gap: 0 }}>

            {/* Header */}
            <div style={{ padding: '0 0 12px 0', borderBottom: '2px solid var(--border-color)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <h2 style={{ fontSize: 17, margin: 0 }}>🛒 Keranjang</h2>
                <div style={{ background: 'var(--primary-bg)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 'bold' }}>
                    {totalItems} Item
                </div>
            </div>

            {/* Daftar Item */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2, marginBottom: 12 }}>
                {cart.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                        <ShoppingCart size={36} style={{ opacity: 0.15, display: 'block', margin: '0 auto 8px' }} />
                        <small>Belum ada barang</small>
                    </div>
                ) : (
                    cart.map(item => (
                        <div key={item.id} style={{ display: 'flex', gap: 8, marginBottom: 8, background: 'var(--card-bg)', padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{item.qty} × {item.price.toLocaleString('id-ID')}</span>
                                    <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 12 }}>Rp {(item.qty * item.price).toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, borderLeft: '1px solid var(--border-color)', paddingLeft: 8, flexShrink: 0 }}>
                                <button className="btn btn-outline" style={{ width: 24, height: 24, padding: 0, borderRadius: 6 }} onClick={() => updateQty(item.id, -1)}><Minus size={11} /></button>
                                <input
                                    type="number"
                                    min="1"
                                    value={item.qty === 0 ? '' : item.qty}
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? '' : parseInt(e.target.value);
                                        setCart(prev => prev.map(p => {
                                            if (p.id === item.id) {
                                                const product = products.find(prod => prod.id === item.id);
                                                const newQty = val === '' ? 0 : Math.max(1, val);
                                                if (product && newQty > product.stock) return { ...p, qty: product.stock };
                                                return { ...p, qty: newQty };
                                            }
                                            return p;
                                        }));
                                    }}
                                    onBlur={(e) => {
                                        if (e.target.value === '' || e.target.value === '0') {
                                            setCart(prev => prev.map(p => p.id === item.id ? { ...p, qty: 1 } : p));
                                        }
                                    }}
                                    style={{
                                        width: '36px',
                                        height: '24px',
                                        textAlign: 'center',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        padding: '0 4px',
                                        outline: 'none',
                                        background: 'var(--input-bg)',
                                        color: 'var(--text-main)',
                                        MozAppearance: 'textfield'
                                    }}
                                    className="no-spinners"
                                />
                                <button className="btn btn-outline" style={{ width: 24, height: 24, padding: 0, borderRadius: 6 }} onClick={() => updateQty(item.id, 1)}><Plus size={11} /></button>
                                <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 3, marginLeft: 2 }}><Trash size={13} /></button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Panel Pembayaran */}
            <div style={{ background: 'var(--bg-color)', borderRadius: 18, border: '1px solid var(--border-color)', padding: 14, flexShrink: 0 }}>

                {/* Display uang tunai */}
                <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1 }}>UANG TUNAI</span>
                        <button
                            onClick={() => setShowNumpad(p => !p)}
                            style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                            {showNumpad ? '▲ Sembunyikan' : '▼ Tampilkan'} Numpad
                        </button>
                    </div>
                    <div style={{
                        background: 'var(--card-bg)',
                        border: `2px solid ${showNumpad ? 'var(--border-color)' : 'var(--primary)'}`,
                        borderRadius: 12,
                        padding: 'clamp(8px, 1.5vh, 14px) 16px',
                        fontSize: 'clamp(20px, 3vh, 26px)',
                        fontWeight: 900,
                        color: 'var(--primary)',
                        textAlign: 'right',
                        letterSpacing: -0.5,
                        minHeight: 'clamp(40px, 6vh, 56px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end'
                    }}>
                        {showNumpad ? (
                            // Mode Numpad: tampilkan teks saja (readOnly)
                            cashReceived === '' 
                                ? <span style={{ color: 'var(--border-color)' }}>0</span> 
                                : `Rp ${parseInt(cashReceived).toLocaleString('id-ID')}`
                        ) : (
                            // Mode Keyboard Eksternal: input aktif
                            <input
                                type="number"
                                autoFocus
                                value={cashReceived}
                                onChange={e => setCashReceived(e.target.value)}
                                placeholder="0"
                                disabled={paymentMethod === 'transfer'}
                                style={{
                                    width: '100%',
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    fontSize: 26,
                                    fontWeight: 900,
                                    color: 'var(--primary)',
                                    textAlign: 'right',
                                    padding: 0,
                                }}
                            />
                        )}
                    </div>
                </div>

                {/* Tombol Uang Cepat + Numpad — hanya tampil jika showNumpad = true */}
                {paymentMethod === 'cash' && showNumpad && (

                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        {[
                            { label: 'Rp 50rb', val: 50000 },
                            { label: 'Rp 100rb', val: 100000 },
                            { label: 'Uang Pas', val: 'pas' },
                        ].map(btn => (
                            <button
                                key={btn.label}
                                onClick={() => handleQuickCash(btn.val)}
                                style={{
                                    flex: 1, padding: '7px 4px', borderRadius: 8, border: '1px solid var(--primary)',
                                    background: btn.val === 'pas' ? 'var(--primary)' : 'var(--primary-bg)',
                                    color: btn.val === 'pas' ? 'white' : 'var(--primary)',
                                    fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                                }}
                            >{btn.label}</button>
                        ))}
                    </div>
                )}

                {/* Numpad 3×4 */}
                {paymentMethod === 'cash' && showNumpad && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '000', 0, '⌫'].map((n) => (
                            <button
                                key={n}
                                onClick={() => handleNumpad(n.toString())}
                                style={{
                                    padding: 'clamp(8px, 2vh, 16px) 0',
                                    borderRadius: 10,
                                    border: '1px solid var(--border-color)',
                                    background: n === '⌫' ? 'var(--error-bg)' : 'var(--card-bg)',
                                    color: n === '⌫' ? 'var(--error)' : 'var(--text-main)',
                                    fontSize: n === '⌫' ? 14 : 18,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 0 var(--border-color)',
                                    transition: 'all 0.08s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                onMouseDown={e => e.currentTarget.style.transform = 'translateY(2px)'}
                                onMouseUp={e => e.currentTarget.style.transform = ''}
                            >
                                {n === '⌫' ? <Delete size={16} /> : n}
                            </button>
                        ))}
                    </div>
                )}

                {/* Metode & Kembalian */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 4 }}>METODE</div>
                        <select
                            className="modern-select"
                            style={{ fontSize: 13, padding: '8px 10px' }}
                            value={paymentMethod}
                            onChange={e => { setPaymentMethod(e.target.value); if (e.target.value === 'qris') setCashReceived(total.toString()); }}
                        >
                            <option value="cash">💵 Tunai</option>
                            <option value="qris">📱 QRIS</option>
                        </select>
                    </div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 4 }}>KEMBALIAN</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: change < 0 ? 'var(--error)' : 'var(--success)' }}>
                            {paymentMethod === 'qris' ? '✓ LUNAS' : (change < 0 ? '-' : `Rp ${change.toLocaleString('id-ID')}`)}
                        </div>
                    </div>
                </div>

                {/* Total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '2px solid var(--border-color)', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)' }}>TOTAL</span>
                    <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--primary)' }}>Rp {total.toLocaleString('id-ID')}</span>
                </div>

                {/* Tombol Bayar */}
                <button
                    className="btn"
                    onClick={() => canPay && setShowPreview(true)}
                    disabled={loading || !canPay}
                    style={{
                        height: 52, fontSize: 16, fontWeight: 800,
                        background: canPay
                            ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))'
                            : 'var(--border-color)',
                        color: canPay ? 'white' : 'var(--text-muted)',
                        cursor: canPay ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s'
                    }}
                >
                    {loading ? 'Memproses...' : <><Check size={20} /> BAYAR SEKARANG</>}
                </button>
            </div>
        </div>
    );

    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div className="page-container pos-page-container" style={{ paddingBottom: 0 }}>
            <div className="pos-layout">

                {/* Kiri: Produk */}
                <div className="pos-products">
                    <div className="sticky-search pos-header-flex">
                        <div className="pos-search-box">
                            <div className="modern-input-group" style={{ background: 'var(--card-bg)', boxShadow: 'var(--shadow)' }}>
                                <Search size={18} color="var(--text-muted)" />
                                <input placeholder="Cari barang atau scan barcode..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleKeyDown} />
                                {search && <X size={16} color="var(--text-muted)" onClick={() => setSearch('')} style={{ cursor: 'pointer' }} />}
                            </div>
                        </div>
                        <div className="pos-camera-btn">
                            <CameraScanner onScan={handleBarcodeScan} />
                        </div>
                    </div>

                    <div className="pos-product-grid">
                        {filteredProducts.map(p => {
                            const isOutOfStock = (p.stock || 0) <= 0;
                            return (
                                <div
                                    key={p.id}
                                    className={`pos-product-card ${isOutOfStock ? 'disabled' : ''}`}
                                    onClick={() => !isOutOfStock && addToCart(p)}
                                >
                                    {/* Badge "HABIS" di sudut — tidak menutupi nama */}
                                    {isOutOfStock && (
                                        <div style={{
                                            position: 'absolute', top: 8, right: 8, zIndex: 3,
                                            background: 'var(--error)', color: 'white',
                                            fontSize: 9, fontWeight: 800,
                                            padding: '2px 7px', borderRadius: 20,
                                            letterSpacing: 0.5, boxShadow: '0 2px 6px rgba(239,68,68,0.4)'
                                        }}>HABIS</div>
                                    )}

                                    <div className="img-wrapper">
                                        {p.image ? <img src={p.image} alt={p.name} /> : <span style={{ fontSize: 26 }}>📦</span>}
                                    </div>

                                    <div className="info">
                                        <div className="name" style={{ color: isOutOfStock ? 'var(--text-muted)' : 'var(--text-main)' }}>{p.name}</div>
                                        <div className="price" style={{ color: isOutOfStock ? 'var(--text-muted)' : 'var(--primary)' }}>Rp {p.price.toLocaleString('id-ID')}</div>
                                        <div className="stock-badge">Stok: {p.stock}</div>
                                    </div>

                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Kanan: Keranjang (Tablet/Desktop saja) */}
                <div className="pos-sidebar desktop-only">
                    {cartContent}
                </div>
            </div>

            {/* Mobile: Cart Bar */}
            {cart.length > 0 && !showCartSheet && (
                <div className="cart-compact-bar mobile-only" onClick={() => setShowCartSheet(true)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShoppingCart size={20} />
                        <span style={{ fontWeight: 'bold' }}>{totalItems} Item</span>
                    </div>
                    <div style={{ fontWeight: 'bold' }}>Rp {total.toLocaleString('id-ID')}</div>
                </div>
            )}

            {/* Mobile: Cart Sheet */}
            {showCartSheet && (
                <>
                    <div className="cart-sheet-overlay mobile-only" onClick={() => setShowCartSheet(false)} />
                    <div className="cart-sheet mobile-only">{cartContent}</div>
                </>
            )}

            <style>{`
                @media (max-width: 767px) and (orientation: portrait) { 
                    .desktop-only { display: none !important; } 
                }
                @media (min-width: 768px), (orientation: landscape) { 
                    .mobile-only { display: none !important; } 
                }
            `}</style>

            {/* Preview Struk Modal */}
            {showPreview && (
                <ReceiptPreviewModal
                    cart={cart}
                    total={total}
                    change={change}
                    paymentMethod={paymentMethod}
                    cashReceived={cashReceived}
                    discount={parsedDiscount}
                    tax={taxAmount}
                    onClose={() => setShowPreview(false)}
                    onConfirm={(proof) => { setShowPreview(false); handlePayAndPrint(proof); }}
                />
            )}
        </div>
    );
};

export default PosPage;
