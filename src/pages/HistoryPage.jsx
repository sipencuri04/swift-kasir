import React, { useEffect, useState } from 'react';
import { dbService } from '../services/DatabaseService';
import { Download, Calendar, ArrowUpRight, TrendingUp, ShoppingBag, Plus, ChevronRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { saveAndShareFile } from '../utils/exportHelper';
import { AlertService } from '../utils/AlertService';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';

const HistoryPage = () => {
    const navigate = useNavigate();
    const { isSuperuser } = useAuth();
    const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'purchases'
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [showPreview, setShowPreview] = useState(false);

    // Data
    const [transactions, setTransactions] = useState([]);
    const [returns, setReturns] = useState([]);

    // Stats
    const [stats, setStats] = useState({ total: 0, profit: 0, count: 0 });
    const [returnStats, setReturnStats] = useState({ total: 0, count: 0 });

    // Filter States
    const [filterType, setFilterType] = useState('daily'); // daily, monthly, yearly
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

    useEffect(() => {
        let dateParam = selectedDate;
        if (filterType === 'monthly') dateParam = selectedMonth;
        if (filterType === 'yearly') dateParam = selectedYear;

        loadData(dateParam);
    }, [filterType, selectedDate, selectedMonth, selectedYear, activeTab]);

    const loadData = async (dateParam) => {
        try {
            if (activeTab === 'sales') {
                const trans = await dbService.getTransactions(dateParam);
                setTransactions(trans);
                const daily = await dbService.getDailyStats(dateParam);
                setStats(daily);
            } else if (activeTab === 'returns' && isSuperuser) {
                const rets = await dbService.getReturns();
                const filteredReturns = rets.filter(p => p.date.startsWith(dateParam));
                setReturns(filteredReturns);
                const totalRet = filteredReturns.reduce((acc, p) => acc + p.total, 0);
                setReturnStats({ total: totalRet, count: filteredReturns.length });
            }
        } catch (error) {
            console.error("Failed to load history data:", error);
        }
    };

    const handleExport = () => {
        const isSales = activeTab === 'sales';
        if (!isSales && !isSuperuser) return; // Guard

        const data = isSales ? transactions : returns;
        const filename = isSales ? `laporan_penjualan` : `laporan_retur_penjualan`;

        const formatCurrency = (val) => `"${'Rp ' + (val || 0).toLocaleString('id-ID')}"`;

        const headers = isSales
            ? ["Tanggal", "Waktu", "Items", "Total", "Profit"]
            : ["Tanggal", "Waktu", "Items", "Total Nominal Retur"];

        const rows = data.map(t => {
            const dateObj = new Date(t.date);
            const itemsStr = t.items.map(i => `${i.name} (${i.qty})`).join('; ');
            const safeItemsStr = itemsStr.replace(/"/g, '""');

            if (isSales) {
                return [
                    dateObj.toLocaleDateString('id-ID'),
                    dateObj.toLocaleTimeString('id-ID'),
                    `"${safeItemsStr}"`,
                    formatCurrency(t.total),
                    formatCurrency(t.profit)
                ].join(",");
            } else {
                return [
                    dateObj.toLocaleDateString('id-ID'),
                    dateObj.toLocaleTimeString('id-ID'),
                    `"${safeItemsStr}"`,
                    formatCurrency(t.total)
                ].join(",");
            }
        });

        const rawCsv = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([rawCsv], { type: 'text/csv;charset=utf-8;' });
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Data = reader.result.split(',')[1];
            saveAndShareFile(`${filename}_${filterType}_${new Date().getTime()}.csv`, base64Data, 'text/csv');
        };
        reader.readAsDataURL(blob);
    };

    const handleRetur = async (transaction) => {
        if (!await AlertService.confirm('Konfirmasi Retur', `Apakah Anda yakin ingin MERETUR transaksi penjualan ini? Stok barang akan dikembalikan ke sistem dan transaksi akan dihapus.`)) return;

        try {
            await dbService.returnTransaction(transaction);
            AlertService.success('Berhasil', 'Retur berhasil! Stok barang telah dikembalikan.');
            setSelectedTransaction(null);
            
            // Reload data
            let dateParam = selectedDate;
            if (filterType === 'monthly') dateParam = selectedMonth;
            if (filterType === 'yearly') dateParam = selectedYear;
            loadData(dateParam);
        } catch (error) {
            console.error('Gagal retur:', error);
            AlertService.error('Error', 'Terjadi kesalahan saat retur');
        }
    };

    return (
        <div className="page-container">
            <div className="flex justify-between items-center" style={{ marginBottom: 24 }}>
                <h1>Laporan</h1>
                <button className="btn btn-success" style={{ width: 'auto' }} onClick={handleExport}>
                    <Download size={18} /> Export Excel
                </button>
            </div>

            {/* Tabs */}
            <div className="nav-tabs">
                <button
                    className={`nav-tab ${activeTab === 'sales' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sales')}
                >
                    <TrendingUp size={16} /> Penjualan
                </button>
                {isSuperuser && (
                    <button
                        className={`nav-tab ${activeTab === 'returns' ? 'active' : ''}`}
                        onClick={() => setActiveTab('returns')}
                    >
                        <ShoppingBag size={16} /> History Retur
                    </button>
                )}
            </div>

            {/* Filter Controls */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="grid-2" style={{ alignItems: 'end' }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label>Tipe Laporan</label>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="daily">Harian</option>
                            <option value="monthly">Bulanan</option>
                            <option value="yearly">Tahunan</option>
                        </select>
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label>Pilih Periode</label>
                        {filterType === 'daily' && (
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                            />
                        )}
                        {filterType === 'monthly' && (
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(e.target.value)}
                            />
                        )}
                        {filterType === 'yearly' && (
                            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                                {[0, 1, 2, 3, 4].map(i => {
                                    const y = new Date().getFullYear() - i;
                                    return <option key={y} value={y}>{y}</option>
                                })}
                            </select>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'sales' ? (
                <>
                    {/* Sales Summary */}
                    <div className="grid-2" style={{ marginBottom: 20 }}>
                        <div className="card" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ opacity: 0.9, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <TrendingUp size={16} /> Total Omset
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 'bold' }}>Rp {stats.total.toLocaleString('id-ID')}</div>
                        </div>
                        <div className="card" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ opacity: 0.9, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ArrowUpRight size={16} /> Total Profit
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 'bold' }}>Rp {stats.profit.toLocaleString('id-ID')}</div>
                        </div>
                    </div>

                    {/* Sales Table */}
                    <div className="table-container">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                            <thead>
                                <tr className="table-header-row">
                                    <th style={{ padding: 16 }}>Tanggal & Jam</th>
                                    <th style={{ padding: 16 }}>Items</th>
                                    <th style={{ padding: 16, textAlign: 'right' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                            Belum ada transaksi pada periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map(t => {
                                        const totalQty = t.items.reduce((acc, i) => acc + (i.qty || 1), 0);
                                        return (
                                            <tr key={t.id} className="table-row" onClick={() => setSelectedTransaction(t)} style={{ cursor: 'pointer' }}>
                                                <td style={{ padding: 16 }}>
                                                    <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{new Date(t.date).toLocaleDateString('id-ID')}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                                        {new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                                <td style={{ padding: 16 }}>
                                                    <div className="flex items-center gap-2" style={{ color: 'var(--primary)' }}>
                                                        <span>{totalQty} Items</span>
                                                        <ChevronRight size={14} />
                                                    </div>
                                                </td>
                                                <td style={{ padding: 16, textAlign: 'right', fontWeight: 'bold', color: 'var(--text-main)' }}>
                                                    Rp {t.total.toLocaleString('id-ID')}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <>
                    {/* Purchase Header with Action */}
                    <div style={{ marginBottom: 20 }}>
                        <div className="text-muted">Data ini menampilkan riwayat pengembalian barang dari pelanggan.</div>
                    </div>

                    {/* Purchase Summary */}
                    <div className="grid-2" style={{ marginBottom: 20 }}>
                        <div className="card" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ opacity: 0.9, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ShoppingBag size={16} /> Total Nominal Retur
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 'bold' }}>Rp {returnStats.total.toLocaleString('id-ID')}</div>
                        </div>
                    </div>

                    {/* Purchase Table */}
                    <div className="table-container">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                            <thead>
                                <tr className="table-header-row">
                                    <th style={{ padding: 16 }}>Tanggal & Jam</th>
                                    <th style={{ padding: 16 }}>Items Retur</th>
                                    <th style={{ padding: 16, textAlign: 'right' }}>Total Pengembalian Dana</th>
                                </tr>
                            </thead>
                            <tbody>
                                {returns.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                            Belum ada data retur pada periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    returns.map(p => (
                                        <tr key={p.id} className="table-row">
                                            <td style={{ padding: 16 }}>
                                                <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{new Date(p.date).toLocaleDateString('id-ID')}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                                    {new Date(p.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td style={{ padding: 16 }}>
                                                {p.items.map((i, idx) => (
                                                    <div key={idx} style={{ marginBottom: 4, color: 'var(--text-main)' }}>
                                                        <span>{i.name}</span>
                                                        <span style={{ opacity: 0.7, marginLeft: 8 }}>x{i.qty}</span>
                                                        <span style={{ opacity: 0.7, marginLeft: 8, fontSize: 11 }}>@ Rp {i.price}</span>
                                                    </div>
                                                ))}
                                            </td>
                                            <td style={{ padding: 16, textAlign: 'right', fontWeight: 'bold', color: '#ef4444' }}>
                                                Rp {p.total.toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Transaction Detail Modal */}
            {selectedTransaction && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
                    backdropFilter: 'blur(3px)'
                }} onClick={() => setSelectedTransaction(null)}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0 }}>Detail Transaksi</h3>
                            <button className="btn-icon" onClick={() => setSelectedTransaction(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}>
                                <X size={24} color="var(--text-main)" />
                            </button>
                        </div>

                        <div style={{ marginBottom: 12, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>Waktu Transaksi</div>
                            <div style={{ fontWeight: 500, fontSize: 15 }}>
                                {new Date(selectedTransaction.date).toLocaleDateString('id-ID')} &bull; {new Date(selectedTransaction.date).toLocaleTimeString('id-ID')}
                            </div>
                        </div>

                        <div style={{ marginBottom: 20, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>Metode Pembayaran</div>
                                <div style={{ fontWeight: 700, fontSize: 15, textTransform: 'uppercase' }}>
                                    {selectedTransaction.paymentMethod === 'qris' ? '📱 QRIS' : '💵 Tunai'}
                                </div>
                            </div>
                            {selectedTransaction.paymentMethod === 'qris' && (
                                <div>
                                    {selectedTransaction.paymentProof ? (
                                        <button 
                                            className="btn btn-sm" 
                                            style={{ width: 'auto', padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--primary)' }}
                                            onClick={async () => {
                                                await AlertService.info('Bukti Pembayaran', '', `<img src="${selectedTransaction.paymentProof}" style="max-width:100%;max-height:70vh;border-radius:8px;"/>`);
                                            }}
                                        >
                                            👁️ Lihat Bukti
                                        </button>
                                    ) : (
                                        <span style={{ fontSize: 11, color: 'var(--error)', fontWeight: 600 }}>⚠️ Tanpa Bukti</span>
                                    )}
                                </div>
                            )}
                        </div>

                        <table style={{ width: '100%', fontSize: 14, marginBottom: 20, borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                    <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 500 }}>Item</th>
                                    <th style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 500 }}>Qty</th>
                                    <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 500 }}>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedTransaction.items.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px 4px' }}>
                                            <div style={{ fontWeight: 500 }}>{item.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>@ Rp {item.price ? item.price.toLocaleString('id-ID') : 0}</div>
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '12px 4px' }}>x{item.qty}</td>
                                        <td style={{ textAlign: 'right', padding: '12px 4px', fontWeight: 500 }}>
                                            Rp {((item.price || 0) * (item.qty || 1)).toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ padding: '16px 0', borderTop: '2px dashed var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 'bold' }}>
                                <span>Total</span>
                                <span>Rp {selectedTransaction.total.toLocaleString('id-ID')}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: 12 }}>
                            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSelectedTransaction(null)}>
                                Tutup Detail
                            </button>
                            <button className="btn" style={{ flex: 1, justifyContent: 'center', background: '#3b82f6', color: 'white' }} onClick={() => setShowPreview(true)}>
                                Cetak Struk
                            </button>
                            {activeTab === 'sales' && isSuperuser && (
                                <button className="btn" style={{ flex: 1, justifyContent: 'center', background: '#dc2626', color: 'white' }} onClick={() => handleRetur(selectedTransaction)}>
                                    Retur Penjualan
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Struk Modal for History */}
            {showPreview && selectedTransaction && (
                <ReceiptPreviewModal
                    cart={typeof selectedTransaction.items === 'string' ? JSON.parse(selectedTransaction.items) : selectedTransaction.items}
                    total={selectedTransaction.total}
                    change={selectedTransaction.change || 0}
                    paymentMethod={selectedTransaction.paymentMethod || 'cash'}
                    cashReceived={selectedTransaction.cashReceived || selectedTransaction.total}
                    discount={selectedTransaction.discount || 0}
                    tax={selectedTransaction.tax || 0}
                    onClose={() => setShowPreview(false)}
                    onConfirm={() => setShowPreview(false)}
                    isHistory={true}
                    paymentProof={selectedTransaction.paymentProof}
                />
            )}
        </div>
    );
};

export default HistoryPage;
