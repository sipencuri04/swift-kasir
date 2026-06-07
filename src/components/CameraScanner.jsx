import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';

const CameraScanner = ({ onScan }) => {
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        if (isScanning) {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                /* verbose= */ false
            );

            scanner.render(
                (decodedText) => {
                    // Berhasil scan
                    scanner.clear();
                    setIsScanning(false);
                    onScan(decodedText);
                },
                (errorMessage) => {
                    // Ignore error saat kamera sedang membaca
                }
            );

            return () => {
                scanner.clear().catch(error => {
                    console.error("Failed to clear html5QrcodeScanner. ", error);
                });
            };
        }
    }, [isScanning, onScan]);

    return (
        <div style={{ marginBottom: 16 }}>
            {!isScanning ? (
                <button
                    className="btn"
                    style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white',
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                    onClick={() => setIsScanning(true)}
                >
                    <Camera size={20} />
                    Scan Barcode Kamera
                </button>
            ) : (
                <div className="card" style={{ padding: 12 }}>
                    <div className="flex justify-between items-center mb-2">
                        <h4 style={{ margin: 0 }}>Membaca Barcode...</h4>
                        <button className="btn-icon" onClick={() => setIsScanning(false)} style={{ border: 'none', background: 'transparent', color: 'var(--error)' }}>
                            <X size={20} />
                        </button>
                    </div>
                    <div id="reader" style={{ width: '100%', overflow: 'hidden', borderRadius: 8 }}></div>
                </div>
            )}
        </div>
    );
};

export default CameraScanner;
