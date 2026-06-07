import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from './supabaseClient';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  LayoutDashboard, Package, ShoppingCart, MapPin,
  TrendingUp, TrendingDown, DollarSign, Store, RefreshCw,
  ArrowUpRight, ArrowDownRight, ChevronRight, Search, Wifi,
  FileText, Calendar, ChevronLeft, ChevronRight as ChevRight
} from 'lucide-react';
import './App.css';

// ─── Sidebar Nav ───────────────────────────────────────────────────────────
const MENUS = [
  { id: 'dashboard',     label: 'Dashboard',       icon: LayoutDashboard },
  { id: 'inventory',     label: 'Stok per Cabang', icon: Package },
  { id: 'products',      label: 'Tren Global',     icon: TrendingUp },
  { id: 'closing',       label: 'Closing Harian',  icon: FileText },
  { id: 'transactions',  label: 'Transaksi',       icon: ShoppingCart },
  { id: 'branches',      label: 'Manajemen Cabang',icon: MapPin },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmt  = (n) => 'Rp ' + (n || 0).toLocaleString('id-ID');
const fmtN = (n) => (n || 0).toLocaleString('id-ID');
const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];

// Extract product map from transactions
function buildProductMap(transactions) {
  const map = {};
  transactions.forEach(t => {
    let items = t.items;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      if (!map[item.name]) {
        map[item.name] = { name: item.name, qtyTotal: 0, revenue: 0, profit: 0, buyPrice: 0, sellPrice: 0, txCount: 0 };
      }
      map[item.name].qtyTotal  += item.qty || 0;
      map[item.name].revenue   += (item.price || 0) * (item.qty || 0);
      map[item.name].profit    += item.profit || 0;
      map[item.name].buyPrice   = item.buyPrice || 0;
      map[item.name].sellPrice  = item.price || 0;
      map[item.name].txCount   += 1;
    });
  });
  return Object.values(map).sort((a, b) => b.qtyTotal - a.qtyTotal);
}

function movingLabel(rank, total) {
  if (rank < total * 0.3)  return 'fast';
  if (rank < total * 0.7)  return 'mid';
  return 'slow';
}

// ─── Dashboard Page ────────────────────────────────────────────────────────
function PageDashboard({ transactions, stores }) {
  const totalRevenue = transactions.reduce((a, t) => a + (t.total || 0), 0);
  const totalProfit  = transactions.reduce((a, t) => a + (t.profit || 0), 0);

  const today = new Date().toISOString().split('T')[0];
  const todayTx = transactions.filter(t => t.date?.startsWith(today));
  const todayRev = todayTx.reduce((a, t) => a + (t.total || 0), 0);

  // Last 7 days chart
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
    const dayTx = transactions.filter(t => t.date?.startsWith(key));
    chartData.push({
      label,
      total:  dayTx.reduce((a, t) => a + (t.total || 0), 0),
      profit: dayTx.reduce((a, t) => a + (t.profit || 0), 0),
    });
  }

  // Payment method pie
  const payMap = {};
  transactions.forEach(t => {
    let pm = t.payment_method || 'cash';
    if (pm === 'cash') pm = 'Tunai';
    if (pm === 'transfer') pm = 'Transfer';
    payMap[pm] = (payMap[pm] || 0) + 1;
  });
  const pieData = Object.entries(payMap).map(([name, value]) => ({ name, value }));

  // Top 5 products
  const products = buildProductMap(transactions).slice(0, 5);

  const maxQty = products[0]?.qtyTotal || 1;

  return (
    <>
      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <div><div className="stat-label">Total Pendapatan</div><div className="stat-value">{fmt(totalRevenue)}</div></div>
            <div className="stat-icon" style={{ background:'var(--green-bg)', color:'var(--green)' }}><DollarSign size={20}/></div>
          </div>
          <div className="stat-sub text-green">↑ Semua waktu</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <div><div className="stat-label">Total Laba Bersih</div><div className="stat-value text-green">{fmt(totalProfit)}</div></div>
            <div className="stat-icon" style={{ background:'var(--purple-bg)', color:'var(--purple)' }}><TrendingUp size={20}/></div>
          </div>
          <div className="stat-sub text-muted">Margin: {totalRevenue ? ((totalProfit/totalRevenue)*100).toFixed(1) : 0}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <div><div className="stat-label">Pendapatan Hari Ini</div><div className="stat-value">{fmt(todayRev)}</div></div>
            <div className="stat-icon" style={{ background:'var(--accent-glow)', color:'var(--accent)' }}><ShoppingCart size={20}/></div>
          </div>
          <div className="stat-sub text-muted">{todayTx.length} transaksi hari ini</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <div><div className="stat-label">Total Transaksi</div><div className="stat-value">{fmtN(transactions.length)}</div></div>
            <div className="stat-icon" style={{ background:'var(--yellow-bg)', color:'var(--yellow)' }}><Store size={20}/></div>
          </div>
          <div className="stat-sub text-muted">{stores.length} cabang aktif</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-title">Tren Penjualan 7 Hari <span className="card-subtitle">Pendapatan & Laba</span></div>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={chartData} margin={{ top:5, right:10, bottom:0, left:0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false}/>
              <XAxis dataKey="label" tick={{ fontSize:11, fill:'var(--muted)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:11, fill:'var(--muted)' }} axisLine={false} tickLine={false} tickFormatter={v => 'Rp '+Math.round(v/1000)+'k'}/>
              <Tooltip contentStyle={{ background:'var(--bg-card2)',border:'1px solid var(--border)',borderRadius:8,fontSize:12 }}
                formatter={(v, n) => [fmt(v), n==='total'?'Pendapatan':'Laba']}/>
              <Line type="monotone" dataKey="total"  stroke="var(--accent)" strokeWidth={2.5} dot={false}/>
              <Line type="monotone" dataKey="profit" stroke="var(--green)"  strokeWidth={2}   dot={false} strokeDasharray="4 4"/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Metode Pembayaran</div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                  dataKey="value" nameKey="name" paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip contentStyle={{ background:'var(--bg-card2)',border:'1px solid var(--border)',borderRadius:8,fontSize:12 }}/>
                <Legend iconType="circle" iconSize={8} formatter={v => <span style={{color:'var(--text)',fontSize:12}}>{v}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty"><div className="empty-icon">📊</div><p>Belum ada data</p></div>}
        </div>
      </div>

      {/* Top Products */}
      <div className="card">
        <div className="card-title">Top 5 Produk Terlaris</div>
        {products.length === 0
          ? <div className="empty"><p>Belum ada transaksi tersinkron</p></div>
          : products.map((p, i) => (
            <div key={p.name} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
              <div style={{ width:22, textAlign:'center', fontSize:12, color:'var(--muted)', fontWeight:700 }}>{i+1}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize:12, color:'var(--muted)', flexShrink:0, marginLeft:8 }}>{fmtN(p.qtyTotal)} pcs</span>
                </div>
                <div className="progress-wrap">
                  <div className="progress-bar" style={{ width: `${(p.qtyTotal/maxQty)*100}%`, background: COLORS[i] }}/>
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--green)' }}>{fmt(p.revenue)}</div>
              </div>
            </div>
          ))
        }
      </div>
    </>
  );
}

// ─── Products Page ─────────────────────────────────────────────────────────
function PageProducts({ transactions }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('qty'); // qty | revenue | margin

  const all = useMemo(() => buildProductMap(transactions), [transactions]);

  const allWithMeta = useMemo(() =>
    all.map((p, i) => ({ ...p, rank: i, moving: movingLabel(i, all.length) }))
  , [all]);

  const fastCount = allWithMeta.filter(p => p.moving === 'fast').length;
  const slowCount = allWithMeta.filter(p => p.moving === 'slow').length;
  const midCount  = allWithMeta.filter(p => p.moving === 'mid').length;

  const totalOmzet  = all.reduce((a, p) => a + p.revenue, 0);
  const totalProfit = all.reduce((a, p) => a + p.profit, 0);

  const displayed = useMemo(() => {
    let data = [...allWithMeta];
    if (filter !== 'all') data = data.filter(p => p.moving === filter);
    if (search) data = data.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    if (sortBy === 'revenue') data.sort((a, b) => b.revenue - a.revenue);
    else if (sortBy === 'margin') {
      data.sort((a, b) => {
        const mA = a.sellPrice ? (a.sellPrice - a.buyPrice) / a.sellPrice : 0;
        const mB = b.sellPrice ? (b.sellPrice - b.buyPrice) / b.sellPrice : 0;
        return mB - mA;
      });
    }
    return data;
  }, [allWithMeta, filter, search, sortBy]);

  const margin = (p) => p.sellPrice ? (((p.sellPrice - p.buyPrice) / p.sellPrice) * 100).toFixed(1) : 0;
  const maxQty = all[0]?.qtyTotal || 1;

  return (
    <>
      {/* Summary Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[
          { label:'Total Produk',   value: all.length,    color:'var(--accent)',  bg:'var(--accent-glow)' },
          { label:'🔥 Fast Moving', value: fastCount,     color:'var(--green)',   bg:'var(--green-bg)' },
          { label:'⚡ Sedang',       value: midCount,      color:'var(--yellow)',  bg:'var(--yellow-bg)' },
          { label:'🐢 Slow Moving', value: slowCount,     color:'var(--red)',     bg:'var(--red-bg)' },
        ].map(c => (
          <div key={c.label} onClick={() => {
            if (c.label.includes('Fast')) setFilter('fast');
            else if (c.label.includes('Slow')) setFilter('slow');
            else if (c.label.includes('Sedang')) setFilter('mid');
            else setFilter('all');
          }}
            style={{ background:'var(--bg-card)', border:`1px solid ${c.bg}`, borderRadius:10,
              padding:'14px 16px', cursor:'pointer', transition:'transform .15s' }}
            onMouseOver={e => e.currentTarget.style.transform='translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform='translateY(0)'}
          >
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>{c.label}</div>
            <div style={{ fontSize:26, fontWeight:800, color:c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filter + Search + Sort */}
      <div className="filter-bar" style={{ marginBottom:14 }}>
        {[['all','Semua'],['fast','🔥 Fast'],['mid','⚡ Sedang'],['slow','🐢 Slow']].map(([k,l]) => (
          <button key={k} className={`filter-btn ${filter===k?'active':''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)',
              background:'var(--bg-card2)', color:'var(--text)', fontSize:12, cursor:'pointer' }}>
            <option value="qty">Urut: Qty Terjual</option>
            <option value="revenue">Urut: Omzet</option>
            <option value="margin">Urut: Margin</option>
          </select>
          <div style={{ position:'relative' }}>
            <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }}/>
            <input className="search-input" style={{ paddingLeft:30, width:180 }} placeholder="Cari produk..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {displayed.length === 0
        ? <div className="empty"><div className="empty-icon">📦</div><p>Tidak ada produk ditemukan</p></div>
        : (
          <div className="table-wrap">
            <table style={{ tableLayout:'fixed', width:'100%' }}>
              <colgroup>
                <col style={{ width:30 }}/>
                <col style={{ width:160 }}/>
                <col style={{ width:88 }}/>
                <col style={{ width:105 }}/>
                <col style={{ width:105 }}/>
                <col style={{ width:70 }}/>
                <col style={{ width:95 }}/>
                <col style={{ width:120 }}/>
                <col style={{ width:110 }}/>
                <col/>
              </colgroup>
              <thead><tr>
                <th>#</th>
                <th>Nama Produk</th>
                <th>Status</th>
                <th>Harga Beli</th>
                <th>Harga Jual</th>
                <th>Margin</th>
                <th>Qty Terjual</th>
                <th>Total Omzet</th>
                <th>Total Laba</th>
                <th>Porsi Penjualan</th>
              </tr></thead>
              <tbody>
                {displayed.map((p) => (
                  <tr key={p.name}>
                    <td className="text-muted" style={{ textAlign:'center' }}>{p.rank + 1}</td>
                    <td style={{ fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }} title={p.name}>
                      {p.name}
                    </td>
                    <td>
                      {p.moving === 'fast' && <span className="badge-fast">🔥 Fast</span>}
                      {p.moving === 'mid'  && <span className="badge-mid">⚡ Sedang</span>}
                      {p.moving === 'slow' && <span className="badge-slow">🐢 Slow</span>}
                    </td>
                    <td style={{ color:'var(--muted)' }}>{fmt(p.buyPrice)}</td>
                    <td style={{ fontWeight:700 }}>{fmt(p.sellPrice)}</td>
                    <td>
                      <span style={{
                        fontWeight:700,
                        color: margin(p) >= 20 ? 'var(--green)' : margin(p) >= 10 ? 'var(--yellow)' : 'var(--red)'
                      }}>
                        {margin(p)}%
                      </span>
                    </td>
                    <td style={{ fontWeight:600 }}>{fmtN(p.qtyTotal)} pcs</td>
                    <td>{fmt(p.revenue)}</td>
                    <td style={{ color:'var(--green)', fontWeight:700 }}>{fmt(p.profit)}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div className="progress-wrap" style={{ flex:1 }}>
                          <div className="progress-bar" style={{
                            width:`${(p.qtyTotal/maxQty)*100}%`,
                            background: p.moving==='fast'?'var(--green)':p.moving==='slow'?'var(--red)':'var(--yellow)'
                          }}/>
                        </div>
                        <span style={{ fontSize:10, color:'var(--muted)', width:32, textAlign:'right', flexShrink:0 }}>
                          {Math.round((p.qtyTotal/maxQty)*100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:'var(--bg-card2)' }}>
                  <td colSpan={7} style={{ padding:'10px 14px', fontSize:12, color:'var(--muted)', fontWeight:600 }}>
                    Total ({displayed.length} produk)
                  </td>
                  <td style={{ padding:'10px 14px', fontWeight:700 }}>{fmt(displayed.reduce((a,p)=>a+p.revenue,0))}</td>
                  <td style={{ padding:'10px 14px', fontWeight:700, color:'var(--green)' }}>{fmt(displayed.reduce((a,p)=>a+p.profit,0))}</td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      }
    </>
  );
}

// ─── Closing Page ──────────────────────────────────────────────────────────
function PageClosing({ transactions, stores }) {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0]);

  const goDay = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const dayTx = transactions.filter(t => t.date?.startsWith(selectedDate));

  const totalRevenue = dayTx.reduce((a, t) => a + (t.total || 0), 0);
  const totalProfit  = dayTx.reduce((a, t) => a + (t.profit || 0), 0);
  const totalDiscount= dayTx.reduce((a, t) => a + (t.discount || 0), 0);
  const txCount = dayTx.length;

  // Breakdown per metode bayar
  const methodMap = {};
  dayTx.forEach(t => {
    const m = t.payment_method || 'cash';
    if (!methodMap[m]) methodMap[m] = { count: 0, total: 0 };
    methodMap[m].count++;
    methodMap[m].total += t.total || 0;
  });

  // Breakdown per cabang
  const branchMap = {};
  dayTx.forEach(t => {
    const dev = t.device_id || 'unknown';
    if (!branchMap[dev]) branchMap[dev] = { count: 0, total: 0, profit: 0 };
    branchMap[dev].count++;
    branchMap[dev].total += t.total || 0;
    branchMap[dev].profit += t.profit || 0;
  });

  // Top produk hari ini
  const prodMap = {};
  dayTx.forEach(t => {
    let items = t.items;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      if (!prodMap[item.name]) prodMap[item.name] = { qty: 0, revenue: 0 };
      prodMap[item.name].qty += item.qty || 0;
      prodMap[item.name].revenue += (item.price || 0) * (item.qty || 0);
    });
  });
  const topProds = Object.entries(prodMap).map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.qty - a.qty).slice(0, 5);

  const isToday = selectedDate === today.toISOString().split('T')[0];
  const labelDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <>
      {/* Date Picker Navigation */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginBottom:20 }}>
        <button onClick={() => goDay(-1)} style={{ padding:'8px 12px', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', cursor:'pointer', display:'flex', alignItems:'center' }}>
          <ChevronLeft size={16}/>
        </button>
        <div style={{ textAlign:'center' }}>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            style={{ padding:'8px 14px', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}/>
          <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>{labelDate} {isToday && <span style={{ color:'var(--green)', fontWeight:600 }}>• Hari Ini</span>}</div>
        </div>
        <button onClick={() => goDay(1)} disabled={isToday} style={{ padding:'8px 12px', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, color: isToday ? 'var(--muted)' : 'var(--text)', cursor: isToday ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center' }}>
          <ChevRight size={16}/>
        </button>
      </div>

      {txCount === 0 ? (
        <div className="empty"><div className="empty-icon">📋</div><p>Tidak ada transaksi pada tanggal ini</p></div>
      ) : (
        <>
          {/* Ringkasan KPI */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
            {[
              { label:'Total Omzet',     value: fmt(totalRevenue), color:'var(--accent)',  icon:'💰' },
              { label:'Total Laba',      value: fmt(totalProfit),  color:'var(--green)',   icon:'📈' },
              { label:'Total Transaksi', value: txCount + ' trx',  color:'var(--yellow)',  icon:'🧾' },
              { label:'Total Diskon',    value: fmt(totalDiscount),color:'var(--red)',     icon:'🏷️' },
            ].map(c => (
              <div key={c.label} className="card" style={{ textAlign:'center' }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{c.icon}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>{c.label}</div>
                <div style={{ fontSize:16, fontWeight:800, color:c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            {/* Metode Bayar */}
            <div className="card">
              <div className="card-title">💳 Breakdown Metode Bayar</div>
              {Object.entries(methodMap).map(([m, v]) => (
                <div key={m} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div>
                    <span style={{ textTransform:'capitalize', fontWeight:600, color: m==='cash'?'var(--green)':'var(--yellow)', fontSize:13 }}>
                      {m === 'cash' ? 'Tunai' : (m === 'transfer' ? 'Transfer' : m)}
                    </span>
                    <span style={{ fontSize:11, color:'var(--muted)', marginLeft:8 }}>{v.count} transaksi</span>
                  </div>
                  <span style={{ fontWeight:700, fontSize:13 }}>{fmt(v.total)}</span>
                </div>
              ))}
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, marginTop:4, display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:12, color:'var(--muted)' }}>Total</span>
                <span style={{ fontWeight:800 }}>{fmt(totalRevenue)}</span>
              </div>
            </div>

            {/* Per Cabang */}
            <div className="card">
              <div className="card-title">🏪 Penjualan Per Cabang</div>
              {Object.entries(branchMap).map(([dev, v]) => {
                const store = stores.find(s => s.device_id === dev);
                return (
                  <div key={dev} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:600 }}>{store?.store_name || dev.slice(0,12) + '…'}</span>
                      <span style={{ fontSize:12, fontWeight:700 }}>{fmt(v.total)}</span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{v.count} trx · laba <span style={{ color:'var(--green)' }}>{fmt(v.profit)}</span></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Produk Hari Ini */}
          <div className="card">
            <div className="card-title">🏆 Top Produk Hari Ini</div>
            {topProds.length === 0
              ? <div style={{ color:'var(--muted)', fontSize:13 }}>Tidak ada data produk</div>
              : (
                <div className="table-wrap">
                  <table>
                    <thead><tr>
                      <th>#</th><th>Nama Produk</th><th>Qty Terjual</th><th>Total Omzet</th>
                    </tr></thead>
                    <tbody>
                      {topProds.map((p, i) => (
                        <tr key={p.name}>
                          <td className="text-muted">{i+1}</td>
                          <td style={{ fontWeight:600 }}>{p.name}</td>
                          <td>{fmtN(p.qty)} pcs</td>
                          <td style={{ fontWeight:700, color:'var(--green)' }}>{fmt(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </>
      )}
    </>
  );
}

// ─── Transactions Page ─────────────────────────────────────────────────────
function PageTransactions({ transactions }) {
  const [search, setSearch] = useState('');

  const displayed = transactions.filter(t =>
    !search || t.device_id?.toLowerCase().includes(search.toLowerCase()) ||
    t.payment_method?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="filter-bar">
        <input className="search-input" placeholder="Cari device / metode bayar..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <span className="text-muted" style={{ fontSize:12, marginLeft:'auto' }}>
          {displayed.length} transaksi
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>Tanggal & Waktu</th>
            <th>Device ID</th>
            <th>Metode</th>
            <th>Total</th>
            <th>Laba</th>
            <th>Items</th>
          </tr></thead>
          <tbody>
            {displayed.length === 0
              ? <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--muted)', padding:40 }}>Belum ada transaksi tersinkron</td></tr>
              : displayed.map(t => {
                  let items = t.items;
                  if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
                  const count = Array.isArray(items) ? items.length : 0;
                  return (
                    <tr key={t.sync_id || t.id}>
                      <td style={{ whiteSpace:'nowrap' }}>
                        {t.date ? new Date(t.date).toLocaleString('id-ID') : '-'}
                      </td>
                      <td><code style={{ fontSize:11, color:'var(--accent)' }}>{(t.device_id || '-').slice(0,16)}…</code></td>
                      <td>
                        <span style={{ textTransform:'capitalize', fontWeight:600,
                          color: t.payment_method === 'cash' ? 'var(--green)' : 'var(--yellow)' }}>
                          {t.payment_method || 'cash'}
                        </span>
                      </td>
                      <td className="fw-bold">{fmt(t.total)}</td>
                      <td className="text-green">{fmt(t.profit)}</td>
                      <td className="text-muted">{count} item</td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Branches Page ─────────────────────────────────────────────────────────
function PageBranches({ stores, transactions }) {
  // Hitung revenue per device
  const devRevMap = {};
  transactions.forEach(t => { devRevMap[t.device_id] = (devRevMap[t.device_id] || 0) + (t.total || 0); });

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
      {stores.length === 0
        ? <div className="empty" style={{ gridColumn:'1/-1' }}><div className="empty-icon">🏪</div><p>Belum ada cabang teregistrasi</p></div>
        : stores.map(s => (
          <div key={s.id} className="card" style={{ borderTop:'3px solid var(--accent)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>{s.store_name || 'Toko Tanpa Nama'}</div>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{s.address || '-'}</div>
              </div>
              <div style={{ background:'var(--green-bg)', color:'var(--green)', padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                Aktif
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                <span className="text-muted">Device ID</span>
                <code style={{ fontSize:11, color:'var(--accent)' }}>{(s.device_id || '').slice(0,18)}…</code>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                <span className="text-muted">Latitude</span>
                <span>{s.latitude?.toFixed(6) || '-'}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                <span className="text-muted">Longitude</span>
                <span>{s.longitude?.toFixed(6) || '-'}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                <span className="text-muted">Kode Lisensi</span>
                <code style={{ fontSize:11, color:'var(--yellow)' }}>{s.license_key || '-'}</code>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                <span className="text-muted">Diaktifkan</span>
                <span>{s.activated_at ? new Date(s.activated_at).toLocaleDateString('id-ID') : '-'}</span>
              </div>
              <div style={{ marginTop:4, paddingTop:10, borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
                <span className="text-muted" style={{ fontSize:12 }}>Total Omzet Cabang</span>
                <span className="fw-bold text-green" style={{ fontSize:13 }}>{fmt(devRevMap[s.device_id] || 0)}</span>
              </div>
            </div>

            <a href={`https://maps.google.com/?q=${s.latitude},${s.longitude}`} target="_blank" rel="noreferrer"
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:14,
                padding:'7px', borderRadius:8, border:'1px solid var(--border)', color:'var(--muted)',
                textDecoration:'none', fontSize:12, fontWeight:600, transition:'all .15s' }}
              onMouseOver={e => { e.target.style.borderColor='var(--accent)'; e.target.style.color='var(--accent)'; }}
              onMouseOut={e => { e.target.style.borderColor='var(--border)'; e.target.style.color='var(--muted)'; }}>
              <MapPin size={13}/> Buka di Google Maps
            </a>
          </div>
        ))
      }
    </div>
  );
}

// ─── Inventory Page ──────────────────────────────────────────────────────────
function PageInventory({ stores, storeProducts }) {
  const [selectedStore, setSelectedStore] = useState(stores[0]?.device_id || 'all');
  const [search, setSearch] = useState('');

  const filteredProducts = storeProducts
    .filter(p => selectedStore === 'all' || p.device_id === selectedStore)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.stock || 0) - (b.stock || 0));

  return (
    <>
      <div style={{ display:'flex', gap:12, marginBottom:16 }}>
        <div className="card" style={{ padding:10, flex:1 }}>
          <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
            style={{ width:'100%', padding:'8px 12px', background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:8 }}>
            <option value="all">-- Semua Cabang --</option>
            {stores.map(s => <option key={s.device_id} value={s.device_id}>{s.store_name || s.device_id.slice(0,8)}</option>)}
          </select>
        </div>
        <div className="card" style={{ padding:10, flex:2 }}>
          <input type="text" placeholder="Cari nama barang..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width:'100%', padding:'8px 12px', background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:8 }} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">📦 Stok Barang Real-time</div>
        {filteredProducts.length === 0 ? (
          <div className="empty"><p>Tidak ada data stok untuk cabang ini. Pastikan kasir sudah terhubung internet.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th style={{ width: 40 }}>No</th>
                <th>Nama Barang</th>
                <th>Supplier (Info)</th>
                <th>Harga Beli</th>
                <th>Harga Jual</th>
                <th>Stok Tersisa</th>
                <th>Status Stok</th>
              </tr></thead>
              <tbody>
                {filteredProducts.map((p, i) => (
                  <tr key={p.id}>
                    <td className="text-muted text-center">{i + 1}</td>
                    <td style={{ fontWeight:600 }}>{p.name}</td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.supplier || '-'}</div>
                      {p.supplier_phone && p.supplier_phone !== '-' && (
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>📞 {p.supplier_phone}</div>
                      )}
                    </td>
                    <td className="text-muted">{fmt(p.buy_price)}</td>
                    <td className="fw-bold">{fmt(p.price)}</td>
                    <td style={{ fontWeight: 800, color: p.stock <= 10 ? 'var(--red)' : 'var(--text)' }}>
                      {fmtN(p.stock)}
                    </td>
                    <td>
                      {p.stock <= 10 
                        ? <span style={{ padding:'4px 8px', background:'var(--red-bg)', color:'var(--red)', borderRadius:4, fontSize:11, fontWeight:700 }}>RESTOK</span>
                        : <span style={{ padding:'4px 8px', background:'var(--green-bg)', color:'var(--green)', borderRadius:4, fontSize:11, fontWeight:700 }}>AMAN</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── APP ROOT ──────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]             = useState('dashboard');
  const [transactions, setTx]       = useState([]);
  const [stores, setStores]         = useState([]);
  const [storeProducts, setProds]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [lastSync, setLastSync]     = useState(null);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: txData }, { data: storeData }, { data: prodData }] = await Promise.all([
      supabase.from('transactions').select('*').order('date', { ascending: false }).limit(500),
      supabase.from('store_devices').select('*'),
      supabase.from('store_products').select('*')
    ]);
    if (txData) setTx(txData);
    if (storeData) setStores(storeData);
    if (prodData) setProds(prodData);
    setLastSync(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Realtime subscription
    const sub = supabase.channel('realtime-tx')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, payload => {
        setTx(cur => [payload.new, ...cur]);
        setLastSync(new Date());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_products' }, payload => {
        fetchData();
      })
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, []);

  const pageTitle = MENUS.find(m => m.id === page)?.label || 'Dashboard';

  return (
    <div className="layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>CloudHQ Kasir</h2>
          <p>Analytics & Monitoring</p>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Navigasi</div>
          {MENUS.map(m => (
            <button key={m.id} className={`nav-item ${page === m.id ? 'active' : ''}`} onClick={() => setPage(m.id)}>
              <m.icon size={16}/> {m.label}
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div style={{ marginBottom:6, color:'var(--green)', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
            <div className="badge-dot"/> Realtime aktif
          </div>
          {lastSync && <div>Update: {lastSync.toLocaleTimeString('id-ID')}</div>}
          <div style={{ marginTop:4 }}>
            {stores.length} cabang · {transactions.length} transaksi
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        {/* Topbar */}
        <div className="topbar">
          <h1>{pageTitle}</h1>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span className="badge"><div className="badge-dot"/> Realtime</span>
            <button onClick={fetchData} style={{
              display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8,
              border:'1px solid var(--border)', background:'none', color:'var(--muted)',
              cursor:'pointer', fontSize:12, fontWeight:600
            }}>
              <RefreshCw size={13}/> Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="content">
          {loading
            ? <div className="loading"><div className="spinner"/> Memuat data dari Supabase...</div>
            : page === 'dashboard'    ? <PageDashboard    transactions={transactions} stores={stores}/>
            : page === 'inventory'    ? <PageInventory    stores={stores} storeProducts={storeProducts}/>
            : page === 'products'     ? <PageProducts     transactions={transactions}/>
            : page === 'closing'      ? <PageClosing      transactions={transactions} stores={stores}/>
            : page === 'transactions' ? <PageTransactions transactions={transactions}/>
            : page === 'branches'     ? <PageBranches     stores={stores} transactions={transactions}/>
            : null
          }
        </div>
      </div>
    </div>
  );
}
