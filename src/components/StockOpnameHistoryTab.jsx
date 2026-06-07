import React, { useState, useEffect } from 'react';
import { dbService } from '../services/DatabaseService';
import { Calendar, Package, User, FileText, ArrowUp, ArrowDown, Minus } from 'lucide-react';

const StockOpnameHistoryTab = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const data = await dbService.getStockOpnameHistory();
            setHistory(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 40 }}>Memuat riwayat...</div>;
    }

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.02)' }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>📜 Riwayat Audit Stok (SO)</h3>
                </div>

                <div className="table-container" style={{ border: 'none' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-color)', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase' }}>
                                <th style={{ padding: '12px 20px', textAlign: 'left' }}>Tanggal & Produk</th>
                                <th style={{ padding: '12px 20px', textAlign: 'center' }}>Sistem</th>
                                <th style={{ padding: '12px 20px', textAlign: 'center' }}>Fisik</th>
                                <th style={{ padding: '12px 20px', textAlign: 'center' }}>Selisih</th>
                                <th style={{ padding: '12px 20px', textAlign: 'left' }}>Catatan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada riwayat stock opname.</td>
                                </tr>
                            ) : (
                                history.map(item => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ background: 'var(--bg-color)', padding: 8, borderRadius: 10 }}>
                                                    <Calendar size={18} color="var(--primary)" />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: 14 }}>{item.productName}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                        {new Date(item.date).toLocaleString('id-ID')}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600 }}>{item.systemStock}</td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 800, color: 'var(--primary)' }}>{item.actualStock}</td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                            <div style={{ 
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800,
                                                background: item.difference === 0 ? 'rgba(34, 197, 94, 0.1)' : (item.difference > 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
                                                color: item.difference === 0 ? '#16a34a' : (item.difference > 0 ? '#2563eb' : '#dc2626')
                                            }}>
                                                {item.difference > 0 ? <ArrowUp size={12} /> : (item.difference < 0 ? <ArrowDown size={12} /> : <Minus size={12} />)}
                                                {Math.abs(item.difference)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px', fontSize: 12, color: 'var(--text-muted)', maxWidth: 200 }}>
                                            {item.notes || '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StockOpnameHistoryTab;
