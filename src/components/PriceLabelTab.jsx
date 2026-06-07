import React, { useState, useEffect } from 'react';
import { dbService } from '../services/DatabaseService';
import { Tag, Barcode, Printer, Search, X } from 'lucide-react';
import BarcodeGenerator from './BarcodeGenerator';
import JsBarcode from 'jsbarcode';

const PriceLabelTab = () => {
    const [products, setProducts] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [barcodeProduct, setBarcodeProduct] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const all = await dbService.getProducts();
        setAllProducts(all);
        // Filter products that have priceUpdatedAt and sort by newest first
        const updatedProducts = all
            .filter(p => p.priceUpdatedAt)
            .sort((a, b) => new Date(b.priceUpdatedAt) - new Date(a.priceUpdatedAt));
        setProducts(updatedProducts);
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    };

    const handlePrintAll = (includeOldPrice, itemsToPrint = filteredProducts) => {
        if (itemsToPrint.length === 0) return;
        const labelsHTML = itemsToPrint.map(p => {
            const barcodeValue = p.barcode || p.id?.toString() || '0000000';
            const canvas = document.createElement('canvas');
            try {
                JsBarcode(canvas, barcodeValue, {
                    format: 'CODE128', width: 2, height: 50, displayValue: true,
                    fontSize: 12, margin: 8, background: '#ffffff', lineColor: '#000000'
                });
            } catch (e) {
                console.warn('Barcode error', e);
            }
            const barcodeDataUrl = canvas.toDataURL('image/png');
            
            return `
                <div style="display:inline-block; border: 1px dashed #ccc; padding: 8px 12px; margin: 4px; text-align: center; font-family: monospace; page-break-inside: avoid; width: 160px; box-sizing: border-box;">
                    <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</div>
                    <img src="${barcodeDataUrl}" style="display: block; max-width: 100%; margin: 0 auto;" />
                    ${p.oldPrice && includeOldPrice ? `
                    <div style="font-size: 10px; text-decoration: line-through; color: #ef4444; margin-top: 2px;">Rp ${parseFloat(p.oldPrice).toLocaleString('id-ID')}</div>
                    ` : ''}
                    <div style="font-size: 13px; font-weight: 900; margin-top: 2px; color: #1d4ed8;">Rp ${(p.price || 0).toLocaleString('id-ID')}</div>
                </div>
            `;
        }).join('');

        const win = window.open('', '_blank');
        win.document.write(`
            <html><head><title>Cetak Semua Label</title>
            <style>
                body { margin: 10px; font-family: sans-serif; }
                @media print { body { margin: 0; } }
            </style>
            </head>
            <body onload="setTimeout(() => { window.print(); window.close(); }, 500);">
                <div style="display: flex; flex-wrap: wrap; justify-content: flex-start;">${labelsHTML}</div>
            </body></html>
        `);
        win.document.close();
    };

    return (
        <div style={{ animation: 'slideInRight 0.3s ease-out' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20, background: 'var(--card-bg)', padding: '16px', borderRadius: 16, boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' }}>
                {/* Header Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Tag size={20} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Daftar Harga Berubah</h2>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Cetak label untuk barang yang harganya baru di-update</p>
                    </div>
                </div>

                {/* Actions (Buttons & Search) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, flex: '1 1 auto' }}>
                        {filteredProducts.length > 0 && (
                            <>
                                <button 
                                    className="btn"
                                    onClick={() => handlePrintAll(true)}
                                    style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, flex: '1 1 auto', justifyContent: 'center', whiteSpace: 'nowrap' }}
                                >
                                    <Printer size={16} /> Semua (Harga Lama)
                                </button>
                                <button 
                                    className="btn btn-primary"
                                    onClick={() => handlePrintAll(false)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, flex: '1 1 auto', justifyContent: 'center', whiteSpace: 'nowrap' }}
                                >
                                    <Printer size={16} /> Semua (Harga Baru)
                                </button>
                            </>
                        )}
                        {allProducts.length > 0 && (
                            <button 
                                className="btn"
                                onClick={() => handlePrintAll(false, allProducts)}
                                style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, flex: '1 1 auto', justifyContent: 'center', whiteSpace: 'nowrap' }}
                            >
                                <Printer size={16} /> Cetak Seluruh Produk Toko
                            </button>
                        )}
                    </div>
                    <div className="modern-input-group" style={{ flex: '1 1 100%', minWidth: '250px' }}>
                        <Search size={18} style={{ color: 'var(--text-muted)', marginLeft: 12 }} />
                        <input
                            placeholder="Cari nama barang..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ fontSize: 13, padding: '10px 12px', border: 'none', background: 'transparent', width: '100%', color: 'var(--text-main)' }}
                        />
                        {searchTerm && (
                            <X size={16} onClick={() => setSearchTerm('')}
                                style={{ cursor: 'pointer', color: 'var(--text-muted)', marginRight: 12 }} />
                        )}
                    </div>
                </div>
            </div>

            {filteredProducts.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🏷️</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>Belum ada perubahan harga</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Ubah harga di menu Daftar Produk untuk memunculkannya di sini.</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {filteredProducts.map(p => (
                        <div key={p.id} className="card" style={{ padding: 16, display: 'flex', gap: 16, border: '1px solid var(--border-color)', borderRadius: 16 }}>
                            <div style={{ width: 60, height: 60, borderRadius: 12, background: 'var(--bg-color)', overflow: 'hidden', flexShrink: 0 }}>
                                {p.image ? (
                                    <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, opacity: 0.5 }}>📦</div>
                                )}
                            </div>
                            
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                                    Diupdate: {formatDate(p.priceUpdatedAt)}
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-color)', padding: '8px 12px', borderRadius: 8 }}>
                                    <div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>HARGA LAMA</div>
                                        <div style={{ fontSize: 13, textDecoration: 'line-through', color: 'var(--error)' }}>
                                            Rp {(p.oldPrice || 0).toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 18, color: 'var(--text-muted)' }}>➔</div>
                                    <div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>HARGA BARU</div>
                                        <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--success)' }}>
                                            Rp {(p.price || 0).toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                                <button 
                                    className="btn-icon" 
                                    onClick={() => setBarcodeProduct(p)} 
                                    title="Cetak Label Harga" 
                                    style={{ width: 44, height: 44, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: 12 }}
                                >
                                    <Printer size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {barcodeProduct && (
                <BarcodeGenerator product={barcodeProduct} onClose={() => setBarcodeProduct(null)} />
            )}
        </div>
    );
};

export default PriceLabelTab;
