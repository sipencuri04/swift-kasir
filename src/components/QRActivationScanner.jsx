import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, QrCode, Camera } from 'lucide-react';

/**
 * QRActivationScanner
 * Komponen scanner QR khusus untuk proses aktivasi Swift Kasir.
 * Terpisah dari CameraScanner.jsx (yang dipakai untuk barcode produk).
 *
 * Props:
 *   onScan(decodedText)  — dipanggil saat QR berhasil dibaca
 *   onClose()            — dipanggil saat user menutup scanner
 */
const QRActivationScanner = ({ onScan, onClose, onManual }) => {
    const scannerRef = useRef(null);
    const [error, setError] = useState('');
    const [scanning, setScanning] = useState(false);

    useEffect(() => {
        const scannerId = 'qr-activation-reader';
        let html5QrCode = null;

        const startScanner = async () => {
            try {
                html5QrCode = new Html5Qrcode(scannerId);
                scannerRef.current = html5QrCode;

                await html5QrCode.start(
                    { facingMode: 'environment' }, // Kamera belakang
                    {
                        fps: 10,
                        qrbox: { width: 240, height: 240 },
                        aspectRatio: 1.0,
                    },
                    (decodedText) => {
                        // Berhasil scan — hentikan kamera lalu panggil callback
                        html5QrCode.stop().then(() => {
                            onScan(decodedText);
                        }).catch(() => {
                            onScan(decodedText);
                        });
                    },
                    () => {
                        // Ignore frame error saat kamera membaca
                    }
                );
                setScanning(true);
            } catch (err) {
                console.error('QR Scanner error:', err);
                setError('Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.');
            }
        };

        startScanner();

        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
                scannerRef.current = null;
            }
        };
    }, [onScan]);

    const handleClose = () => {
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => {});
            scannerRef.current = null;
        }
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
        }}>
            {/* Header */}
            <div style={{
                width: '100%',
                maxWidth: 360,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <QrCode size={22} color="white" />
                    <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
                        Scan QR Aktivasi
                    </span>
                </div>
                <button
                    onClick={handleClose}
                    style={{
                        background: 'rgba(255,255,255,0.15)',
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 10px',
                        cursor: 'pointer',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 13,
                    }}
                >
                    <X size={16} /> Batal
                </button>
            </div>

            {/* Viewport scanner */}
            <div style={{
                width: '100%',
                maxWidth: 360,
                borderRadius: 20,
                overflow: 'hidden',
                position: 'relative',
                background: '#000',
                boxShadow: '0 0 0 4px rgba(56,189,248,0.4)',
            }}>
                {/* Container untuk html5-qrcode */}
                <div id="qr-activation-reader" style={{ width: '100%' }} />

                {/* Corner guides */}
                {scanning && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                    }}>
                        {/* Scan line animation */}
                        <div style={{
                            position: 'absolute',
                            left: '10%',
                            right: '10%',
                            height: 2,
                            background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)',
                            animation: 'scanLine 2s linear infinite',
                            borderRadius: 2,
                            top: '10%',
                        }} />
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    marginTop: 16,
                    padding: '12px 16px',
                    background: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(239,68,68,0.4)',
                    borderRadius: 12,
                    color: '#fca5a5',
                    fontSize: 13,
                    maxWidth: 360,
                    textAlign: 'center',
                }}>
                    {error}
                </div>
            )}

            {/* Instruksi */}
            <p style={{
                marginTop: 20,
                color: 'rgba(255,255,255,0.7)',
                fontSize: 13,
                textAlign: 'center',
                maxWidth: 280,
                lineHeight: 1.6,
            }}>
                Arahkan kamera ke <strong style={{ color: 'white' }}>QR Code</strong> pada halaman KeyGen Swift Kasir
            </p>

            {/* Tombol fallback manual */}
            {onManual && (
                <button
                    onClick={onManual}
                    style={{
                        marginTop: 16,
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 10,
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: 13,
                        padding: '10px 20px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontFamily: 'inherit',
                    }}
                >
                    ⌨️ Masukkan kode secara manual
                </button>
            )}

            {/* Animasi scan line via inline style tag */}
            <style>{`
                @keyframes scanLine {
                    0%   { top: 10%; opacity: 1; }
                    90%  { top: 88%; opacity: 1; }
                    100% { top: 10%; opacity: 0; }
                }
                /* Override html5-qrcode default UI */
                #qr-activation-reader video { border-radius: 12px; }
                #qr-activation-reader__scan_region { border-radius: 12px; }
                #qr-activation-reader__dashboard { display: none !important; }
            `}</style>
        </div>
    );
};

export default QRActivationScanner;
