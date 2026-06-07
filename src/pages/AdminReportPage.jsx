import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Package, ChevronRight, Calendar, Download, ChevronLeft } from 'lucide-react';
import { dbService } from '../services/DatabaseService';
import { useAuth } from '../components/AuthContext';
import * as XLSX from 'xlsx';
import { saveAndShareFile } from '../utils/exportHelper';

const AdminReportPage = () => {
    const navigate = useNavigate();
    const { isSuperuser } = useAuth();
    const [view, setView] = useState('menu'); // menu, item_report, sales_report
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailyStats, setDailyStats] = useState({ total: 0, profit: 0, count: 0 });
    const [itemSales, setItemSales] = useState([]);
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        loadData();
    }, [filterDate]);

    const loadData = async () => {
        const allTrans = await dbService.getTransactions();
        const targetDate = filterDate;
        const filteredTrans = allTrans.filter(t => t.date.startsWith(targetDate));

        // Daily Stats
        const total = filteredTrans.reduce((acc, t) => acc + (t.total || 0), 0);
        const profit = filteredTrans.reduce((acc, t) => acc + (t.profit || 0), 0);
        setDailyStats({ total, profit, count: filteredTrans.length });
        setTransactions(filteredTrans);

        // Item Sales Aggregation
        const map = {};

        filteredTrans.forEach(t => {
            let items = t.items;
            if (typeof items === 'string') try { items = JSON.parse(items); } catch (e) { }
            if (Array.isArray(items)) {
                items.forEach(i => {
                    if (!map[i.name]) map[i.name] = {
                        name: i.name,
                        qty: 0,
                        revenue: 0,
                        profit: 0,
                        buyPrice: i.buyPrice || 0, // Approx from last item
                        sellPrice: i.price || 0
                    };
                    map[i.name].qty += i.qty;
                    map[i.name].revenue += (i.price * i.qty);
                    map[i.name].profit += (i.profit || 0);
                });
            }
        });

        const sortedItems = Object.values(map).sort((a, b) => b.qty - a.qty);
        setItemSales(sortedItems);
    };

    const handleDownload = () => {
        const wb = XLSX.utils.book_new();

        if (view === 'item_report') {
            const ws = XLSX.utils.json_to_sheet(itemSales.map(i => ({
                Produk: i.name,
                Terjual: i.qty,
                Omset: i.revenue,
                ...(isSuperuser ? { Profit: i.profit } : {})
            })));
            XLSX.utils.book_append_sheet(wb, ws, "Laporan Item");
        } else {
            const ws = XLSX.utils.json_to_sheet(transactions.map(t => ({
                ID: t.id,
                Waktu: new Date(t.date).toLocaleTimeString(),
                Total: t.total,
                ...(isSuperuser ? { Profit: t.profit } : {})
            })));
            XLSX.utils.book_append_sheet(wb, ws, "Laporan Penjualan");
        }

        const fileName = `Laporan_${view}_${filterDate}.xlsx`;
        const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        saveAndShareFile(fileName, base64Data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    };

    const renderHeader = (title) => (
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center" style={{ gap: 12 }}>
                <button className="btn-icon" onClick={() => setView('menu')} style={{ background: '#f1f5f9' }}>
                    <ChevronLeft size={24} />
                </button>
                <div style={{ width: 4, height: 24, background: 'var(--success)', borderRadius: 2 }}></div>
                <h1 style={{ margin: 0, fontSize: 20 }}>{title}</h1>
            </div>
            <button className="btn-icon text-success" style={{ background: '#dcfce7' }} onClick={handleDownload}>
                <Download size={20} />
            </button>
        </div>
    );

    const renderFilters = () => (
        <div className="card mb-4" style={{ padding: 16 }}>
            <div className="grid-2" style={{ gap: 16 }}>
                <div>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>Tipe Laporan</label>
                    <select className="modern-input" style={{ width: '100%' }}>
                        <option>Harian</option>
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>Pilih Periode</label>
                    <input
                        type="date"
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                        className="modern-input"
                        style={{ width: '100%' }}
                    />
                </div>
            </div>
        </div>
    );

    const renderMenu = () => (
        <div className="page-container">
            <div className="flex items-center mb-2" style={{ gap: 12 }}>
                <div style={{ width: 4, height: 24, background: 'var(--success)', borderRadius: 2 }}></div>
                <h1 style={{ margin: 0 }}>Laporan</h1>
            </div>
            <p className="text-muted mb-6">Pilih jenis laporan yang ingin ditampilkan.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="card" onClick={() => setView('item_report')}
                    style={{ cursor: 'pointer', padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center', transition: 'border-color .2s', border: '1px solid var(--border, #e2e8f0)' }}
                    onMouseOver={e => e.currentTarget.style.borderColor = '#0284c7'}
                    onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border, #e2e8f0)'}
                >
                    <div style={{ width: 48, height: 48, background: '#e0f2fe', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Package size={26} color="#0284c7" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: 15 }}>Laporan Per Item</h3>
                        <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>Detail penjualan & omset per barang</p>
                    </div>
                    <ChevronRight size={18} style={{ color: '#94a3b8', flexShrink: 0 }} />
                </div>

                <div className="card" onClick={() => setView('sales_report')}
                    style={{ cursor: 'pointer', padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center', transition: 'border-color .2s', border: '1px solid var(--border, #e2e8f0)' }}
                    onMouseOver={e => e.currentTarget.style.borderColor = '#16a34a'}
                    onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border, #e2e8f0)'}
                >
                    <div style={{ width: 48, height: 48, background: '#dcfce7', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={26} color="#16a34a" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: 15 }}>Laporan Penjualan</h3>
                        <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>Rekap transaksi harian & total omset</p>
                    </div>
                    <ChevronRight size={18} style={{ color: '#94a3b8', flexShrink: 0 }} />
                </div>
            </div>
        </div>
    );

    const renderItemReport = () => (
        <div className="page-container">
            {renderHeader('Laporan Per Item')}
            {renderFilters()}

            <div className="card mb-4" style={{ padding: 20 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Top Produk</h3>
                <p className="text-muted mt-1">Total {itemSales.length} produk terjual.</p>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead style={{ background: '#f8fafc' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '16px 20px', color: '#64748b' }}>Produk</th>
                                {isSuperuser && <th style={{ textAlign: 'right', padding: '16px 20px', color: '#64748b' }}>Harga Beli</th>}
                                <th style={{ textAlign: 'right', padding: '16px 20px', color: '#64748b' }}>Harga Jual</th>
                                <th style={{ textAlign: 'center', padding: '16px 20px', color: '#64748b' }}>Terjual</th>
                                <th style={{ textAlign: 'right', padding: '16px 20px', color: '#64748b' }}>Omset</th>
                                {isSuperuser && <th style={{ textAlign: 'right', padding: '16px 20px', color: '#64748b' }}>Profit</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {itemSales.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px 20px', fontWeight: 500 }}>
                                        {item.name}
                                    </td>
                                    {isSuperuser && (
                                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                            Rp {item.buyPrice.toLocaleString()}
                                        </td>
                                    )}
                                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                        Rp {item.sellPrice.toLocaleString()}
                                    </td>
                                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                        {item.qty}
                                    </td>
                                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 'bold' }}>
                                        Rp {item.revenue.toLocaleString()}
                                    </td>
                                    {isSuperuser && (
                                        <td style={{ padding: '16px 20px', textAlign: 'right', color: 'var(--success)', fontWeight: 'bold' }}>
                                            Rp {item.profit.toLocaleString()}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {itemSales.length === 0 && <div className="p-8 text-center text-muted">Tidak ada data.</div>}
            </div>
        </div>
    );

    const renderSalesReport = () => (
        <div className="page-container">
            {renderHeader('Laporan Penjualan')}
            {renderFilters()}

            <div className="grid-2 mb-6" style={{ gap: 16 }}>
                <div className="card bg-primary text-white" style={{ padding: 24 }}>
                    <div style={{ fontSize: 13, marginBottom: 4, opacity: 0.9 }}>Total Omset</div>
                    <div style={{ fontSize: 24, fontWeight: 'bold' }}>Rp {dailyStats.total.toLocaleString()}</div>
                </div>
                {isSuperuser && (
                    <div className="card text-white" style={{ padding: 24, background: '#10b981' }}>
                        <div style={{ fontSize: 13, marginBottom: 4, opacity: 0.9 }}>Total Profit</div>
                        <div style={{ fontSize: 24, fontWeight: 'bold' }}>Rp {dailyStats.profit.toLocaleString()}</div>
                    </div>
                )}
                {!isSuperuser && (
                    <div className="card bg-dark" style={{ padding: 24 }}>
                        <div style={{ fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Total Transaksi</div>
                        <div style={{ fontSize: 24, fontWeight: 'bold' }}>{dailyStats.count}</div>
                    </div>
                )}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead style={{ background: '#f8fafc' }}>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '16px 20px', color: '#64748b' }}>Waktu</th>
                            <th style={{ textAlign: 'left', padding: '16px 20px', color: '#64748b' }}>Items</th>
                            <th style={{ textAlign: 'right', padding: '16px 20px', color: '#64748b' }}>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((t, idx) => {
                            let itemCount = 0;
                            try {
                                const items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
                                itemCount = items.length;
                            } catch (e) { }

                            return (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div style={{ fontWeight: 500 }}>{new Date(t.date).toLocaleDateString("id-ID")}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(t.date).toLocaleTimeString("id-ID")}</div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        {itemCount} Item
                                    </td>
                                    <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 'bold' }}>
                                        Rp {t.total.toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {transactions.length === 0 && <div className="p-8 text-center text-muted">Tidak ada data.</div>}
            </div>
        </div>
    );

    if (view === 'item_report') return renderItemReport();
    if (view === 'sales_report') return renderSalesReport();
    return renderMenu();
};

export default AdminReportPage;
