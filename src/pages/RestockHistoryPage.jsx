import React, { useEffect, useState } from 'react';
import { dbService } from '../services/DatabaseService';
import { Search, X, Calendar, Package, ArrowUpCircle, Clock } from 'lucide-react';

const RestockHistoryPage = () => {
    const [purchases, setPurchases] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const purch = await dbService.getPurchases();
        setPurchases(purch);
    };

    const filteredPurchases = purchases.filter(p => 
        (p.items && p.items.some(item => (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()))) ||
        new Date(p.date).toLocaleDateString('id-ID').includes(searchTerm)
    );

    return (
        <div className="page-container">
            <h1 style={{ marginBottom: 20 }}>Riwayat Restok</h1>
            
            {/* ── HEADER BAR ─────────────────────────── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', background: 'var(--card-bg)', padding: '12px 16px', borderRadius: 16, boxShadow: 'var(--shadow)', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}>
                <div className="modern-input-group" style={{ width: '300px', border: '1px solid var(--border-color)', borderRadius: 12, flexShrink: 1 }}>
                    <Search size={18} style={{ color: 'var(--text-muted)', marginLeft: 12 }} />
                    <input
                        placeholder="Cari riwayat (Nama barang atau tanggal)..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ fontSize: 14, padding: '10px 12px', border: 'none', background: 'transparent', width: '100%', color: 'var(--text-main)' }}
                    />
                    {searchTerm && (
                        <X size={16} onClick={() => setSearchTerm('')}
                            style={{ cursor: 'pointer', color: 'var(--text-muted)', marginRight: 12 }} />
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8, color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, alignItems: 'center' }}>
                    <ArrowUpCircle size={20} className="text-primary" />
                    <span>Total: {purchases.length} Riwayat</span>
                </div>
            </div>

            <div className="product-list" style={{ animation: 'fadeIn 0.4s ease-out' }}>
                {filteredPurchases.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', background: 'var(--card-bg)' }}>
                        <Package size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                        <div>Belum ada riwayat restok yang ditemukan</div>
                    </div>
                ) : (
                    filteredPurchases.map(p => (
                        <div key={p.id} className="card product-list-card" style={{ marginBottom: 16, padding: '20px', border: '1px solid var(--border-color)', borderRadius: 16, background: 'var(--card-bg)', transition: 'transform 0.2s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                    <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-color)' }}>
                                        <Calendar size={32} style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>
                                            {new Date(p.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Clock size={14} /> {new Date(p.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                                        </div>
                                        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {p.items.map((i, idx) => (
                                                <span key={idx} style={{ background: 'var(--bg-color)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid var(--border-color)' }}>
                                                    {i.name} <span style={{ color: 'var(--primary)' }}>x{i.qty}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>Total Pembelian</div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--success)' }}>
                                        Rp {p.total.toLocaleString('id-ID')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default RestockHistoryPage;
