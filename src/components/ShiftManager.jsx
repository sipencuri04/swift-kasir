import React, { useEffect, useState } from 'react';
import { dbService } from '../services/DatabaseService';
import { useAuth } from './AuthContext';
import { Lock, DollarSign, Loader, ShoppingCart } from 'lucide-react';
import { AlertService } from '../utils/AlertService';

const ShiftManager = ({ children }) => {
    const { user } = useAuth();
    const [hasOpenShift, setHasOpenShift] = useState(null); // null = loading
    const [loading, setLoading] = useState(false);
    const [initialCash, setInitialCash] = useState('');

    useEffect(() => {
        if (user) {
            checkShift();
        }
    }, [user]);

    const checkShift = async () => {
        const shift = await dbService.getOpenShift();
        setHasOpenShift(!!shift);
    };

    const handleStartShift = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await dbService.startShift(user.id, initialCash || 0);
            setHasOpenShift(true);
            AlertService.success('Berhasil', 'Toko berhasil dibuka! Selamat bekerja.');
        } catch (err) {
            AlertService.error('Gagal membuka toko', err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!user) return children;

    // Superuser bypass shift logic
    if (user.role === 'superuser') return children;

    if (hasOpenShift === null) return null; // Loading state

    if (!hasOpenShift) {
        return (
            <div className="modal-overlay" style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'fadeIn 0.3s ease-out'
            }}>
                <div className="card" style={{ 
                    width: '90%', 
                    maxWidth: '420px', 
                    textAlign: 'center', 
                    padding: '40px 32px', 
                    borderRadius: 24, 
                    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)'
                }}>
                    <div style={{ 
                        background: 'rgba(16, 185, 129, 0.1)', 
                        width: 80, 
                        height: 80, 
                        borderRadius: '24px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        margin: '0 auto 24px',
                        border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}>
                        <Lock size={40} color="#10b981" />
                    </div>
                    <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: 'var(--text-main)' }}>Buka Toko</h2>
                    <p className="text-muted" style={{ marginBottom: 32, fontSize: 14 }}>
                        Masukkan modal awal (uang kas) untuk memulai sesi transaksi hari ini.
                    </p>

                    <form onSubmit={handleStartShift}>
                        <div className="input-group" style={{ marginBottom: 24 }}>
                            <label style={{ textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>Modal Awal (Rp)</label>
                            <div className="modern-input-group" style={{ padding: '4px 8px', border: '2px solid var(--border-color)', borderRadius: 16 }}>
                                <DollarSign size={20} color="var(--primary)" style={{ marginLeft: 8 }} />
                                <input
                                    type="number"
                                    value={initialCash}
                                    onChange={e => setInitialCash(e.target.value)}
                                    placeholder="0"
                                    required
                                    autoFocus
                                    style={{ 
                                        fontSize: 20, 
                                        fontWeight: '800', 
                                        padding: '12px',
                                        background: 'transparent',
                                        border: 'none',
                                        width: '100%',
                                        color: 'var(--text-main)'
                                    }}
                                />
                            </div>
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={loading} style={{ 
                            height: 56, 
                            fontSize: 16, 
                            fontWeight: 700, 
                            borderRadius: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 12
                        }}>
                            {loading ? <Loader className="spin" size={24} /> : <ShoppingCart size={24} />}
                            {loading ? 'Membuka...' : 'Mulai Sesi Kasir'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return children;
};

export default ShiftManager;
