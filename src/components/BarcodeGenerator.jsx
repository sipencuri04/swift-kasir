import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { X, Printer, Download } from 'lucide-react';

const BarcodeGenerator = ({ product, onClose }) => {
    const barcodeRef = useRef(null);
    const [copies, setCopies] = useState(1);
    const [showOldPrice, setShowOldPrice] = useState(true);
    const barcodeValue = product.barcode || product.id?.toString() || '0000000';

    useEffect(() => {
        if (barcodeRef.current) {
            try {
                JsBarcode(barcodeRef.current, barcodeValue, {
                    format: 'CODE128',
                    width: 2,
                    height: 50,
                    displayValue: true,
                    fontSize: 12,
                    margin: 8,
                    background: '#ffffff',
                    lineColor: '#000000',
                });
            } catch (e) {
                console.warn('Barcode error:', e);
            }
        }
    }, [barcodeValue]);

    const handlePrint = () => {
        const labels = Array.from({ length: copies }).map(() => `
            <div style="display:inline-block; border: 1px dashed #ccc; padding: 8px 12px; margin: 4px; text-align: center; font-family: monospace; page-break-inside: avoid;">
                <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${product.name}</div>
                <img src="${barcodeRef.current?.toDataURL()}" style="display: block; max-width: 150px;" />
                ${product.oldPrice && showOldPrice ? `
                <div style="font-size: 10px; text-decoration: line-through; color: #ef4444; margin-top: 2px;">Rp ${product.oldPrice.toLocaleString('id-ID')}</div>
                ` : ''}
                <div style="font-size: 13px; font-weight: 900; margin-top: 2px; color: #1d4ed8;">Rp ${(product.price || 0).toLocaleString('id-ID')}</div>
            </div>
        `).join('');

        const win = window.open('', '_blank');
        win.document.write(`
            <html><head><title>Label Barcode - ${product.name}</title>
            <style>
                body { margin: 10px; }
                @media print { body { margin: 0; } }
            </style>
            </head>
            <body onload="window.print(); window.close();">
                <div style="display: flex; flex-wrap: wrap;">${labels}</div>
            </body></html>
        `);
        win.document.close();
    };

    const handleDownload = () => {
        if (!barcodeRef.current) return;
        const url = barcodeRef.current.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `barcode_${product.name}_${barcodeValue}.png`;
        a.click();
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16
        }}>
            <div style={{
                background: 'var(--card-bg)',
                borderRadius: 24,
                width: '100%',
                maxWidth: 380,
                boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 20px', borderBottom: '1px solid var(--border-color)'
                }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>🏷️ Cetak Label Harga</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: 20 }}>
                    {/* Product Info */}
                    <div style={{
                        background: 'var(--bg-color)', borderRadius: 12, padding: '10px 14px',
                        marginBottom: 16, fontSize: 13
                    }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{product.name}</div>
                        <div style={{ color: 'var(--primary)', fontWeight: 800, marginTop: 2 }}>
                            Rp {(product.price || 0).toLocaleString('id-ID')}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                            Kode: {barcodeValue}
                        </div>
                    </div>

                    {/* Barcode Preview */}
                    <div style={{
                        background: 'white', borderRadius: 12, padding: 12,
                        display: 'flex', justifyContent: 'center', border: '1px solid var(--border-color)',
                        marginBottom: 16
                    }}>
                        <canvas ref={barcodeRef} style={{ maxWidth: '100%' }} />
                    </div>

                    {/* Copies & Options */}
                    <div style={{ marginBottom: 16 }}>
                        {product.oldPrice && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <input 
                                    type="checkbox" 
                                    id="showOldPrice" 
                                    checked={showOldPrice} 
                                    onChange={e => setShowOldPrice(e.target.checked)} 
                                    style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                                />
                                <label htmlFor="showOldPrice" style={{ fontSize: 13, color: 'var(--text-main)', cursor: 'pointer' }}>
                                    Cetak Harga Lama (Dicoret)
                                </label>
                            </div>
                        )}
                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                            Jumlah Label
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button
                                onClick={() => setCopies(Math.max(1, copies - 1))}
                                style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', cursor: 'pointer', fontWeight: 700, fontSize: 18 }}
                            >−</button>
                            <span style={{ fontWeight: 800, fontSize: 18, minWidth: 30, textAlign: 'center' }}>{copies}</span>
                            <button
                                onClick={() => setCopies(Math.min(100, copies + 1))}
                                style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', cursor: 'pointer', fontWeight: 700, fontSize: 18 }}
                            >+</button>
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>label</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={handleDownload}
                            style={{
                                flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid var(--border-color)',
                                background: 'var(--bg-color)', color: 'var(--text-main)', fontWeight: 700, fontSize: 13,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                            }}
                        >
                            <Download size={15} /> Unduh PNG
                        </button>
                        <button
                            onClick={handlePrint}
                            style={{
                                flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                                background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                                color: 'white', fontWeight: 800, fontSize: 13,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                            }}
                        >
                            <Printer size={15} /> Cetak {copies} Label
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BarcodeGenerator;
