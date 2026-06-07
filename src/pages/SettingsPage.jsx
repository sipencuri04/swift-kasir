import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { printerService } from '../services/PrinterService';
import { dbService } from '../services/DatabaseService';
import { licenseService } from '../services/LicenseService'; // Import LicenseService
import { useAuth } from '../components/AuthContext';
import { useTheme } from '../components/ThemeContext';
import { Bluetooth, Loader, CheckCircle, Smartphone, Users, UserPlus, Trash, LogOut, ChevronRight, ArrowLeft, Moon, Sun, Database, FileDown, FileUp, Lock, FileText, Key, ShieldCheck, Clock, Sparkles, FileSpreadsheet, Eye, EyeOff, Edit2, QrCode, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAndShareFile } from '../utils/exportHelper';
import { AlertService } from '../utils/AlertService';

const SettingsPage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [activeMenu, setActiveMenu] = useState('main'); // main, bluetooth, users, data, register, receipt
    const [licenseStatus, setLicenseStatus] = useState(null);
    const [showActivation, setShowActivation] = useState(false);
    const [inputKey, setInputKey] = useState('');

    useEffect(() => {
        checkLicense();
    }, []);

    const checkLicense = async () => {
        const isPermanent = localStorage.getItem('kasir_license_key');
        if (isPermanent) {
            setLicenseStatus({ type: 'permanent' });
        } else {
            const status = await licenseService.checkTrialStatus();
            setLicenseStatus({ type: 'trial', ...status });
        }
    };

    const handleActivate = async (e) => {
        e.preventDefault();
        const success = await licenseService.activate(inputKey.trim().toUpperCase());
        if (success) {
            await AlertService.success('Berhasil', 'Aktivasi Berhasil!');
            window.location.reload();
        } else {
            AlertService.error('Gagal', 'Kode Salah.');
        }
    };

    // Robust check for superuser
    const isSuperuser = user?.role === 'superuser' || user?.username === 'owner';

    return (
        <div className="page-container">
            {activeMenu === 'main' && (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <h1>Pengaturan</h1>
                    </div>

                    {/* Profile Card */}
                    <div className="card mb-6" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 'bold' }}>
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 style={{ margin: 0 }}>{user?.name || user?.username}</h3>
                            <p className="text-accent" style={{ fontSize: 13, textTransform: 'capitalize' }}>{user?.role}</p>
                        </div>
                    </div>

                    {/* License Status Card */}
                    {licenseStatus && (
                        <div className="card mb-6" style={{ background: licenseStatus.type === 'permanent' ? 'linear-gradient(135deg, #059669, #10b981)' : 'var(--bg-card)' }}>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center" style={{ gap: 12 }}>
                                    {licenseStatus.type === 'permanent' ? <ShieldCheck size={24} color="white" /> : <Clock size={24} className="text-warning" />}
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: 16, color: licenseStatus.type === 'permanent' ? 'white' : 'var(--text-main)' }}>
                                            {licenseStatus.type === 'permanent' ? 'Lisensi Permanen' : 'Mode Trial (Uji Coba)'}
                                        </h3>
                                        {licenseStatus.type === 'trial' && (
                                            <p className="text-muted" style={{ fontSize: 13 }}>
                                                Sisa waktu: {licenseStatus.remainingDays} hari
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {licenseStatus.type === 'trial' && (
                                    <button className="btn btn-sm btn-primary" onClick={() => setShowActivation(!showActivation)}>
                                        Aktifkan
                                    </button>
                                )}
                            </div>

                            {showActivation && (
                                <form onSubmit={handleActivate} style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                                    <div className="input-group">
                                        <label>Masukkan Kode Aktivasi</label>
                                        <input
                                            value={inputKey}
                                            onChange={e => setInputKey(e.target.value.toUpperCase())}
                                            placeholder="XXXX-XXXX-XXXX-XXXX"
                                            style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                                            required
                                        />
                                    </div>
                                    <button className="btn btn-primary w-full">Verifikasi Kode</button>
                                </form>
                            )}
                        </div>
                    )}

                    {/* Menus */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

                        {/* Reports Menu - Moved to Top */}
                        {isSuperuser && (
                            <div
                                className="menu-item"
                                onClick={() => navigate('/reports')}
                                style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                            >
                                <div className="flex items-center" style={{ gap: 12 }}>
                                    <div style={{ padding: 8, background: 'rgba(234, 179, 8, 0.1)', borderRadius: 8 }}>
                                        <FileText size={20} style={{ color: '#eab308' }} />
                                    </div>
                                    <span style={{ fontSize: 16 }}>Laporan Penjualan</span>
                                </div>
                                <ChevronRight size={18} color="#94a3b8" />
                            </div>
                        )}

                        {/* Theme Toggle */}
                        <div
                            className="menu-item"
                            onClick={toggleTheme}
                            style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                        >
                            <div className="flex items-center" style={{ gap: 12 }}>
                                <div style={{ padding: 8, background: theme === 'dark' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(234, 179, 8, 0.1)', borderRadius: 8 }}>
                                    {theme === 'dark' ? <Moon size={20} className="text-accent" /> : <Sun size={20} color="#eab308" />}
                                </div>
                                <span style={{ fontSize: 16 }}>Mode {theme === 'dark' ? 'Gelap' : 'Terang'}</span>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                {theme === 'dark' ? 'ON' : 'OFF'}
                            </div>
                        </div>

                        <div
                            className="menu-item"
                            onClick={() => setActiveMenu('hardware')}
                            style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                        >
                            <div className="flex items-center" style={{ gap: 12 }}>
                                <div style={{ padding: 8, background: 'rgba(56, 189, 248, 0.1)', borderRadius: 8 }}>
                                    <Smartphone size={20} className="text-accent" />
                                </div>
                                <span style={{ fontSize: 16 }}>Pengaturan Hardware</span>
                            </div>
                            <ChevronRight size={18} color="#94a3b8" />
                        </div>

                        {isSuperuser && (
                            <>
                                <div
                                    className="menu-item"
                                    onClick={() => setActiveMenu('receipt')}
                                    style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                                >
                                    <div className="flex items-center" style={{ gap: 12 }}>
                                        <div style={{ padding: 8, background: 'rgba(249, 115, 22, 0.1)', borderRadius: 8 }}>
                                            <FileSpreadsheet size={20} style={{ color: '#f97316' }} />
                                        </div>
                                        <span style={{ fontSize: 16 }}>Pengaturan Struk</span>
                                    </div>
                                    <ChevronRight size={18} color="#94a3b8" />
                                </div>

                                <div
                                    className="menu-item"
                                    onClick={() => setActiveMenu('qris')}
                                    style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                                >
                                    <div className="flex items-center" style={{ gap: 12 }}>
                                        <div style={{ padding: 8, background: 'rgba(99, 102, 241, 0.1)', borderRadius: 8 }}>
                                            <QrCode size={20} style={{ color: '#6366f1' }} />
                                        </div>
                                        <span style={{ fontSize: 16 }}>Pengaturan QRIS</span>
                                    </div>
                                    <ChevronRight size={18} color="#94a3b8" />
                                </div>
                            </>
                        )}

                        {isSuperuser && (
                            <div
                                className="menu-item"
                                onClick={() => setActiveMenu('users')}
                                style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                            >
                                <div className="flex items-center" style={{ gap: 12 }}>
                                    <div style={{ padding: 8, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 8 }}>
                                        <Users size={20} style={{ color: '#22c55e' }} />
                                    </div>
                                    <span style={{ fontSize: 16 }}>Manajemen User</span>
                                </div>
                                <ChevronRight size={18} color="#94a3b8" />
                            </div>
                        )}

                        {isSuperuser && (
                            <div
                                className="menu-item"
                                onClick={() => setActiveMenu('data')}
                                style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                            >
                                <div className="flex items-center" style={{ gap: 12 }}>
                                    <div style={{ padding: 8, background: 'rgba(168, 85, 247, 0.1)', borderRadius: 8 }}>
                                        <Database size={20} style={{ color: '#a855f7' }} />
                                    </div>
                                    <span style={{ fontSize: 16 }}>Manajemen Data</span>
                                </div>
                                <ChevronRight size={18} color="#94a3b8" />
                            </div>
                        )}

                        {!isSuperuser && (
                            <div
                                className="menu-item"
                                onClick={() => setActiveMenu('register')}
                                style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                            >
                                <div className="flex items-center" style={{ gap: 12 }}>
                                    <div style={{ padding: 8, background: 'rgba(244, 63, 94, 0.1)', borderRadius: 8 }}>
                                        <Lock size={20} style={{ color: '#f43f5e' }} />
                                    </div>
                                    <span style={{ fontSize: 16 }}>Tutup Toko / Shift</span>
                                </div>
                                <ChevronRight size={18} color="#94a3b8" />
                            </div>
                        )}

                        <div
                            className="menu-item"
                            onClick={logout}
                            style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                        >
                            <div className="flex items-center" style={{ gap: 12 }}>
                                <div style={{ padding: 8, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8 }}>
                                    <LogOut size={20} style={{ color: '#ef4444' }} />
                                </div>
                                <span style={{ fontSize: 16, color: '#ef4444' }}>Logout</span>
                            </div>
                            <ChevronRight size={18} color="#94a3b8" />
                        </div>
                    </div>
                </>
            )}

            {activeMenu === 'hardware' && (
                <HardwareView onBack={() => setActiveMenu('main')} />
            )}

            {activeMenu === 'users' && (
                <UsersView onBack={() => setActiveMenu('main')} />
            )}

            {activeMenu === 'data' && (
                <DataManagementView onBack={() => setActiveMenu('main')} />
            )}

            {activeMenu === 'register' && (
                <CashRegisterView onBack={() => setActiveMenu('main')} />
            )}

            {activeMenu === 'receipt' && (
                <ReceiptView onBack={() => setActiveMenu('main')} />
            )}

            {activeMenu === 'qris' && (
                <QrisView onBack={() => setActiveMenu('main')} />
            )}
        </div>
    );
};

// --- Sub Views ---

const HardwareView = ({ onBack }) => {
    const [devices, setDevices] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [connectedId, setConnectedId] = useState(null);
    const [status, setStatus] = useState('');
    const [testBarcode, setTestBarcode] = useState('');

    const scanDevices = async () => {
        setScanning(true);
        setStatus('Scanning...');
        try {
            const list = await printerService.listDevices();
            setDevices(list);
            setStatus(`Ditemukan ${list.length} perangkat.`);
        } catch (err) {
            setStatus('Error: ' + err.message);
        } finally {
            setScanning(false);
        }
    };

    const connect = async (device) => {
        setStatus('Menghubungkan ke ' + device.name + '...');
        try {
            await printerService.connect(device.address);
            setConnectedId(device.address);
            setStatus('Terhubung ke ' + device.name);
        } catch (err) {
            setStatus('Gagal: ' + err.message);
        }
    };

    const disconnect = async () => {
        await printerService.disconnect();
        setConnectedId(null);
        setStatus('Terputus');
    };

    const testCashDrawer = async () => {
        try {
            await printerService.openCashDrawer();
            AlertService.success('Berhasil', 'Sinyal laci uang telah dikirim.');
        } catch (e) {
            AlertService.error('Gagal', 'Pastikan printer Bluetooth terhubung terlebih dahulu.');
        }
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="flex items-center mb-6" onClick={onBack} style={{ cursor: 'pointer', gap: 8 }}>
                <ArrowLeft size={20} />
                <h2>Pengaturan Hardware</h2>
            </div>

            {/* 1. Barcode Scanner */}
            <div className="card mb-6">
                <div className="flex items-center mb-4" style={{ gap: 12 }}>
                    <div style={{ padding: 8, background: 'rgba(168, 85, 247, 0.1)', borderRadius: 8 }}>
                        <Smartphone size={24} style={{ color: '#a855f7' }} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0 }}>Barcode Scanner</h3>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Mendukung tipe USB & Bluetooth</p>
                    </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                    Sistem <strong>Global Scanner Listener</strong> sudah aktif. Anda tidak perlu mengklik kotak pencarian saat transaksi. Langsung *scan* dan barang akan otomatis masuk ke keranjang kasir.
                </div>
                <div className="input-group">
                    <label>Tes Scanner di Sini:</label>
                    <input 
                        type="text" 
                        value={testBarcode}
                        onChange={(e) => setTestBarcode(e.target.value)}
                        placeholder="Scan barcode untuk mencoba..."
                    />
                </div>
            </div>

            {/* 2. Cash Drawer */}
            <div className="card mb-6">
                <div className="flex items-center mb-4" style={{ gap: 12 }}>
                    <div style={{ padding: 8, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 8 }}>
                        <Database size={24} style={{ color: '#22c55e' }} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0 }}>Laci Uang (Cash Drawer)</h3>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Terkoneksi via port RJ11 Printer</p>
                    </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                    Laci uang akan otomatis terbuka setiap kali struk kasir dicetak. Pastikan kabel RJ11 dari laci uang sudah dicolokkan ke bagian belakang Printer Thermal Bluetooth.
                </div>
                <button className="btn" onClick={testCashDrawer}>
                    <Lock size={18} /> Test Buka Laci
                </button>
            </div>

            {/* 3. Printer Bluetooth */}
            <div className="card mb-6">
                <div className="flex items-center mb-4" style={{ gap: 12 }}>
                    <div style={{ padding: 8, background: 'rgba(56, 189, 248, 0.1)', borderRadius: 8 }}>
                        <Bluetooth size={24} className="text-accent" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0 }}>Printer Kasir (Thermal)</h3>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Mendukung ukuran 58mm & 80mm</p>
                    </div>
                </div>

                <p className={connectedId ? "text-accent" : "text-muted"} style={{ marginBottom: 16, fontWeight: 'bold' }}>
                    Status: {connectedId ? "Terhubung" : "Tidak Terhubung"}
                </p>

                {connectedId && (
                    <button className="btn btn-danger" onClick={disconnect} style={{ marginBottom: 16, width: '100%', justifyContent: 'center' }}>
                        Putuskan Koneksi Printer
                    </button>
                )}

                <button className="btn btn-primary" onClick={scanDevices} disabled={scanning} style={{ width: '100%', justifyContent: 'center' }}>
                    {scanning ? <Loader className="spin" size={20} /> : <Bluetooth size={20} />}
                    {scanning ? 'Mencari Perangkat...' : 'Cari & Hubungkan Printer'}
                </button>

                <p style={{ marginTop: 12, fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
                    {status}
                </p>

                {devices.length > 0 && (
                    <div className="product-list" style={{ marginTop: 20 }}>
                        {devices.map((d, i) => (
                            <div key={i} className="product-card" onClick={() => connect(d)} style={{ cursor: 'pointer', border: connectedId === d.address ? '2px solid var(--primary)' : '1px solid var(--border-color)' }}>
                                <div className="flex items-center">
                                    <Bluetooth size={24} style={{ marginRight: 12, color: connectedId === d.address ? 'var(--primary)' : '#94a3b8' }} />
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: 16 }}>{d.name || 'Unnamed Printer'}</h3>
                                        <p style={{ fontSize: 12, margin: 0 }}>{d.address}</p>
                                    </div>
                                </div>
                                {connectedId === d.address && <CheckCircle size={20} color="var(--primary)" />}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const UsersView = ({ onBack }) => {
    const [users, setUsers] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formUser, setFormUser] = useState({ username: '', password: '', role: 'admin', name: '' });
    const [showPasswords, setShowPasswords] = useState({});

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        const u = await dbService.getUsers();
        setUsers(u);
    };

    const togglePassword = (id) => {
        setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleEdit = (u) => {
        setFormUser({ username: u.username, password: u.password, role: u.role, name: u.name });
        setEditingId(u.id);
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await dbService.updateUser(editingId, formUser);
                AlertService.success('Berhasil', 'User berhasil diperbarui');
            } else {
                await dbService.createUser(formUser);
                AlertService.success('Berhasil', 'User berhasil dibuat');
            }
            setFormUser({ username: '', password: '', role: 'admin', name: '' });
            setEditingId(null);
            setShowForm(false);
            loadUsers();
        } catch (err) {
            AlertService.error('Error', err.message);
        }
    };

    const handleDelete = async (id) => {
        if (await AlertService.confirm('Hapus User', 'Hapus user ini?')) {
            await dbService.deleteUser(id);
            loadUsers();
        }
    };

    const cancelForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormUser({ username: '', password: '', role: 'admin', name: '' });
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="flex items-center mb-6" style={{ gap: 12 }}>
                <button 
                    onClick={onBack}
                    style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 10, padding: 8, cursor: 'pointer', color: 'var(--text-main)' }}
                >
                    <ArrowLeft size={20} />
                </button>
                <h2 style={{ margin: 0 }}>Manajemen User</h2>
            </div>

            <div className="card" style={{ padding: '20px' }}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 style={{ margin: 0, fontSize: 16 }}>Daftar Pengguna</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Kelola akses kasir dan owner</p>
                    </div>
                    {!showForm && (
                        <button className="btn btn-sm" style={{ width: 'auto', padding: '8px 16px', background: 'var(--success)' }} onClick={() => setShowForm(true)}>
                            <UserPlus size={16} /> Tambah User
                        </button>
                    )}
                </div>

                {showForm && (
                    <div style={{ 
                        background: 'rgba(99, 102, 241, 0.05)', 
                        padding: 20, 
                        borderRadius: 16, 
                        marginBottom: 24, 
                        border: '1px solid var(--primary-bg)' 
                    }}>
                        <div className="flex justify-between items-center mb-4">
                            <h4 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                                {editingId ? <Edit2 size={16} /> : <UserPlus size={16} />}
                                {editingId ? 'Edit Data User' : 'Tambah User Baru'}
                            </h4>
                            <button onClick={cancelForm} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Batal</button>
                        </div>
                        
                        <form onSubmit={handleSubmit}>
                            <div className="input-group">
                                <label>Nama Lengkap</label>
                                <input className="modern-input" required value={formUser.name} onChange={e => setFormUser({ ...formUser, name: e.target.value })} placeholder="Contoh: Budi Santoso" />
                            </div>
                            <div className="grid-2">
                                <div className="input-group">
                                    <label>Username</label>
                                    <input 
                                        className="modern-input" 
                                        required 
                                        value={formUser.username} 
                                        onChange={e => setFormUser({ ...formUser, username: e.target.value })} 
                                        placeholder="Untuk login" 
                                        disabled={editingId && formUser.username === 'owner'}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            className="modern-input" 
                                            required 
                                            type={showPasswords['form'] ? 'text' : 'password'} 
                                            value={formUser.password} 
                                            onChange={e => setFormUser({ ...formUser, password: e.target.value })} 
                                            placeholder="***" 
                                            style={{ paddingRight: 40 }}
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => togglePassword('form')}
                                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                                        >
                                            {showPasswords['form'] ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="input-group">
                                <label>Role / Akses</label>
                                <select 
                                    className="modern-select" 
                                    value={formUser.role} 
                                    onChange={e => setFormUser({ ...formUser, role: e.target.value })}
                                    disabled={editingId && formUser.username === 'owner'}
                                >
                                    <option value="admin">Admin (Kasir)</option>
                                    <option value="superuser">Superuser (Owner)</option>
                                </select>
                            </div>
                            <button className="btn" type="submit" style={{ marginTop: 8 }}>
                                <Database size={18} /> {editingId ? 'Update Data User' : 'Simpan User Baru'}
                            </button>
                        </form>
                    </div>
                )}

                <div className="table-container" style={{ border: 'none' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                        <thead>
                            <tr style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                <th style={{ padding: '0 12px 10px', textAlign: 'left', fontWeight: 500 }}>Info User</th>
                                <th style={{ padding: '0 12px 10px', textAlign: 'left', fontWeight: 500 }}>Password</th>
                                <th style={{ padding: '0 12px 10px', textAlign: 'left', fontWeight: 500 }}>Akses</th>
                                <th style={{ padding: '0 12px 10px', width: 100, textAlign: 'center', fontWeight: 500 }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} style={{ background: 'var(--input-bg)', borderRadius: 12 }}>
                                    <td style={{ padding: 12, borderRadius: '12px 0 0 12px' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 14 }}>{u.name || u.username}</div>
                                        <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 2, fontWeight: 500 }}>@{u.username}</div>
                                    </td>
                                    <td style={{ padding: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ 
                                                fontFamily: 'monospace', 
                                                fontSize: 14, 
                                                letterSpacing: showPasswords[u.id] ? '0' : '3px' 
                                            }}>
                                                {showPasswords[u.id] ? u.password : '••••••'}
                                            </span>
                                            <button 
                                                onClick={() => togglePassword(u.id)}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                            >
                                                {showPasswords[u.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td style={{ padding: 12 }}>
                                        <span style={{ 
                                            fontSize: 11, 
                                            background: u.role === 'superuser' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(56, 189, 248, 0.1)', 
                                            color: u.role === 'superuser' ? '#a855f7' : '#0ea5e9',
                                            padding: '4px 10px', 
                                            borderRadius: 8,
                                            fontWeight: 800,
                                            textTransform: 'uppercase'
                                        }}>
                                            {u.role === 'superuser' ? 'Owner' : 'Kasir'}
                                        </span>
                                    </td>
                                    <td style={{ padding: 12, borderRadius: '0 12px 12px 0' }}>
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                            <button 
                                                onClick={() => handleEdit(u)}
                                                style={{ 
                                                    background: 'rgba(59, 130, 246, 0.1)', 
                                                    color: '#3b82f6', 
                                                    border: 'none', 
                                                    padding: 8, 
                                                    borderRadius: 8,
                                                    cursor: 'pointer'
                                                }}
                                                title="Edit User"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            {u.username !== 'owner' && (
                                                <button 
                                                    onClick={() => handleDelete(u.id)}
                                                    style={{ 
                                                        background: 'rgba(239, 68, 68, 0.1)', 
                                                        color: 'var(--error)', 
                                                        border: 'none', 
                                                        padding: 8, 
                                                        borderRadius: 8,
                                                        cursor: 'pointer'
                                                    }}
                                                    title="Hapus User"
                                                >
                                                    <Trash size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const DataManagementView = ({ onBack }) => {
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        setLoading(true);
        try {
            const products = await dbService.getProducts();
            const suppliers = await dbService.getSuppliers();
            const brands = await dbService.getBrands();

            const exportData = products.map(p => ({
                'Name': p.name,
                'Description': '',
                'Price': p.price,
                'Buy Price': p.buyPrice,
                'Stock': p.stock,
                'Brand': brands.find(b => b.id == p.brandId)?.name || '',
                'Supplier': suppliers.find(s => s.id == p.supplierId)?.name || ''
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Products");
            const fileName = `Data_Barang_${new Date().toISOString().split('T')[0]}.xlsx`;
            const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
            saveAndShareFile(fileName, base64Data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        } catch (error) {
            AlertService.error('Export gagal', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!await AlertService.confirm('Konfirmasi Import', 'Import data akan menambahkan barang baru dan mengupdate barang yang ada (berdasarkan Nama). Lanjutkan?')) return;

        setLoading(true);
        try {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(ws);

            let added = 0;
            let updated = 0;

            let suppliers = await dbService.getSuppliers();
            let brands = await dbService.getBrands();
            let products = await dbService.getProducts();

            for (const item of jsonData) {
                const name = item['Name'] || item['name'] || item['Nama Barang'];
                if (!name) continue;

                let brandId = null;
                const brandName = item['Brand'] || item['brand'] || item['Merek'];
                if (brandName) {
                    const foundB = brands.find(b => b.name.toLowerCase() === brandName.toLowerCase());
                    if (foundB) brandId = foundB.id;
                    else {
                        const newB = await dbService.addBrand(brandName);
                        brands.push(newB);
                        brandId = newB.id;
                    }
                }

                let supplierId = null;
                const suppName = item['Supplier'] || item['supplier'] || item['Suplier'];
                if (suppName) {
                    const foundS = suppliers.find(s => s.name.toLowerCase() === suppName.toLowerCase());
                    if (foundS) supplierId = foundS.id;
                    else {
                        const newS = await dbService.addSupplier(suppName, '', '');
                        suppliers.push(newS);
                        supplierId = newS.id;
                    }
                }

                const price = parseFloat(item['Price'] || item['price'] || item['Harga Jual'] || 0);
                const buyPrice = parseFloat(item['Buy Price'] || item['buyPrice'] || item['Harga Beli'] || 0);
                const stock = parseInt(item['Stock'] || item['stock'] || item['Stok'] || 0);

                const existingProduct = products.find(p => p.name.toLowerCase() === name.toLowerCase());

                if (existingProduct) {
                    await dbService.updateProduct(existingProduct.id, {
                        name,
                        price: price || existingProduct.price,
                        buyPrice: buyPrice || existingProduct.buyPrice,
                        stock: stock,
                        brandId: brandId || existingProduct.brandId,
                        supplierId: supplierId || existingProduct.supplierId
                    });
                    updated++;
                } else {
                    await dbService.addProduct({
                        name,
                        price,
                        buyPrice,
                        stock,
                        brandId,
                        supplierId
                    });
                    added++;
                }
            }

            await AlertService.success('Import Selesai', `Ditambahkan: ${added}\nDiupdate: ${updated}`);
            window.location.reload();
        } catch (err) {
            AlertService.error('Gagal Import', err.message);
        } finally {
            setLoading(false);
            e.target.value = null;
        }
    };

    return (
        <div className="page-container">
            <div className="flex items-center mb-6" onClick={onBack} style={{ cursor: 'pointer', gap: 12 }}>
                <ArrowLeft size={24} />
                <h2 style={{ margin: 0 }}>Manajemen Data</h2>
            </div>

            <div className="card" style={{ padding: '24px', marginBottom: 24 }}>
                <h3 className="mb-2" style={{ fontSize: 16 }}>Export & Import (Excel)</h3>
                <p className="text-muted mb-6" style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Fasilitas untuk export dan import data barang ke dalam format Excel (.xlsx).
                    Pastikan format kolom sesuai: <b>Name, Price, Buy Price, Stock, Brand, Supplier</b>.
                </p>

                <h4 className="mb-3" style={{ fontSize: 14 }}>Export Data Barang</h4>
                <button 
                    className="btn mb-6" 
                    onClick={handleExport} 
                    disabled={loading}
                    style={{ width: '100%', boxSizing: 'border-box', display: 'flex', justifyContent: 'center', gap: 8, padding: '12px' }}
                >
                    {loading ? <Loader className="spin" size={20} /> : <FileDown size={20} />}
                    Download Data Barang (.xlsx)
                </button>

                <div style={{ borderTop: '1px solid var(--border-color)', margin: '24px 0' }}></div>

                <h4 className="mb-3" style={{ fontSize: 14 }}>Import Data Barang</h4>
                <div>
                    <label className={`btn btn-outline ${loading ? 'disabled' : ''}`} style={{ width: '100%', boxSizing: 'border-box', display: 'block', cursor: loading ? 'not-allowed' : 'pointer', textAlign: 'center', borderStyle: 'dashed', padding: '32px 16px', borderRadius: 12 }}>
                        <div className="flex flex-col items-center gap-3">
                            {loading ? <Loader className="spin" size={32} /> : <FileUp size={32} color="var(--primary)" />}
                            <div style={{ fontSize: 16, fontWeight: 600 }}>Upload File Excel</div>
                            <div className="text-muted" style={{ fontSize: 13 }}>Klik area ini untuk memilih file .xlsx</div>
                        </div>
                        <input type="file" accept=".xlsx, .xls" onChange={handleImport} hidden disabled={loading} />
                    </label>
                </div>
            </div>

            {/* FULL BACKUP RESTORE SECTION */}
            <div className="card" style={{ padding: '24px', border: '1px solid var(--error)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Database size={20} color="var(--error)" />
                    <h3 style={{ margin: 0, fontSize: 16, color: 'var(--error)' }}>Backup & Restore Full</h3>
                </div>
                <p className="text-muted mb-6" style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Simpan seluruh data aplikasi (Transaksi, Barang, User, Laporan) ke dalam satu file JSON. Sangat penting dilakukan secara berkala agar aman jika browser/perangkat dibersihkan.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <button 
                        className="btn btn-outline" 
                        onClick={async () => {
                            try {
                                const data = await dbService.exportFullDatabase();
                                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    const base64Data = reader.result.split(',')[1];
                                    const fileName = `BACKUP_KASIR_${new Date().toISOString().split('T')[0]}.json`;
                                    saveAndShareFile(fileName, base64Data, 'application/json');
                                };
                                reader.readAsDataURL(blob);
                            } catch (err) {
                                AlertService.error('Gagal Backup', err.message);
                            }
                        }}
                        style={{ width: '100%', boxSizing: 'border-box', display: 'flex', justifyContent: 'center', gap: 8, padding: '14px', border: '2px solid var(--primary)' }}
                    >
                        <FileDown size={20} /> Backup Data (JSON)
                    </button>

                    <label className="btn" style={{ width: '100%', boxSizing: 'border-box', display: 'block', background: 'var(--error)', color: 'white', cursor: 'pointer', textAlign: 'center', padding: '14px', borderRadius: 8 }}>
                        <div className="flex items-center justify-center gap-8">
                            <FileUp size={20} />
                            <span style={{ fontWeight: 600 }}>Restore Data (JSON)</span>
                        </div>
                        <input type="file" accept=".json" hidden onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (!await AlertService.confirm('PERINGATAN BAHAYA', 'Restore akan menghapus dan menimpa SELURUH data saat ini dengan data dari file! Pastikan file JSON yang dipilih sudah benar. Lanjutkan?')) return;

                            const reader = new FileReader();
                            reader.onload = async (event) => {
                                try {
                                    const data = JSON.parse(event.target.result);
                                    await dbService.importFullDatabase(data);
                                    await AlertService.success('Restore Berhasil', 'Aplikasi akan dimuat ulang.');
                                    window.location.reload();
                                } catch (err) {
                                    AlertService.error('Gagal Restore', err.message);
                                }
                            };
                            reader.readAsText(file);
                        }} />
                    </label>
                </div>
            </div>
        </div>
    );
};

const CashRegisterView = ({ onBack }) => {
    const { user } = useAuth();
    const [shift, setShift] = useState(null);
    const [stats, setStats] = useState({ expected: 0, cashIncome: 0 }); // Added stats state
    const [actualCash, setActualCash] = useState('');
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadShift();
    }, []);

    const loadShift = async () => {
        const s = await dbService.getOpenShift();
        setShift(s);
        if (s) {
            const st = await dbService.getShiftStats(s.id);
            setStats(st);
        }
    };

    const handleEndShift = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = await dbService.endShift(shift.id, parseFloat(actualCash) || 0);
            setSummary(result);
            AlertService.success('Berhasil', 'Shift Berhasil Ditutup!');
        } catch (err) {
            AlertService.error('Gagal menutup shift', err.message);
        } finally {
            setLoading(false);
        }
    };

    // Calculate real-time difference
    const currentActual = parseFloat(actualCash) || 0;
    const difference = currentActual - stats.expected;

    if (!shift && !summary) {
        return (
            <div>
                <div className="flex items-center mb-6" onClick={onBack} style={{ cursor: 'pointer', gap: 8 }}>
                    <ArrowLeft size={20} />
                    <h2>Tutup Kasir</h2>
                </div>
                <div className="card">
                    <p>Tidak ada sesi kasir yang aktif saat ini.</p>
                </div>
            </div>
        );
    }

    if (summary) {
        return (
            <div>
                <div className="flex items-center mb-6" onClick={onBack} style={{ cursor: 'pointer', gap: 8 }}>
                    <ArrowLeft size={20} />
                    <h2>Laporan Penutupan</h2>
                </div>
                <div className="card">
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <CheckCircle size={48} color="var(--success)" style={{ marginBottom: 16 }} />
                        <h2>Toko Ditutup</h2>
                        <p className="text-muted">{new Date().toLocaleString()}</p>
                    </div>

                    <div className="grid-2" style={{ gap: 16, marginBottom: 24 }}>
                        <div className="card bg-dark">
                            <span className="text-muted">Modal Awal</span>
                            <h3>Rp {(shift.initialCash || 0).toLocaleString()}</h3>
                        </div>
                        <div className="card bg-dark">
                            <span className="text-muted">Pendapatan Tunai</span>
                            <h3>Rp {(summary.cashIncome || 0).toLocaleString()}</h3>
                        </div>
                        <div className="card bg-dark">
                            <span className="text-muted">Total Diharapkan</span>
                            <h3>Rp {summary.expected.toLocaleString()}</h3>
                        </div>
                        <div className="card bg-dark">
                            <span className="text-muted">Uang Fisik (Laci)</span>
                            <h3>Rp {summary.actualCash.toLocaleString()}</h3>
                        </div>
                    </div>

                    <div className={`card ${summary.difference < 0 ? 'border-danger' : 'border-success'}`} style={{ textAlign: 'center' }}>
                        <span className="text-muted">Selisih</span>
                        <h2 style={{ color: summary.difference < 0 ? 'var(--danger)' : 'var(--success)' }}>
                            {summary.difference < 0 ? '-' : '+'} Rp {Math.abs(summary.difference).toLocaleString()}
                        </h2>
                        <p style={{ fontSize: 13 }} className="text-muted">
                            {summary.difference === 0 ? "Sempurna! Tidak ada selisih." : (summary.difference < 0 ? "Uang kurang dari sistem." : "Uang lebih dari sistem.")}
                        </p>
                    </div>

                    <button className="btn mt-6" onClick={() => window.location.reload()}>Selesai</button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center mb-6" onClick={onBack} style={{ cursor: 'pointer', gap: 8 }}>
                <ArrowLeft size={20} />
                <h2>Tutup Kasir</h2>
            </div>

            <div className="card">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-muted">Waktu Buka</span>
                    <span>{new Date(shift.startTime).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center mb-6">
                    <span className="text-muted">Modal Awal</span>
                    <span>Rp {shift.initialCash.toLocaleString()}</span>
                </div>

                <div className="alert bg-warning text-dark mb-6">
                    <LogOut size={20} style={{ marginRight: 8 }} />
                    <b>Konfirmasi Penutupan</b>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                        Pastikan Anda telah menghitung seluruh uang tunai yang ada di laci kasir sebelum melanjutkan.
                    </div>
                </div>

                <form onSubmit={handleEndShift}>
                    <div className="input-group">
                        <label>Total Uang Tunai di Laci (Rp)</label>
                        <input
                            type="number"
                            value={actualCash}
                            onChange={e => setActualCash(e.target.value)}
                            placeholder="Hitung uang fisik..."
                            required
                            style={{ fontSize: 18, fontWeight: 'bold' }}
                        />
                    </div>

                    {/* Realtime Difference Display */}
                    <div style={{ marginBottom: 20, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-muted">Sistem Mencatat (Exp)</span>
                            <span>Rp {stats.expected.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted">Selisih Realtime</span>
                            <span style={{
                                fontWeight: 'bold',
                                color: difference < 0 ? 'var(--danger)' : (difference > 0 ? 'var(--success)' : 'inherit')
                            }}>
                                {difference < 0 ? '-' : (difference > 0 ? '+' : '')} Rp {Math.abs(difference).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <button className="btn btn-danger" type="submit" disabled={loading}>
                        {loading ? <Loader className="spin" size={20} /> : <Lock size={20} />}
                        {loading ? 'Memproses...' : 'Tutup Toko & Buat Laporan'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const ReceiptView = ({ onBack }) => {
    const [settings, setSettings] = useState({
        storeName: localStorage.getItem('store_name') || 'Swift Kasir',
        storeAddress: localStorage.getItem('store_address') || '',
        storeLogo: localStorage.getItem('store_logo') || ''
    });

    const handleSave = async (e) => {
        e.preventDefault();
        localStorage.setItem('store_name', settings.storeName);
        localStorage.setItem('store_address', settings.storeAddress);
        if (settings.storeLogo) {
            localStorage.setItem('store_logo', settings.storeLogo);
        } else {
            localStorage.removeItem('store_logo');
        }
        
        await AlertService.success('Berhasil', 'Pengaturan struk disimpan.');
        onBack();
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 250;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                // Draw white background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to B&W (threshold)
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    const bw = gray > 128 ? 255 : 0;
                    data[i] = bw;
                    data[i + 1] = bw;
                    data[i + 2] = bw;
                    data[i + 3] = 255;
                }
                ctx.putImageData(imageData, 0, 0);

                const bwDataUrl = canvas.toDataURL('image/png');
                setSettings({ ...settings, storeLogo: bwDataUrl });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="flex items-center gap-2 mb-6">
                <button className="btn-icon" onClick={onBack} style={{ background: 'transparent', border: '1px solid var(--border-color)' }}>
                    <ArrowLeft size={20} />
                </button>
                <h1 style={{ margin: 0 }}>Pengaturan Struk</h1>
            </div>

            <div className="card">
                <form onSubmit={handleSave}>
                    <div className="input-group">
                        <label>Nama Toko</label>
                        <input 
                            type="text" 
                            value={settings.storeName} 
                            onChange={e => setSettings({...settings, storeName: e.target.value})}
                            placeholder="Contoh: Toko Berkah"
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>Alamat Toko</label>
                        <input 
                            type="text" 
                            value={settings.storeAddress} 
                            onChange={e => setSettings({...settings, storeAddress: e.target.value})}
                            placeholder="Jl. Raya No. 123..."
                        />
                    </div>
                    <div className="input-group">
                        <label>Logo Struk (JPG/PNG)</label>
                        <input 
                            type="file" 
                            accept="image/jpeg, image/png"
                            onChange={handleLogoUpload}
                            style={{ padding: '8px' }}
                        />
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                            Logo akan otomatis diubah menjadi hitam putih dan disesuaikan ukurannya untuk printer kasir.
                        </div>
                        {settings.storeLogo && (
                            <div style={{ marginTop: 12, display: 'inline-block', position: 'relative', background: '#fff', padding: 8, borderRadius: 8, border: '1px dashed #ccc' }}>
                                <img src={settings.storeLogo} alt="Logo" style={{ maxWidth: '100%', maxHeight: 100, display: 'block' }} />
                                <button type="button" onClick={() => setSettings({...settings, storeLogo: ''})} style={{
                                    position: 'absolute', top: -8, right: -8, background: 'var(--error)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}><X size={14}/></button>
                            </div>
                        )}
                    </div>
                    
                    <button type="submit" className="btn btn-primary" style={{ marginTop: 20 }}>
                        <Database size={18} /> Simpan Pengaturan
                    </button>
                </form>
            </div>

            <div className="card mt-4" style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px dashed #22c55e' }}>
                <h3 style={{ margin: 0, fontSize: 14, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={16} /> Tips Struk
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    Pengaturan ini akan muncul secara otomatis di bagian atas dan bawah struk saat dicetak menggunakan printer Bluetooth.
                </p>
            </div>
        </div>
    );
};

const QrisView = ({ onBack }) => {
    const [settings, setSettings] = useState({
        merchantName: localStorage.getItem('qris_merchant_name') || '',
        notes: localStorage.getItem('qris_notes') || 'Scan QRIS untuk melakukan pembayaran',
        qrisImage: localStorage.getItem('qris_image') || ''
    });
    const [loading, setLoading] = useState(false);

    const handleSave = async (e) => {
        e.preventDefault();
        localStorage.setItem('qris_merchant_name', settings.merchantName);
        localStorage.setItem('qris_notes', settings.notes);
        if (settings.qrisImage) {
            localStorage.setItem('qris_image', settings.qrisImage);
        } else {
            localStorage.removeItem('qris_image');
        }
        
        await AlertService.success('Berhasil', 'Pengaturan QRIS berhasil disimpan.');
        onBack();
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400; // QR codes scan perfectly at 400px width and are very compact
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

                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85); // Compress as JPEG
                setSettings({ ...settings, qrisImage: compressedDataUrl });
                setLoading(false);
            };
            img.onerror = () => {
                AlertService.error('Error', 'Gagal memproses gambar.');
                setLoading(false);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="flex items-center gap-2 mb-6">
                <button className="btn-icon" onClick={onBack} style={{ background: 'transparent', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, cursor: 'pointer', borderRadius: 8, color: 'var(--text-main)' }}>
                    <ArrowLeft size={20} />
                </button>
                <h2 style={{ margin: 0 }}>Pengaturan QRIS</h2>
            </div>

            <div className="card">
                <form onSubmit={handleSave}>
                    <div className="input-group">
                        <label>Nama Merchant QRIS</label>
                        <input 
                            type="text" 
                            value={settings.merchantName} 
                            onChange={e => setSettings({...settings, merchantName: e.target.value})}
                            placeholder="Contoh: TOKO REZEKI QRIS"
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>Catatan Pembayaran QRIS</label>
                        <input 
                            type="text" 
                            value={settings.notes} 
                            onChange={e => setSettings({...settings, notes: e.target.value})}
                            placeholder="Contoh: Scan QRIS untuk melakukan pembayaran"
                        />
                    </div>
                    <div className="input-group">
                        <label>Upload QR Code / Barcode QRIS (JPG/PNG)</label>
                        <input 
                            type="file" 
                            accept="image/jpeg, image/png"
                            onChange={handleImageUpload}
                            style={{ padding: '8px' }}
                        />
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                            Unggah gambar barcode QRIS statis atau dinamis toko Anda di sini.
                        </div>
                        {settings.qrisImage && (
                            <div style={{ marginTop: 12, display: 'inline-block', position: 'relative', background: '#fff', padding: 8, borderRadius: 8, border: '1px dashed #ccc' }}>
                                <img src={settings.qrisImage} alt="QRIS QR Code" style={{ maxWidth: '100%', maxHeight: 200, display: 'block' }} />
                                <button type="button" onClick={() => setSettings({...settings, qrisImage: ''})} style={{
                                    position: 'absolute', top: -8, right: -8, background: 'var(--error)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}><Trash size={14}/></button>
                            </div>
                        )}
                    </div>
                    
                    <button type="submit" className="btn btn-primary" style={{ marginTop: 20 }} disabled={loading}>
                        {loading ? <Loader className="spin" size={18} /> : <Database size={18} />} Simpan Pengaturan QRIS
                    </button>
                </form>
            </div>

            <div className="card mt-4" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px dashed #6366f1' }}>
                <h3 style={{ margin: 0, fontSize: 14, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={16} /> Cara Kerja Fitur QRIS
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
                    Ketika kasir memilih metode pembayaran <b>QRIS</b> dan menekan tombol <b>Bayar Sekarang</b>, gambar barcode QRIS yang di-upload di sini akan ditampilkan secara langsung di layar kasir/pelanggan bersama total nominal belanja.
                </p>
            </div>
        </div>
    );
};

export default SettingsPage;
