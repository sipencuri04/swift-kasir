import React, { useEffect, useState } from 'react';
import { licenseService } from '../services/LicenseService';
import { Lock, Key, CheckCircle, Copy, MapPin, Store, Navigation } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '../services/supabaseClient';
import { AlertService } from '../utils/AlertService';

const ActivationPage = ({ onSuccess }) => {
    const [deviceId, setDeviceId] = useState('Loading...');
    const [inputKey, setInputKey] = useState('');
    const [storeName, setStoreName] = useState('');
    const [storeAddress, setStoreAddress] = useState('');
    const [coordinates, setCoordinates] = useState(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        licenseService.getDeviceId().then(id => setDeviceId(id));
    }, []);

    const handleDetectGPS = async () => {
        setIsLocating(true);
        setError('');
        try {
            // Cek status izin lokasi
            const permStatus = await Geolocation.checkPermissions();
            console.log('Permission Status:', permStatus);

            if (permStatus.location !== 'granted') {
                const request = await Geolocation.requestPermissions();
                if (request.location !== 'granted') {
                    throw new Error('Izin lokasi ditolak oleh pengguna.');
                }
            }

            // Coba ambil posisi dengan akurasi tinggi
            const position = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 15000 // Tingkatkan ke 15 detik agar lebih stabil
            });

            setCoordinates({
                lat: position.coords.latitude,
                lng: position.coords.longitude
            });
            
            // Berikan feedback jika berhasil
            await AlertService.success('Lokasi Berhasil Dideteksi', `Koordinat: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`);

        } catch (err) {
            console.error('GPS Error Details:', err);
            
            let errorMsg = 'Gagal mendeteksi GPS.';
            
            if (err.message === 'Izin lokasi ditolak oleh pengguna.') {
                errorMsg = 'Izin lokasi ditolak. Silakan berikan izin di pengaturan aplikasi.';
            } else if (err.code === 3 || err.message?.includes('timeout')) {
                errorMsg = 'Waktu habis mendeteksi GPS. Pastikan Anda berada di area terbuka atau GPS aktif.';
            } else {
                errorMsg = 'Gagal mendeteksi lokasi. Pastikan GPS HP aktif dan Anda memberikan izin lokasi.';
            }
            
            setError(errorMsg);
            AlertService.error('Gagal Lokasi', errorMsg);
        } finally {
            setIsLocating(false);
        }
    };

    const handleActivate = async (e) => {
        e.preventDefault();
        setError('');

        if (!storeName || !storeAddress) {
            setError('Nama Toko dan Alamat wajib diisi.');
            return;
        }

        if (!coordinates) {
            setError('Titik lokasi toko wajib ditentukan. Buka peta dan klik/seret pin ke lokasi toko.');
            return;
        }

        setIsLoading(true);

        try {
            // Save to Supabase first
            let supabaseSuccess = true;
            try {
                const { error: supabaseError } = await supabase
                    .from('store_devices')
                    .upsert({
                        device_id: deviceId,
                        store_name: storeName,
                        address: storeAddress,
                        latitude: coordinates.lat,
                        longitude: coordinates.lng,
                        license_key: inputKey.trim().toUpperCase(),
                        activated_at: new Date().toISOString()
                    }, { onConflict: 'device_id' });

                if (supabaseError) {
                    console.error('Supabase Error:', supabaseError);
                    supabaseSuccess = false;
                }
            } catch (supErr) {
                console.error('Supabase Connection Error:', supErr);
                supabaseSuccess = false;
            }

            // Save to local license
            const success = await licenseService.activate(inputKey.trim().toUpperCase());
            if (success) {
                if (!supabaseSuccess) {
                    await AlertService.success('Aktivasi Berhasil', 'Selamat menggunakan Swift Kasir. (Catatan: Gagal menyimpan data ke Cloud, mode offline aktif)');
                } else {
                    await AlertService.success('Aktivasi Berhasil', 'Selamat menggunakan Swift Kasir.');
                }
                window.location.reload();
            } else {
                setError('Kode Aktivasi Salah. Silakan periksa kembali.');
            }
        } catch (err) {
            setError('Terjadi kesalahan yang tidak terduga.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(deviceId);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-color)',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflowY: 'auto'
        }}>
            <div className="card" style={{ maxWidth: 400, width: '100%', textAlign: 'center', padding: 32, margin: '20px 0' }}>
                <div style={{
                    width: 72, height: 72,
                    background: 'rgba(56, 189, 248, 0.1)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px'
                }}>
                    <Lock size={36} className="text-primary" />
                </div>

                <h1 style={{ fontSize: 22, marginBottom: 8 }}>Aktivasi Perangkat</h1>
                <p className="text-muted" style={{ marginBottom: 28, fontSize: 14 }}>
                    Aplikasi ini terkunci untuk perangkat ini. Silakan isi data toko dan masukkan kode lisensi untuk melanjutkan.
                </p>

                <div className="card bg-dark" style={{ marginBottom: 24, textAlign: 'left' }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID Perangkat Anda</label>
                    <div className="flex justify-between items-center">
                        <code style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--accent)', letterSpacing: 1 }}>{deviceId}</code>
                        <button type="button" className="btn-icon" onClick={copyToClipboard} title="Salin ID">
                            {copySuccess ? <CheckCircle size={18} color="var(--success)" /> : <Copy size={18} />}
                        </button>
                    </div>
                </div>

                <form onSubmit={handleActivate}>
                    {/* Nama Toko */}
                    <div className="input-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                        <label>Nama Toko</label>
                        <div style={{ position: 'relative' }}>
                            <Store size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                            <input
                                value={storeName}
                                onChange={e => setStoreName(e.target.value)}
                                placeholder="Contoh: Toko Berkah"
                                style={{ paddingLeft: 40 }}
                                required
                            />
                        </div>
                    </div>

                    {/* Alamat Toko */}
                    <div className="input-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                        <label>Alamat Toko</label>
                        <div style={{ position: 'relative' }}>
                            <MapPin size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                            <input
                                value={storeAddress}
                                onChange={e => setStoreAddress(e.target.value)}
                                placeholder="Jalan Raya No. 1"
                                style={{ paddingLeft: 40 }}
                                required
                            />
                        </div>
                    </div>

                    {/* Lokasi GPS */}
                    <div style={{ textAlign: 'left', marginBottom: '14px' }}>
                        <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                            📍 Titik Lokasi Toko
                        </label>
                        <button
                            type="button"
                            onClick={handleDetectGPS}
                            disabled={isLocating}
                            style={{
                                width: '100%',
                                padding: '11px 16px',
                                background: coordinates ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                border: `1px solid ${coordinates ? 'rgba(16,185,129,0.4)' : 'rgba(59,130,246,0.4)'}`,
                                borderRadius: 8,
                                color: coordinates ? '#10b981' : '#60a5fa',
                                cursor: isLocating ? 'wait' : 'pointer',
                                fontWeight: 600,
                                fontSize: 14,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                transition: 'all 0.2s'
                            }}
                        >
                            <Navigation size={16} />
                            {isLocating
                                ? 'Mendeteksi lokasi...'
                                : coordinates
                                    ? `✅ ${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`
                                    : 'Klik Lokasi Saat Ini'
                            }
                        </button>
                    </div>

                    <div className="input-group" style={{ textAlign: 'left', marginBottom: '24px' }}>
                        <label>Kode Lisensi</label>
                        <div style={{ position: 'relative' }}>
                            <Key size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                            <input
                                value={inputKey}
                                onChange={e => setInputKey(e.target.value.toUpperCase())}
                                placeholder="XXXX-XXXX-XXXX-XXXX"
                                style={{ paddingLeft: 40, fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase' }}
                                required
                            />
                        </div>
                    </div>

                    {error && <div style={{ color: 'var(--error)', marginBottom: 16, fontSize: 14 }}>{error}</div>}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isLoading}>
                        {isLoading ? 'Memproses...' : 'Aktifkan Sekarang'}
                    </button>
                </form>

                <div style={{ marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
                    Belum punya kode? Hubungi Admin:<br />
                    <b style={{ color: 'var(--text-main)' }}>0812-3456-7890 (WhatsApp)</b><br />
                    Sertakan ID Perangkat Anda saat order.
                </div>
            </div>
        </div>
    );
};

export default ActivationPage;
