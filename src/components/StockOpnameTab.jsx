import React, { useState, useEffect } from 'react';
import { dbService } from '../services/DatabaseService';
import { AlertService } from '../utils/AlertService';
import { Search, Save, Package, ArrowRight, Info, AlertCircle } from 'lucide-react';
import CameraScanner from './CameraScanner';

const StockOpnameTab = ({ onComplete }) => {
    const [search, setSearch] = useState('');
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [actualStock, setActualStock] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        const data = await dbService.getProducts();
        setProducts(data);
    };

    const handleSearch = (text) => {
        setSearch(text);
        const product = products.find(p => 
            (p.barcode && p.barcode.toLowerCase() === text.toLowerCase()) ||
            p.name.toLowerCase().includes(text.toLowerCase())
        );
        if (product && (p => p.barcode && p.barcode.toLowerCase() === text.toLowerCase())) {
             // If exact barcode match, select it
             const exact = products.find(p => p.barcode && p.barcode.toLowerCase() === text.toLowerCase());
             if (exact) setSelectedProduct(exact);
        }
    };

    const filteredSearch = products.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
    );

    const handleSave = async (e) => {
        e.preventDefault();
        if (!selectedProduct) return;
        if (actualStock === '') {
            AlertService.error('Input Kosong', 'Masukkan jumlah stok fisik yang dihitung.');
            return;
        }

        const stockValue = parseInt(actualStock);
        if (isNaN(stockValue)) return;

        setLoading(true);
        try {
            await dbService.createStockOpname({
                productId: selectedProduct.id,
                productName: selectedProduct.name,
                systemStock: selectedProduct.stock,
                actualStock: stockValue,
                userId: 1, // Default owner for now
                notes: notes
            });

            await AlertService.success('Stock Opname Berhasil', `Stok ${selectedProduct.name} telah diperbarui menjadi ${stockValue}.`);
            
            // Reset
            setSearch('');
            setSelectedProduct(null);
            setActualStock('');
            setNotes('');
            if (onComplete) onComplete();
        } catch (err) {
            AlertService.error('Gagal', err.message);
        } finally {
            setLoading(false);
        }
    };

    const diff = selectedProduct ? (parseInt(actualStock || 0) - selectedProduct.stock) : 0;

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="card" style={{ padding: '24px', marginBottom: 24 }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 18 }}>📝 Form Stock Opname</h3>
                <p className="text-muted" style={{ fontSize: 13, marginBottom: 24 }}>Gunakan fitur ini untuk menyesuaikan stok sistem dengan stok fisik asli di toko.</p>

                <div className="grid-2" style={{ gap: 24 }}>
                    {/* Sisi Kiri: Pilih Produk */}
                    <div>
                        <div className="input-group">
                            <label>Cari Produk (Nama / Scan Barcode)</label>
                            <div style={{ position: 'relative' }}>
                                <div className="modern-input-group" style={{ background: 'var(--bg-color)' }}>
                                    <Search size={18} color="var(--text-muted)" style={{ marginLeft: 12 }} />
                                    <input 
                                        placeholder="Ketik nama atau scan..." 
                                        value={search} 
                                        onChange={e => handleSearch(e.target.value)}
                                        style={{ background: 'transparent', border: 'none', padding: '12px' }}
                                    />
                                    <CameraScanner onScan={(text) => handleSearch(text)} />
                                </div>
                                
                                {search && !selectedProduct && (
                                    <div style={{ 
                                        position: 'absolute', top: '100%', left: 0, right: 0, 
                                        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                                        borderRadius: 12, boxShadow: 'var(--shadow)', zIndex: 10,
                                        maxHeight: 200, overflowY: 'auto', marginTop: 4
                                    }}>
                                        {filteredSearch.map(p => (
                                            <div 
                                                key={p.id} 
                                                onClick={() => { setSelectedProduct(p); setSearch(p.name); }}
                                                style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}
                                            >
                                                <span>{p.name}</span>
                                                <span className="text-muted" style={{ fontSize: 11 }}>Stok: {p.stock}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedProduct && (
                            <div className="alert" style={{ background: 'var(--primary-bg)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 12, padding: 16, marginTop: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <Package size={24} />
                                    <div>
                                        <div style={{ fontWeight: 800 }}>{selectedProduct.name}</div>
                                        <div style={{ fontSize: 12, opacity: 0.8 }}>Stok Sistem Saat Ini: <b>{selectedProduct.stock}</b></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sisi Kanan: Input Realitas */}
                    <div>
                        {selectedProduct ? (
                            <form onSubmit={handleSave}>
                                <div className="input-group">
                                    <label>Jumlah Stok Fisik (Aktual)</label>
                                    <input 
                                        type="number" 
                                        className="modern-input" 
                                        required 
                                        value={actualStock} 
                                        onChange={e => setActualStock(e.target.value)} 
                                        placeholder="Berapa jumlah barang di rak?"
                                        style={{ fontSize: 18, fontWeight: 800, padding: 16 }}
                                    />
                                </div>

                                <div style={{ 
                                    background: diff === 0 ? 'rgba(34, 197, 94, 0.05)' : (diff > 0 ? 'rgba(59, 130, 246, 0.05)' : 'rgba(239, 68, 68, 0.05)'),
                                    padding: 16, borderRadius: 12, marginBottom: 20,
                                    border: `1px dashed ${diff === 0 ? '#22c55e' : (diff > 0 ? '#3b82f6' : '#ef4444')}`
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>Selisih Stok:</span>
                                        <span style={{ 
                                            fontSize: 20, fontWeight: 900, 
                                            color: diff === 0 ? '#22c55e' : (diff > 0 ? '#3b82f6' : '#ef4444')
                                        }}>
                                            {diff > 0 ? '+' : ''}{diff}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: 11, margin: '8px 0 0', opacity: 0.7 }}>
                                        {diff === 0 ? "Stok sesuai dengan sistem." : (diff > 0 ? "Ada kelebihan stok fisik." : "Ada kekurangan stok fisik (barang hilang/rusak).")}
                                    </p>
                                </div>

                                <div className="input-group">
                                    <label>Catatan (Opsional)</label>
                                    <input 
                                        className="modern-input" 
                                        value={notes} 
                                        onChange={e => setNotes(e.target.value)} 
                                        placeholder="Contoh: Barang rusak atau salah input sebelumnya" 
                                    />
                                </div>

                                <button 
                                    type="submit" 
                                    className="btn btn-primary" 
                                    disabled={loading}
                                    style={{ width: '100%', height: 50, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                                >
                                    <Save size={20} />
                                    {loading ? 'Memproses...' : 'Simpan & Update Stok'}
                                </button>
                            </form>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '2px dashed var(--border-color)', borderRadius: 16, padding: 20, textAlign: 'center' }}>
                                <Info size={40} style={{ opacity: 0.2, marginBottom: 16 }} />
                                <div>Pilih produk di sisi kiri untuk memulai Stock Opname</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="card" style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid #f59e0b', padding: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: '#b45309' }}>
                    <AlertCircle size={20} />
                    <div style={{ fontSize: 13 }}>
                        <b>Perhatian:</b> Tindakan ini akan langsung mengubah jumlah stok barang di sistem agar sesuai dengan angka yang Anda masukkan. Pastikan hitungan sudah benar.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockOpnameTab;
