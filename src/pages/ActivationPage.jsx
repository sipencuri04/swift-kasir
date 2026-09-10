import React, { useEffect, useState, useCallback, useRef, Component } from 'react';

// ─── Error Boundary ───────────────────────────────────────────
class ActivationErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorMsg: '' };
    }
    static getDerivedStateFromError(err) {
        return { hasError: true, errorMsg: err?.message || String(err) };
    }
    componentDidCatch(err, info) {
        console.error('[ActivationPage] Error:', err, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: 'var(--bg-color)', padding: 24,
                }}>
                    <div className="card" style={{ maxWidth: 400, width: '100%', textAlign: 'center', padding: 32 }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                        <h2 style={{ marginBottom: 8, color: '#ef4444' }}>Terjadi Kesalahan</h2>
                        <p className="text-muted" style={{ fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                            {this.state.errorMsg || 'Proses aktivasi mengalami error.'}
                        </p>
                        <button
                            className="btn btn-primary"
                            onClick={() => window.location.reload()}
                            style={{ width: '100%' }}
                        >
                            Muat Ulang Aplikasi
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
import { licenseService } from '../services/LicenseService';
import { dbService } from '../services/DatabaseService';
import { AlertService } from '../utils/AlertService';
import QRActivationScanner from '../components/QRActivationScanner';
import { useAuth } from '../components/AuthContext';
import {
    QrCode, Key, CheckCircle, Copy, MapPin, Store,
    Navigation, User, Phone, ArrowRight, ArrowLeft,
    Loader, ShieldCheck, AlertCircle, ChevronRight,
    Sparkles, LogIn, Eye, EyeOff,
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
    const { login } = useAuth();

    // Token state
    const [scannedToken, setScannedToken] = useState('');
    const [manualToken, setManualToken]   = useState('');
    const [tokenStatus, setTokenStatus]   = useState(null); // null | 'valid' | 'invalid'
    const [tokenError, setTokenError]     = useState('');

    const [isLoading, setIsLoading]     = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [error, setError]             = useState('');
    const [generatedAccount, setGeneratedAccount] = useState(null);
    const [copySuccess, setCopySuccess]       = useState({ user: false, pass: false });
    const [copyDeviceIdSuccess, setCopyDeviceIdSuccess] = useState(false);
    const [showPassword, setShowPassword]     = useState(true); // default tampil

    useEffect(() => {
        licenseService.getDeviceId().then(id => setDeviceId(id));
    }, []);

    // ── Auto Activate & Generate Account ─────────────────────
    const autoActivateAndCreateAccount = async (token) => {
        setIsLoading(true);
        try {
            console.log('[Activation] Memulai auto-aktivasi dengan token:', token);
            const existingUsers = await dbService.getUsers();
            console.log('[Activation] Users saat ini:', existingUsers.length);

            let randomUser = 'admin' + Math.floor(1000 + Math.random() * 9000);
            while (existingUsers.find(u => u.username === randomUser)) {
                randomUser = 'admin' + Math.floor(1000 + Math.random() * 9000);
            }
            const randomPass = Math.floor(100000 + Math.random() * 900000).toString();
            const defaultStoreName = 'Toko Baru';

            console.log('[Activation] Membuat user baru:', randomUser);
            await dbService.createUser({
                username: randomUser,
                password: randomPass,
                role: 'superuser',
                name: defaultStoreName,
            });

            console.log('[Activation] Mengaktifkan lisensi QR...');
            await licenseService.activateWithQRToken(token, {
                storeName: defaultStoreName,
                storeAddress: 'Belum diatur',
                coordinates: null,
                username: randomUser,
                phone: '',
            });

            localStorage.setItem('kasir_store_info', JSON.stringify({
                storeName: defaultStoreName,
                storeAddress: 'Belum diatur',
                phone: '',
                coordinates: null,
            }));

            console.log('[Activation] Berhasil! Akun:', randomUser, '/', randomPass);
            setGeneratedAccount({ username: randomUser, password: randomPass });
            setStep(STEP.SUCCESS);

            // ── Notifikasi Pop-up Aktivasi Berhasil ──
            await AlertService.success(
                '🎉 Aktivasi Berhasil!',
                '',
                `<div style="text-align:left; font-size:14px; line-height:1.8">
                    <p style="margin:0 0 12px; color:#94a3b8">Lisensi Swift Kasir Anda telah aktif.<br>Simpan kredensial berikut dengan aman:</p>
                    <div style="background:rgba(14,165,233,0.1); border:1px solid rgba(14,165,233,0.3); border-radius:12px; padding:14px">
                        <div style="margin-bottom:8px">
                            <span style="color:#94a3b8; font-size:12px">Username</span><br>
                            <code style="color:#38bdf8; font-size:18px; font-weight:700">${randomUser}</code>
                        </div>
                        <div>
                            <span style="color:#94a3b8; font-size:12px">Password</span><br>
                            <code style="color:#10b981; font-size:18px; font-weight:700">${randomPass}</code>
                        </div>
                    </div>
                    <p style="margin:10px 0 0; font-size:11px; color:#fbbf24">⚠️ Screenshot atau catat password ini sekarang!</p>
                </div>`
            );
        } catch (err) {
            console.error('[Activation] GAGAL:', err?.message || err, err?.stack);
            setTokenError('Terjadi kesalahan saat aktivasi: ' + (err?.message || String(err)));
            setTokenStatus('invalid');
            setStep(STEP.LANDING);
        } finally {
            setIsLoading(false);
        }
    };

    // ── Ref untuk autoActivate agar useCallback tidak stale ──
    const autoActivateRef = useRef(autoActivateAndCreateAccount);
    useEffect(() => {
        autoActivateRef.current = autoActivateAndCreateAccount;
    });

    // ── Setelah QR ter-scan ──────────────────────────────────
    const handleQRScanned = useCallback(async (rawText) => {
        setStep(STEP.VALIDATING);
        setTokenError('');

        try {
            const result = await licenseService.validateQRToken(rawText);
            if (result.valid) {
                setScannedToken(result.token);
                setTokenStatus('valid');
                // Pakai ref agar selalu memanggil versi terbaru
                await autoActivateRef.current(result.token);
            } else {
                setTokenError(result.reason || 'QR tidak valid.');
                setTokenStatus('invalid');
                setStep(STEP.LANDING);
            }
        } catch (e) {
            console.error('[handleQRScanned] error:', e);
            setTokenError('Terjadi kesalahan: ' + (e?.message || String(e)));
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
                await autoActivateAndCreateAccount(result.token);
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

    const copyDeviceId = () => {
        navigator.clipboard.writeText(deviceId).then(() => {
            setCopyDeviceIdSuccess(true);
            setTimeout(() => setCopyDeviceIdSuccess(false), 2000);
        }).catch(e => console.warn('Copy failed:', e));
    };

    const copyToClipboard = (text, field) => {
        navigator.clipboard.writeText(text);
        setCopySuccess(prev => ({ ...prev, [field]: true }));
        setTimeout(() => setCopySuccess(prev => ({ ...prev, [field]: false })), 2000);
    };

    // ── Auto Login setelah aktivasi ───────────────────────────
    const handleLoginNow = async () => {
        if (!generatedAccount) return;
        setIsLoggingIn(true);
        try {
            const ok = await login(generatedAccount.username, generatedAccount.password);
            if (ok) {
                // Trigger parent callback agar App.jsx tahu sudah aktif
                if (onSuccess) onSuccess();
                // Refresh halaman agar routing berjalan normal
                window.location.reload();
            } else {
                setError('Gagal login otomatis. Silakan login secara manual.');
            }
        } catch (e) {
            console.error(e);
            setError('Terjadi kesalahan saat login.');
        } finally {
            setIsLoggingIn(false);
        }
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
                                {copyDeviceIdSuccess ? <CheckCircle size={16} color="var(--success)" /> : <Copy size={16} />}
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
                <div className="card" style={{ ...cardStyle, textAlign: 'center', padding: '40px 28px' }}>

                    {/* ── Ikon sukses animasi ── */}
                    <div style={{
                        width: 90, height: 90,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))',
                        border: '2px solid rgba(16,185,129,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 8px',
                        animation: 'bounceIn 0.6s cubic-bezier(0.34,1.56,0.64,1)',
                        boxShadow: '0 0 40px rgba(16,185,129,0.2)',
                    }}>
                        <CheckCircle size={46} color="#10b981" strokeWidth={2} />
                    </div>

                    {/* Bintang animasi */}
                    <div style={{ fontSize: 22, marginBottom: 16, animation: 'fadeUp 0.5s 0.3s both' }}>✨</div>

                    <h1 style={{
                        fontSize: 24, marginBottom: 6, color: '#10b981',
                        fontWeight: 800, animation: 'fadeUp 0.5s 0.2s both',
                    }}>
                        Aktivasi Berhasil!
                    </h1>
                    <p className="text-muted" style={{
                        fontSize: 14, marginBottom: 28, lineHeight: 1.7,
                        animation: 'fadeUp 0.5s 0.3s both',
                    }}>
                        🎉 Selamat! Lisensi Swift Kasir Anda telah aktif.<br />
                        Akun admin telah dibuat otomatis untuk Anda.
                    </p>

                    {/* ── Kartu Kredensial ── */}
                    {generatedAccount && (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(56,189,248,0.04))',
                            border: '1px solid rgba(14,165,233,0.3)',
                            borderRadius: 16,
                            padding: '20px',
                            marginBottom: 24,
                            textAlign: 'left',
                            animation: 'fadeUp 0.5s 0.4s both',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            {/* Badge */}
                            <div style={{
                                position: 'absolute', top: 12, right: 12,
                                background: 'rgba(16,185,129,0.15)',
                                border: '1px solid rgba(16,185,129,0.3)',
                                borderRadius: 20, padding: '2px 10px',
                                fontSize: 11, color: '#10b981', fontWeight: 700,
                            }}>SUPERUSER</div>

                            <div style={{ fontSize: 12, color: '#38bdf8', marginBottom: 14, fontWeight: 700, letterSpacing: 0.5 }}>
                                🔑 KREDENSIAL LOGIN — SIMPAN BAIK-BAIK
                            </div>

                            {/* Username Row */}
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'space-between', marginBottom: 10,
                                background: 'rgba(0,0,0,0.15)', borderRadius: 10,
                                padding: '10px 14px',
                            }}>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Username</div>
                                    <code style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}>
                                        {generatedAccount.username}
                                    </code>
                                </div>
                                <button
                                    onClick={() => copyToClipboard(generatedAccount.username, 'user')}
                                    title="Salin username"
                                    style={{
                                        background: copySuccess.user ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)',
                                        border: '1px solid ' + (copySuccess.user ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.15)'),
                                        borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                                        color: copySuccess.user ? '#10b981' : 'var(--text-muted)',
                                        fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {copySuccess.user
                                        ? <><CheckCircle size={13} /> Disalin</>
                                        : <><Copy size={13} /> Salin</>
                                    }
                                </button>
                            </div>

                            {/* Password Row */}
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(0,0,0,0.15)', borderRadius: 10,
                                padding: '10px 14px',
                            }}>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Password</div>
                                    <code style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}>
                                        {showPassword ? generatedAccount.password : '••••••'}
                                    </code>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                        onClick={() => setShowPassword(p => !p)}
                                        title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                                        style={{
                                            background: 'rgba(255,255,255,0.08)',
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                                            color: 'var(--text-muted)',
                                            display: 'flex', alignItems: 'center',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                    <button
                                        onClick={() => copyToClipboard(generatedAccount.password, 'pass')}
                                        title="Salin password"
                                        style={{
                                            background: copySuccess.pass ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)',
                                            border: '1px solid ' + (copySuccess.pass ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.15)'),
                                            borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                                            color: copySuccess.pass ? '#10b981' : 'var(--text-muted)',
                                            fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {copySuccess.pass
                                            ? <><CheckCircle size={13} /> Disalin</>
                                            : <><Copy size={13} /> Salin</>
                                        }
                                    </button>
                                </div>
                            </div>

                            {/* Warning simpan */}
                            <div style={{
                                marginTop: 12, padding: '8px 12px',
                                background: 'rgba(251,191,36,0.08)',
                                border: '1px solid rgba(251,191,36,0.25)',
                                borderRadius: 8, fontSize: 11,
                                color: '#fbbf24', lineHeight: 1.5,
                            }}>
                                ⚠️ Simpan kredensial ini sebelum melanjutkan. Password tidak dapat dipulihkan jika hilang.
                            </div>
                        </div>
                    )}

                    {/* Error login */}
                    {error && (
                        <div style={{
                            padding: '10px 14px', borderRadius: 10,
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#ef4444', fontSize: 13, marginBottom: 16,
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            <AlertCircle size={15} />{error}
                        </div>
                    )}

                    {/* ── Tombol Login Sekarang ── */}
                    <button
                        id="btn-login-now"
                        onClick={handleLoginNow}
                        disabled={isLoggingIn}
                        style={{
                            width: '100%', fontSize: 16, padding: '15px',
                            borderRadius: 14, border: 'none',
                            background: isLoggingIn
                                ? 'rgba(16,185,129,0.4)'
                                : 'linear-gradient(135deg, #10b981, #059669)',
                            color: 'white', fontWeight: 800, cursor: isLoggingIn ? 'wait' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                            boxShadow: '0 8px 24px rgba(16,185,129,0.35)',
                            transition: 'all 0.2s',
                            animation: 'fadeUp 0.5s 0.5s both',
                        }}
                    >
                        {isLoggingIn
                            ? <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Masuk ke Aplikasi...</>
                            : <><LogIn size={18} /> Login & Masuk ke Aplikasi</>
                        }
                    </button>

                    <style>{`
                        @keyframes bounceIn {
                            0%   { transform: scale(0.4); opacity: 0; }
                            60%  { transform: scale(1.12); opacity: 1; }
                            80%  { transform: scale(0.95); }
                            100% { transform: scale(1); }
                        }
                        @keyframes fadeUp {
                            from { opacity: 0; transform: translateY(16px); }
                            to   { opacity: 1; transform: translateY(0); }
                        }
                        @keyframes spin {
                            from { transform: rotate(0deg); }
                            to   { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    return null;
};

const ActivationPageWithBoundary = (props) => (
    <ActivationErrorBoundary>
        <ActivationPage {...props} />
    </ActivationErrorBoundary>
);

export default ActivationPageWithBoundary;
