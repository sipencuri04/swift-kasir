import React, { useEffect, useState, useCallback } from 'react';
import { licenseService } from '../services/LicenseService';
import { dbService } from '../services/DatabaseService';
import { AlertService } from '../utils/AlertService';
import QRActivationScanner from '../components/QRActivationScanner';
import {
    QrCode, Key, CheckCircle, Copy, MapPin, Store,
    Navigation, User, Phone, ArrowRight, ArrowLeft,
    Loader, ShieldCheck, AlertCircle, ChevronRight,
} from 'lucide-react';
import SwiftLogo from '../assets/Swift_Kasir.png';

// ─── Step enum ───────────────────────────────────────────────
const STEP = {
    LANDING: 'landing',       // halaman awal — pilih scan / manual
    SCANNING: 'scanning',     // kamera aktif
    VALIDATING: 'validating', // loading validasi token
    MANUAL: 'manual',         // fallback input manual
    REGISTER: 'register',     // form data akun + toko
    SUCCESS: 'success',       // aktivasi berhasil
};

// ─── Status token warna ──────────────────────────────────────
const STATUS_STYLE = {
    valid:   { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.4)', color: '#10b981' },
    invalid: { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.4)',  color: '#ef4444' },
    loading: { bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.4)', color: '#38bdf8' },
};

// ─── Komponen utama ──────────────────────────────────────────
const ActivationPage = ({ onSuccess }) => {
    const [step, setStep]             = useState(STEP.SCANNING); // Langsung buka kamera
    const [deviceId, setDeviceId]     = useState('');

    // Token state
    const [scannedToken, setScannedToken] = useState('');
    const [manualToken, setManualToken]   = useState('');
    const [tokenStatus, setTokenStatus]   = useState(null); // null | 'valid' | 'invalid'
    const [tokenError, setTokenError]     = useState('');

    // Form registrasi
    const [storeName, setStoreName]       = useState('');
    const [storeAddress, setStoreAddress] = useState('');
    const [coordinates, setCoordinates]   = useState(null);
    const [username, setUsername]         = useState('');
    const [password, setPassword]         = useState('');
    const [phone, setPhone]               = useState('');

    const [isLocating, setIsLocating]   = useState(false);
    const [isLoading, setIsLoading]     = useState(false);
    const [error, setError]             = useState('');
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        licenseService.getDeviceId().then(id => setDeviceId(id));
    }, []);

    // ── Setelah QR ter-scan ──────────────────────────────────
    const handleQRScanned = useCallback(async (rawText) => {
        setStep(STEP.VALIDATING);
        setTokenError('');

        try {
            const result = await licenseService.validateQRToken(rawText);
            if (result.valid) {
                setScannedToken(result.token);
                setTokenStatus('valid');
                setStep(STEP.REGISTER);
            } else {
                setTokenError(result.reason || 'QR tidak valid.');
                setTokenStatus('invalid');
                setStep(STEP.LANDING);
            }
        } catch (e) {
            console.error(e);
            setTokenError('Terjadi kesalahan saat memvalidasi QR.');
            setTokenStatus('invalid');
            setStep(STEP.LANDING);
        }
    }, []);

    // ── Validasi token manual ─────────────────────────────────
    const handleManualValidate = async (e) => {
        e.preventDefault();
        if (!manualToken.trim()) return;
        setStep(STEP.VALIDATING);
        setTokenError('');

        try {
            const result = await licenseService.validateQRToken(manualToken.trim().toUpperCase());
            if (result.valid) {
                setScannedToken(result.token);
                setTokenStatus('valid');
                setStep(STEP.REGISTER);
            } else {
                setTokenError(result.reason || 'Kode tidak valid.');
                setTokenStatus('invalid');
                setStep(STEP.MANUAL);
            }
        } catch (e) {
            setTokenError('Terjadi kesalahan validasi.');
            setStep(STEP.MANUAL);
        }
    };

    // ── Deteksi GPS ───────────────────────────────────────────
    const handleDetectGPS = async () => {
        setIsLocating(true);
        setError('');

        if (!navigator.geolocation) {
            setError('Browser Anda tidak mendukung GPS.');
            setIsLocating(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                setCoordinates({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
                setIsLocating(false);
            },
            (err) => {
                let msg = 'Gagal mendeteksi lokasi.';
                if (err.code === 1) msg = 'Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan browser.';
                else if (err.code === 2) msg = 'Sinyal GPS tidak tersedia. Pastikan GPS aktif.';
                else if (err.code === 3) msg = 'Timeout. Coba lagi di area dengan sinyal lebih baik.';
                setError(msg);
                setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    // ── Submit registrasi ─────────────────────────────────────
    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        if (!storeName.trim())    return setError('Nama toko wajib diisi.');
        if (!storeAddress.trim()) return setError('Alamat toko wajib diisi.');
        if (!username.trim())     return setError('Username wajib diisi.');
        if (!password.trim())     return setError('Password wajib diisi.');
        if (!coordinates)         return setError('Titik lokasi toko wajib ditentukan. Klik "Lokasi Saat Ini".');

        setIsLoading(true);

        try {
            // 1. Buat akun user di database lokal
            const existingUsers = await dbService.getUsers();
            const usernameExists = existingUsers.find(u => u.username === username.trim());
            if (usernameExists) {
                setError('Username sudah dipakai. Pilih username lain.');
                setIsLoading(false);
                return;
            }

            await dbService.createUser({
                username: username.trim(),
                password: password,
                role: 'superuser',
                name: storeName.trim(),
            });

            // 2. Aktivasi lisensi QR + simpan lokal
            await licenseService.activateWithQRToken(scannedToken, {
                storeName: storeName.trim(),
                storeAddress: storeAddress.trim(),
                coordinates,
                username: username.trim(),
                phone: phone.trim(),
            });

            // 3. Simpan info toko ke localStorage (bisa dipakai di Settings)
            localStorage.setItem('kasir_store_info', JSON.stringify({
                storeName: storeName.trim(),
                storeAddress: storeAddress.trim(),
                phone: phone.trim(),
                coordinates,
            }));

            setStep(STEP.SUCCESS);

            setTimeout(async () => {
                await AlertService.success('Aktivasi Berhasil! 🎉', `Selamat datang di Swift Kasir, ${storeName}!`);
                window.location.reload();
            }, 1500);

        } catch (err) {
            console.error(err);
            setError('Terjadi kesalahan saat aktivasi. Coba lagi.');
        } finally {
            setIsLoading(false);
        }
    };

    const copyDeviceId = () => {
        navigator.clipboard.writeText(deviceId);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    // ═══════════════════════════════════════════════════════════
    // Render
    // ═══════════════════════════════════════════════════════════

    const containerStyle = {
        minHeight: '100vh',
        background: 'var(--bg-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
    };

    const cardStyle = {
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
        padding: '36px 28px',
        margin: '20px 0',
    };

    // ── LANDING ──────────────────────────────────────────────
    if (step === STEP.LANDING) {
        return (
            <div style={containerStyle}>
                <div className="card" style={cardStyle}>
                    {/* Logo */}
                    <img src={SwiftLogo} alt="Swift Kasir" style={{ height: 64, marginBottom: 20 }} />

                    {/* Judul */}
                    <h1 style={{ fontSize: 22, marginBottom: 8 }}>Aktivasi Swift Kasir</h1>
                    <p className="text-muted" style={{ fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
                        Scan QR Code pada kartu aktivasi Swift Kasir untuk mulai menggunakan aplikasi.
                    </p>

                    {/* Token error feedback */}
                    {tokenError && (
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: 12,
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#ef4444',
                            fontSize: 13,
                            marginBottom: 20,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            textAlign: 'left',
                        }}>
                            <AlertCircle size={16} style={{ flexShrink: 0 }} />
                            {tokenError}
                        </div>
                    )}

                    {/* CTA Utama — Scan QR */}
                    <button
                        id="btn-scan-qr"
                        onClick={() => { setTokenError(''); setStep(STEP.SCANNING); }}
                        style={{
                            width: '100%',
                            padding: '16px',
                            borderRadius: 14,
                            border: 'none',
                            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                            color: 'white',
                            fontSize: 16,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            boxShadow: '0 8px 24px rgba(2,132,199,0.35)',
                            transition: 'all 0.2s',
                            marginBottom: 14,
                        }}
                    >
                        <QrCode size={22} />
                        Scan QR Aktivasi
                    </button>

                    {/* Link kecil — manual */}
                    <button
                        id="btn-manual-input"
                        onClick={() => { setTokenError(''); setStep(STEP.MANUAL); }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: 13,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: 4,
                        }}
                    >
                        Masukkan kode secara manual
                    </button>

                    {/* Device ID */}
                    <div className="card bg-dark" style={{ marginTop: 28, textAlign: 'left' }}>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>ID Perangkat Anda</label>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <code style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--accent)', letterSpacing: 1 }}>{deviceId}</code>
                            <button type="button" className="btn-icon" onClick={copyDeviceId} title="Salin ID">
                                {copySuccess ? <CheckCircle size={16} color="var(--success)" /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        Belum punya kartu aktivasi?<br />
                        Hubungi <b style={{ color: 'var(--text-main)' }}>0812-3456-7890</b> (WhatsApp)
                    </div>
                </div>
            </div>
        );
    }

    // ── SCANNING — kamera langsung aktif ─────────────────────
    if (step === STEP.SCANNING) {
        return (
            <>
                {/* Background page yang terlihat di belakang overlay scanner */}
                <div style={containerStyle}>
                    <div className="card" style={{ ...cardStyle, padding: '20px', opacity: 0.4 }}>
                        <img src={SwiftLogo} alt="Swift Kasir" style={{ height: 48, marginBottom: 12 }} />
                        <p className="text-muted" style={{ fontSize: 13 }}>Membuka kamera...</p>
                    </div>
                </div>
                <QRActivationScanner
                    onScan={handleQRScanned}
                    onClose={() => setStep(STEP.LANDING)}
                    onManual={() => setStep(STEP.MANUAL)}
                />
            </>
        );
    }

    // ── VALIDATING ───────────────────────────────────────────
    if (step === STEP.VALIDATING) {
        return (
            <div style={containerStyle}>
                <div className="card" style={{ ...cardStyle }}>
                    <div style={{
                        width: 72, height: 72,
                        borderRadius: '50%',
                        background: STATUS_STYLE.loading.bg,
                        border: `2px solid ${STATUS_STYLE.loading.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px',
                        animation: 'spin 1s linear infinite',
                    }}>
                        <Loader size={32} color={STATUS_STYLE.loading.color} />
                    </div>
                    <h2 style={{ fontSize: 18, marginBottom: 8 }}>Memvalidasi QR...</h2>
                    <p className="text-muted" style={{ fontSize: 14 }}>Mohon tunggu sebentar</p>
                    <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                </div>
            </div>
        );
    }

    // ── MANUAL ───────────────────────────────────────────────
    if (step === STEP.MANUAL) {
        return (
            <div style={containerStyle}>
                <div className="card" style={cardStyle}>
                    <div style={{
                        width: 64, height: 64,
                        background: 'rgba(56,189,248,0.1)',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px',
                    }}>
                        <Key size={30} className="text-primary" />
                    </div>

                    <h1 style={{ fontSize: 20, marginBottom: 8 }}>Masukkan Kode Aktivasi</h1>
                    <p className="text-muted" style={{ fontSize: 13, marginBottom: 24 }}>
                        Masukkan kode aktivasi yang tertera pada kartu Swift Kasir.
                    </p>

                    {tokenError && (
                        <div style={{
                            padding: '10px 14px', borderRadius: 10,
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#ef4444', fontSize: 13, marginBottom: 16,
                            display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                        }}>
                            <AlertCircle size={16} style={{ flexShrink: 0 }} />
                            {tokenError}
                        </div>
                    )}

                    <form onSubmit={handleManualValidate}>
                        <div className="input-group" style={{ textAlign: 'left', marginBottom: 20 }}>
                            <label>Kode Aktivasi</label>
                            <div style={{ position: 'relative' }}>
                                <Key size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }} />
                                <input
                                    id="manual-token-input"
                                    value={manualToken}
                                    onChange={e => setManualToken(e.target.value.toUpperCase())}
                                    placeholder="SK-XXXXXXXXXXXX-XXXX"
                                    style={{ paddingLeft: 38, fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }}>
                            Verifikasi Kode <ArrowRight size={16} style={{ display: 'inline', marginLeft: 4 }} />
                        </button>
                    </form>

                    <button
                        onClick={() => { setTokenError(''); setStep(STEP.SCANNING); }}
                        style={{
                            background: 'none', border: 'none',
                            color: 'var(--accent)', fontSize: 13, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto',
                        }}
                    >
                        <QrCode size={15} /> Scan QR Code sebagai gantinya
                    </button>

                    <button
                        onClick={() => { setTokenError(''); setStep(STEP.LANDING); }}
                        style={{
                            background: 'none', border: 'none',
                            color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
                            marginTop: 12, display: 'flex', alignItems: 'center', gap: 4, margin: '12px auto 0',
                        }}
                    >
                        <ArrowLeft size={13} /> Kembali
                    </button>
                </div>
            </div>
        );
    }

    // ── REGISTER ─────────────────────────────────────────────
    if (step === STEP.REGISTER) {
        return (
            <div style={containerStyle}>
                <div className="card" style={{ ...cardStyle, textAlign: 'left' }}>
                    {/* Header sukses validasi */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderRadius: 12,
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        marginBottom: 24,
                    }}>
                        <ShieldCheck size={22} color="#10b981" style={{ flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>
                                ✓ QR Aktivasi Valid
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                {licenseService.parseLicenseInfo(scannedToken).licenseType === 'premium'
                                    ? 'Lisensi Premium 2 Tahun'
                                    : licenseService.parseLicenseInfo(scannedToken).licenseType === 'lifetime'
                                    ? 'Lisensi Seumur Hidup'
                                    : 'Lisensi Standar 1 Tahun'
                                } berhasil diverifikasi.
                            </div>
                        </div>
                    </div>

                    <h2 style={{ fontSize: 18, marginBottom: 4, textAlign: 'center' }}>Buat Akun Swift Kasir</h2>
                    <p className="text-muted" style={{ fontSize: 13, marginBottom: 24, textAlign: 'center' }}>
                        Lengkapi data toko Anda untuk melanjutkan.
                    </p>

                    <form onSubmit={handleRegister}>
                        {/* Nama Toko */}
                        <div className="input-group" style={{ marginBottom: 14 }}>
                            <label>Nama Toko</label>
                            <div style={{ position: 'relative' }}>
                                <Store size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }} />
                                <input
                                    id="reg-store-name"
                                    value={storeName}
                                    onChange={e => setStoreName(e.target.value)}
                                    placeholder="Contoh: Toko Berkah"
                                    style={{ paddingLeft: 38 }}
                                    required
                                />
                            </div>
                        </div>

                        {/* Alamat Toko */}
                        <div className="input-group" style={{ marginBottom: 14 }}>
                            <label>Alamat Toko</label>
                            <div style={{ position: 'relative' }}>
                                <MapPin size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }} />
                                <input
                                    id="reg-store-address"
                                    value={storeAddress}
                                    onChange={e => setStoreAddress(e.target.value)}
                                    placeholder="Jl. Raya No. 1, Kecamatan..."
                                    style={{ paddingLeft: 38 }}
                                    required
                                />
                            </div>
                        </div>

                        {/* GPS */}
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                                Titik Lokasi Toko
                            </label>
                            <button
                                type="button"
                                id="btn-detect-gps"
                                onClick={handleDetectGPS}
                                disabled={isLocating}
                                style={{
                                    width: '100%',
                                    padding: '11px 16px',
                                    background: coordinates ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                                    border: `1px solid ${coordinates ? 'rgba(16,185,129,0.4)' : 'rgba(59,130,246,0.4)'}`,
                                    borderRadius: 8,
                                    color: coordinates ? '#10b981' : '#60a5fa',
                                    cursor: isLocating ? 'wait' : 'pointer',
                                    fontWeight: 600, fontSize: 14,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    transition: 'all 0.2s',
                                }}
                            >
                                <Navigation size={16} />
                                {isLocating
                                    ? 'Mendeteksi lokasi...'
                                    : coordinates
                                        ? `✅ ${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`
                                        : 'Klik Lokasi Saat Ini'}
                            </button>
                        </div>

                        {/* Username */}
                        <div className="input-group" style={{ marginBottom: 14 }}>
                            <label>Username</label>
                            <div style={{ position: 'relative' }}>
                                <User size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }} />
                                <input
                                    id="reg-username"
                                    value={username}
                                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                                    placeholder="Contoh: owner"
                                    style={{ paddingLeft: 38 }}
                                    autoComplete="username"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="input-group" style={{ marginBottom: 14 }}>
                            <label>Password</label>
                            <div style={{ position: 'relative' }}>
                                <Key size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }} />
                                <input
                                    id="reg-password"
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Min. 4 karakter"
                                    style={{ paddingLeft: 38 }}
                                    autoComplete="new-password"
                                    required
                                    minLength={4}
                                />
                            </div>
                        </div>

                        {/* Nomor HP */}
                        <div className="input-group" style={{ marginBottom: 20 }}>
                            <label>Nomor HP</label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }} />
                                <input
                                    id="reg-phone"
                                    type="tel"
                                    inputMode="numeric"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                                    placeholder="08xxxxxxxxxx"
                                    style={{ paddingLeft: 38 }}
                                />
                            </div>
                        </div>

                        {error && (
                            <div style={{
                                color: 'var(--error)', fontSize: 13,
                                marginBottom: 16, padding: '10px 14px',
                                background: 'rgba(239,68,68,0.08)', borderRadius: 8,
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <AlertCircle size={15} />
                                {error}
                            </div>
                        )}

                        <button
                            id="btn-activate"
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', fontSize: 15, padding: '14px' }}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Memproses...' : 'Aktifkan Swift Kasir'}
                        </button>
                    </form>

                    <button
                        onClick={() => { setTokenError(''); setStep(STEP.LANDING); }}
                        style={{
                            background: 'none', border: 'none',
                            color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
                            marginTop: 14, display: 'flex', alignItems: 'center',
                            gap: 4, margin: '14px auto 0',
                        }}
                    >
                        <ArrowLeft size={13} /> Scan QR lain
                    </button>
                </div>
            </div>
        );
    }

    // ── SUCCESS ──────────────────────────────────────────────
    if (step === STEP.SUCCESS) {
        return (
            <div style={containerStyle}>
                <div className="card" style={{ ...cardStyle, textAlign: 'center' }}>
                    <div style={{
                        width: 80, height: 80,
                        borderRadius: '50%',
                        background: 'rgba(16,185,129,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px',
                        animation: 'bounceIn 0.5s ease-out',
                    }}>
                        <CheckCircle size={42} color="#10b981" />
                    </div>
                    <h1 style={{ fontSize: 22, marginBottom: 8, color: '#10b981' }}>Aktivasi Berhasil!</h1>
                    <p className="text-muted" style={{ fontSize: 14 }}>
                        Swift Kasir siap digunakan. Mengalihkan ke aplikasi...
                    </p>
                    <style>{`@keyframes bounceIn { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }`}</style>
                </div>
            </div>
        );
    }

    return null;
};

export default ActivationPage;
