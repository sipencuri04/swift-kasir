import React, { useEffect, useState } from 'react';
import { dbService } from '../services/DatabaseService';
import { licenseService } from '../services/LicenseService';
import { useAuth } from '../components/AuthContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Package, AlertTriangle, Clock, Sparkles, ChevronRight, ShoppingBag, ArrowRight } from 'lucide-react';
import SmartAssistant from '../components/SmartAssistant';
import { useNavigate } from 'react-router-dom';

const DashboardPage = () => {
    const { isSuperuser } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [trialInfo, setTrialInfo] = useState(null);
    const [showAssistant, setShowAssistant] = useState(false);
    const [targetOmset, setTargetOmset] = useState(() => parseInt(localStorage.getItem('target_omset_harian') || '0'));
    const [editTarget, setEditTarget] = useState(false);
    const [targetInput, setTargetInput] = useState('');

    useEffect(() => {
        loadStats();
        checkLicense();
        const interval = setInterval(() => checkLicense(), 1000);
        return () => clearInterval(interval);
    }, []);

    const loadStats = async () => {
        const data = await dbService.getDashboardStats();
        setStats(data);
    };

    const checkLicense = async () => {
        const isPermanent = localStorage.getItem('kasir_license_key');
        if (!isPermanent) {
            const status = await licenseService.checkTrialStatus();
            setTrialInfo(status);
            if (status.isExpired) window.location.reload();
        }
    };

    if (!stats) return (
        <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                <div>Memuat data dashboard...</div>
            </div>
        </div>
    );

    const formatTime = (val) => val.toString().padStart(2, '0');
    const formatYAxis = (value) => {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}jt`;
        if (value >= 1000) return `${(value / 1000).toFixed(0)}rb`;
        return value;
    };
    const formatTooltip = (value) => `Rp ${value.toLocaleString('id-ID')}`;

    const kpiCards = [
        {
            label: 'Omset Hari Ini',
            value: `Rp ${(stats.todaySales || 0).toLocaleString('id-ID')}`,
            icon: <ShoppingBag size={20} color="white" />,
            gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        },
        {
            label: isSuperuser ? 'Keuntungan Hari Ini' : 'Total Transaksi',
            value: isSuperuser
                ? `Rp ${(stats.todayProfit || 0).toLocaleString('id-ID')}`
                : `${(stats.todayTransactions || 0)} Trx`,
            icon: <TrendingUp size={20} color="white" />,
            gradient: 'linear-gradient(135deg, #10b981, #047857)',
        },
        {
            label: 'Total Stok',
            value: `${(stats.totalStock || 0).toLocaleString('id-ID')} Item`,
            icon: <Package size={20} color="white" />,
            gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
        },
        {
            label: 'Stok Menipis',
            value: `${stats.lowStockCount} Item`,
            icon: <AlertTriangle size={20} color="white" />,
            gradient: 'linear-gradient(135deg, #f59e0b, #b45309)',
        },
    ];

    return (
        <div className="page-container">

            {showAssistant ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <SmartAssistant onClose={() => setShowAssistant(false)} />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Trial Banner */}
                    {trialInfo && !trialInfo.isExpired && (
                        <div style={{
                            background: 'var(--warning-bg)', color: 'var(--warning-text)',
                            padding: '14px 20px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12,
                            border: '1px solid var(--warning-text)'
                        }}>
                            <Clock size={20} />
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>Mode Trial</div>
                                <div style={{ fontSize: 12 }}>Sisa: <b>{formatTime(trialInfo.remainingMinutes)}:{formatTime(trialInfo.remainingSeconds)}</b></div>
                            </div>
                        </div>
                    )}

                    {/* ── Target Omset Harian ── */}
                    {isSuperuser && (
                        <div className="card" style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>🎯 Target Omset Hari Ini</div>
                                <button
                                    onClick={() => { setEditTarget(!editTarget); setTargetInput(targetOmset.toString()); }}
                                    style={{ background: 'var(--primary-bg)', color: 'var(--primary)', border: 'none', borderRadius: 8, padding: '4px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                                >
                                    {editTarget ? 'Batal' : 'Ubah'}
                                </button>
                            </div>
                            {editTarget ? (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        type="number"
                                        placeholder="Target (Rp)"
                                        value={targetInput}
                                        onChange={e => setTargetInput(e.target.value)}
                                        style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', fontSize: 14 }}
                                    />
                                    <button
                                        onClick={() => {
                                            const t = parseInt(targetInput) || 0;
                                            setTargetOmset(t);
                                            localStorage.setItem('target_omset_harian', t.toString());
                                            setEditTarget(false);
                                        }}
                                        style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}
                                    >Simpan</button>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                                        <span>Rp {(stats.todaySales || 0).toLocaleString('id-ID')}</span>
                                        <span>{targetOmset > 0 ? `Target: Rp ${targetOmset.toLocaleString('id-ID')}` : 'Belum ada target'}</span>
                                    </div>
                                    <div style={{ height: 12, background: 'var(--bg-color)', borderRadius: 6, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: targetOmset > 0 ? `${Math.min(100, Math.round((stats.todaySales || 0) / targetOmset * 100))}%` : '0%',
                                            background: (() => {
                                                const pct = targetOmset > 0 ? (stats.todaySales || 0) / targetOmset : 0;
                                                return pct >= 1 ? '#16a34a' : pct >= 0.7 ? '#f59e0b' : 'var(--primary)';
                                            })(),
                                            borderRadius: 6,
                                            transition: 'width 0.6s ease'
                                        }} />
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginTop: 6, textAlign: 'right' }}>
                                        {targetOmset > 0 ? `${Math.min(100, Math.round((stats.todaySales || 0) / targetOmset * 100))}% tercapai` : 'Tap Ubah untuk set target'}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── KPI Cards ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }} className="dashboard-kpi-4">
                        {kpiCards.map((card, i) => (
                            <div key={i} style={{
                                background: card.gradient,
                                padding: '18px 20px',
                                borderRadius: 20,
                                color: 'white',
                                boxShadow: '0 8px 20px rgba(0,0,0,0.12)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 10 }}>
                                        {card.icon}
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.9 }}>{card.label}</div>
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px' }}>{card.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* ── Tren Penjualan Chart ── */}
                    <div style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 20,
                        padding: '20px',
                        boxShadow: 'var(--shadow)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                            <TrendingUp size={18} color="var(--primary)" />
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>Tren Penjualan 7 Hari Terakhir</div>
                        </div>
                        <div style={{ height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stats.salesTrend} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        tickFormatter={(v) => v.slice(5)}
                                        fontSize={11}
                                        stroke="var(--text-muted)"
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tickFormatter={formatYAxis}
                                        fontSize={11}
                                        stroke="var(--text-muted)"
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        formatter={formatTooltip}
                                        contentStyle={{
                                            background: 'var(--card-bg)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 12,
                                            fontSize: 12
                                        }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                                    <Line
                                        type="monotone"
                                        dataKey="total"
                                        name="Omset"
                                        stroke="var(--primary)"
                                        strokeWidth={3}
                                        dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 0 }}
                                        activeDot={{ r: 6 }}
                                    />
                                    {isSuperuser && (
                                        <Line
                                            type="monotone"
                                            dataKey="profit"
                                            name="Keuntungan"
                                            stroke="var(--success)"
                                            strokeWidth={3}
                                            dot={{ r: 4, fill: 'var(--success)', strokeWidth: 0 }}
                                        />
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* ── AI Assistant Banner ── */}
                    <div
                        onClick={() => setShowAssistant(true)}
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            padding: '20px 24px',
                            borderRadius: 20,
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            cursor: 'pointer',
                            boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(99,102,241,0.45)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.35)'; }}
                    >
                        <div style={{
                            width: 48, height: 48, borderRadius: 14,
                            background: 'rgba(255,255,255,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <Sparkles size={24} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Tanya Asisten Pintar ✨</div>
                            <div style={{ fontSize: 13, opacity: 0.85 }}>Analisis stok, omset & saran bisnis berbasis AI</div>
                        </div>
                        <ChevronRight size={22} style={{ opacity: 0.8 }} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardPage;
