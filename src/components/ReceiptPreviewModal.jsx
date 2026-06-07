import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Check, Trash, Upload, Camera } from 'lucide-react';
import { printerService } from '../services/PrinterService';
import { AlertService } from '../utils/AlertService';
import { QRCodeSVG } from 'qrcode.react';

const ReceiptPreviewModal = ({ cart, total, change, paymentMethod, cashReceived, discount = 0, tax = 0, onConfirm, onClose, isHistory = false, paymentProof = null, transactionId = null }) => {
    const storeName = localStorage.getItem('store_name') || 'SWIFT KASIR';
    const storeAddress = localStorage.getItem('store_address') || '';
    const storeLogo = localStorage.getItem('store_logo');
    
    // QRIS Settings
    const qrisImage = localStorage.getItem('qris_image');
    const qrisMerchantName = localStorage.getItem('qris_merchant_name');
    const qrisNotes = localStorage.getItem('qris_notes');
    const hasLeftPanel = paymentMethod === 'qris';

    const [localProof, setLocalProof] = useState(paymentProof);
    const [uploading, setUploading] = useState(false);
    const [fallbackId] = useState(() => Date.now());
    
    const displayId = transactionId || fallbackId;

    const now = new Date();
    const dateStr = now.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

    const handlePrint = async () => {
        try {
            const finalCart = [...cart];
            const dateStrFull = now.toLocaleString('id-ID');
            await printerService.printReceipt(storeName, finalCart, total, dateStrFull, storeAddress, transactionId);
        } catch (e) {
            AlertService.info('Printer', 'Gagal mencetak struk. Pastikan printer terhubung.');
        }
    };

    const handleProofUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400; // Keep file size small for database
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setLocalProof(compressedDataUrl);
                setUploading(false);
            };
            img.onerror = () => {
                AlertService.error('Error', 'Gagal memproses gambar.');
                setUploading(false);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const payLabel = paymentMethod === 'qris' ? '📱 QRIS' : '💵 Tunai';

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
                maxWidth: hasLeftPanel ? 780 : 400,
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
                overflow: 'hidden',
                transition: 'max-width 0.3s ease'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '18px 20px', borderBottom: '1px solid var(--border-color)', flexShrink: 0
                }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>🧾 Preview Struk</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Receipt Body */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 20,
                    display: 'flex',
                    flexDirection: hasLeftPanel ? 'row' : 'column',
                    gap: 20,
                    flexWrap: 'wrap',
                    justifyContent: hasLeftPanel ? 'center' : 'flex-start',
                    alignItems: hasLeftPanel ? 'flex-start' : 'center',
                    alignContent: 'flex-start'
                }}>
                    {paymentMethod === 'qris' && !qrisImage && !isHistory && (
                        <div style={{
                            width: '100%',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--error)',
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            fontSize: 12,
                            marginBottom: 16,
                            textAlign: 'center',
                            boxSizing: 'border-box'
                        }}>
                            ⚠️ <b>QRIS Belum Dikonfigurasi!</b><br/>
                            Silakan upload barcode QRIS Anda di halaman Pengaturan &rarr; Pengaturan QRIS untuk menampilkan kode QR di sini.
                        </div>
                    )}

                    {hasLeftPanel && (
                        <div style={{
                            flex: '1 1 300px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(255, 255, 255, 0.03)',
                            padding: '20px 16px',
                            borderRadius: 16,
                            border: '1px dashed var(--border-color)',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                            minHeight: 350
                        }}>
                            {isHistory ? (
                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: 'var(--text-main)' }}>
                                        🧾 Bukti Pembayaran QRIS
                                    </div>
                                    {paymentProof ? (
                                        <div style={{
                                            background: 'white',
                                            padding: 10,
                                            borderRadius: 12,
                                            display: 'inline-block',
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                            marginBottom: 12,
                                            maxWidth: '100%'
                                        }}>
                                            <img 
                                                src={paymentProof} 
                                                alt="Bukti Transfer QRIS" 
                                                style={{ maxWidth: '100%', maxHeight: 260, display: 'block', borderRadius: 8, cursor: 'pointer', objectFit: 'contain' }} 
                                                onClick={async () => {
                                                    await AlertService.info('', '', `<img src="${paymentProof}" style="max-width:100%;max-height:80vh;border-radius:12px;"/>`);
                                                }}
                                            />
                                            <div style={{ fontSize: 10, color: '#666', marginTop: 6, fontWeight: 600 }}>
                                                🔍 Klik gambar untuk memperbesar
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{
                                            padding: '32px 16px',
                                            background: 'rgba(239, 68, 68, 0.05)',
                                            color: 'var(--error)',
                                            borderRadius: 12,
                                            border: '1px solid rgba(239, 68, 68, 0.1)',
                                            fontSize: 13,
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        }}>
                                            ⚠️ Bukti pembayaran tidak diunggah untuk transaksi ini.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: 'var(--text-main)' }}>📱 Scan QRIS</div>
                                    {qrisMerchantName && (
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
                                            {qrisMerchantName}
                                        </div>
                                    )}
                                    {qrisImage ? (
                                        <div style={{
                                            background: 'white',
                                            padding: 8,
                                            borderRadius: 12,
                                            display: 'inline-block',
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                                            marginBottom: 10
                                        }}>
                                            <img src={qrisImage} alt="QRIS Barcode" style={{ width: 140, height: 140, display: 'block', objectFit: 'contain' }} />
                                        </div>
                                    ) : (
                                        <div style={{
                                            padding: 16,
                                            background: 'rgba(239, 68, 68, 0.05)',
                                            color: 'var(--error)',
                                            borderRadius: 12,
                                            border: '1px solid rgba(239, 68, 68, 0.1)',
                                            fontSize: 12,
                                            marginBottom: 10,
                                            width: '90%',
                                            boxSizing: 'border-box'
                                        }}>
                                            ⚠️ QRIS Toko belum diset di Pengaturan.
                                        </div>
                                    )}
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                                        TOTAL NOMINAL
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--primary)', marginBottom: 12 }}>
                                        Rp {total.toLocaleString('id-ID')}
                                    </div>

                                    {/* Upload Bukti Pembayaran */}
                                    <div style={{
                                        width: '100%',
                                        borderTop: '1px dashed var(--border-color)',
                                        paddingTop: 12,
                                        marginTop: 4,
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-main)' }}>
                                            Upload Bukti Pembayaran <span style={{ color: 'var(--error)' }}>* wajib</span>
                                        </div>
                                        
                                        {localProof ? (
                                            <div style={{ position: 'relative', display: 'inline-block', background: 'white', padding: 6, borderRadius: 8, border: '1px dashed #ccc' }}>
                                                <img src={localProof} alt="Bukti Transfer" style={{ width: 110, height: 110, objectFit: 'contain', display: 'block' }} />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setLocalProof(null)} 
                                                    style={{
                                                        position: 'absolute', top: -8, right: -8, background: 'var(--error)', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                >
                                                    <Trash size={12}/>
                                                </button>
                                            </div>
                                        ) : (
                                            <label style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                border: '2px dashed var(--border-color)',
                                                borderRadius: 12,
                                                padding: '12px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                margin: '0 auto',
                                                maxWidth: 160
                                            }}>
                                                {uploading ? (
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Memproses...</div>
                                                ) : (
                                                    <>
                                                        <Camera size={18} style={{ color: 'var(--primary)', marginBottom: 4 }} />
                                                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-main)' }}>Pilih Foto Bukti</span>
                                                        <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>JPG, PNG</span>
                                                    </>
                                                )}
                                                <input type="file" accept="image/*" capture="environment" onChange={handleProofUpload} hidden disabled={uploading} />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Receipt Paper */}
                    <div style={{
                        flex: hasLeftPanel ? '1 1 300px' : undefined,
                        background: 'white',
                        color: '#111',
                        borderRadius: 12,
                        padding: '20px 16px',
                        fontFamily: 'monospace',
                        fontSize: 12,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                        boxSizing: 'border-box',
                        width: '100%',
                        maxWidth: hasLeftPanel ? 'none' : '100%'
                    }}>
                        {/* Toko */}
                        <div style={{ textAlign: 'center', marginBottom: 12 }}>
                            {storeLogo && (
                                <img src={storeLogo} alt="Logo" style={{ maxWidth: 150, maxHeight: 150, marginBottom: 8, display: 'inline-block' }} />
                            )}
                            <div style={{ fontWeight: 900, fontSize: 15 }}>{storeName.toUpperCase()}</div>
                            {storeAddress && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{storeAddress}</div>}
                            <div style={{ fontSize: 11, color: '#777', marginTop: 4 }}>{dateStr}</div>
                        </div>

                        <div style={{ borderTop: '1px dashed #ccc', margin: '16px 0' }} />

                        {/* Items */}
                        <div style={{ marginBottom: 16 }}>
                            {cart.map((item, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                                        <div style={{ color: '#777', fontSize: 11 }}>{item.qty} × Rp {item.price.toLocaleString('id-ID')}</div>
                                    </div>
                                    <div style={{ fontWeight: 700, marginLeft: 8 }}>
                                        Rp {(item.qty * item.price).toLocaleString('id-ID')}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ borderTop: '1px dashed #ccc', margin: '16px 0' }} />

                        {/* Totals */}
                        <div style={{ fontSize: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span>Subtotal</span>
                                <span>Rp {cart.reduce((a, i) => a + i.price * i.qty, 0).toLocaleString('id-ID')}</span>
                            </div>
                            {(discount > 0) && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, color: 'green' }}>
                                    <span>Diskon</span>
                                    <span>- Rp {discount.toLocaleString('id-ID')}</span>
                                </div>
                            )}
                            {(tax > 0) && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>Pajak</span>
                                    <span>Rp {tax.toLocaleString('id-ID')}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 15, marginTop: 6, paddingTop: 6, borderTop: '1px solid #ccc' }}>
                                <span>TOTAL</span>
                                <span>Rp {total.toLocaleString('id-ID')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, color: '#555' }}>
                                <span>{payLabel}</span>
                                <span>Rp {parseFloat(cashReceived || total).toLocaleString('id-ID')}</span>
                            </div>
                            {paymentMethod !== 'qris' && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontWeight: 700, color: '#1d4ed8' }}>
                                    <span>Kembalian</span>
                                    <span>Rp {change.toLocaleString('id-ID')}</span>
                                </div>
                            )}
                        </div>

                        <div style={{ borderTop: '1px dashed #ccc', margin: '12px 0' }} />
                        
                        {displayId && (
                            <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                <div style={{ display: 'inline-block', background: 'white', padding: '8px', borderRadius: '8px' }}>
                                    <QRCodeSVG value={String(displayId)} size={120} />
                                </div>
                                <div style={{ fontSize: 11, marginTop: 4, fontWeight: 'bold' }}>ID: {displayId}</div>
                            </div>
                        )}

                        <div style={{ textAlign: 'center', color: '#777', fontSize: 11, lineHeight: '1.8' }}>
                            Terima Kasih atas Kunjungan Anda!<br />
                            Selamat datang kembali di toko kami.<br />
                            Kepuasan Anda adalah prioritas utama.<br />
                            Barang yang sudah dibeli tidak dapat<br />
                            ditukar atau dikembalikan.<br />
                            Simpan struk ini sebagai bukti<br />
                            pembayaran yang sah.<br /><br />
                            Powered by Swift Kasir
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 10, flexShrink: 0 }}>
                    <button
                        onClick={handlePrint}
                        style={{
                            flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid var(--border-color)',
                            background: 'var(--bg-color)', color: 'var(--text-main)', fontWeight: 700, fontSize: 14,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                        }}
                    >
                        <Printer size={16} /> Cetak Struk
                    </button>
                    {!isHistory && (
                        <button
                            onClick={() => {
                                if (paymentMethod === 'qris' && !localProof) {
                                    AlertService.error('Bukti Pembayaran Wajib', 'Silakan unggah foto bukti transfer QRIS terlebih dahulu.');
                                    return;
                                }
                                onConfirm(localProof);
                            }}
                            disabled={paymentMethod === 'qris' && !localProof}
                            style={{
                                flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                                background: (paymentMethod === 'qris' && !localProof)
                                    ? 'var(--border-color)' 
                                    : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                                color: (paymentMethod === 'qris' && !localProof) ? 'var(--text-muted)' : 'white', 
                                fontWeight: 800, fontSize: 14,
                                cursor: (paymentMethod === 'qris' && !localProof) ? 'not-allowed' : 'pointer', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                            }}
                        >
                            <Check size={16} /> Konfirmasi Bayar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReceiptPreviewModal;
