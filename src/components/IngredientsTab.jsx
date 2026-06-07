import React, { useEffect, useState } from 'react';
import { dbService } from '../services/DatabaseService';
import { Plus, Trash, X, Search, Edit2, ClipboardList, Check, ArrowUpCircle } from 'lucide-react';
import { AlertService } from '../utils/AlertService';

const IngredientsTab = () => {
    const [ingredients, setIngredients] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showRestockModal, setShowRestockModal] = useState(null); // stores the ingredient object to restock
    const [restockForm, setRestockForm] = useState({ qty: '', cost: '', supplierId: '' });

    const [form, setForm] = useState({
        name: '',
        stock: '0',
        unit: 'gram',
        buyPrice: '0',
        supplierId: ''
    });

    const units = [
        { value: 'gram', label: 'Gram (g)' },
        { value: 'ml', label: 'Mililiter (ml)' },
        { value: 'pcs', label: 'Pcs (Butir/Biji)' },
        { value: 'kg', label: 'Kilogram (kg)' },
        { value: 'liter', label: 'Liter (L)' },
        { value: 'pack', label: 'Pack/Bungkus' }
    ];

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const ingData = await dbService.getIngredients();
        const supData = await dbService.getSuppliers();
        setIngredients(ingData);
        setSuppliers(supData);
    };

    const handleEdit = (ing) => {
        setForm({
            name: ing.name,
            stock: String(ing.stock),
            unit: ing.unit,
            buyPrice: String(ing.buyPrice),
            supplierId: ing.supplierId ? String(ing.supplierId) : ''
        });
        setEditingId(ing.id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name) return;

        const data = {
            name: form.name,
            stock: parseFloat(form.stock) || 0,
            unit: form.unit,
            buyPrice: parseFloat(form.buyPrice) || 0,
            supplierId: form.supplierId ? parseInt(form.supplierId) : null
        };

        if (editingId) {
            await dbService.updateIngredient(editingId, data);
            AlertService.success('Berhasil', 'Bahan baku berhasil diperbarui.');
        } else {
            await dbService.addIngredient(data);
            AlertService.success('Berhasil', 'Bahan baku baru berhasil ditambahkan.');
        }

        setForm({ name: '', stock: '0', unit: 'gram', buyPrice: '0', supplierId: '' });
        setEditingId(null);
        setShowForm(false);
        loadData();
    };

    const handleDelete = async (id) => {
        if (await AlertService.confirm('Hapus Bahan Baku', 'Yakin ingin menghapus bahan baku ini? Hubungan resep produk yang menggunakan bahan ini juga akan terhapus.')) {
            await dbService.deleteIngredient(id);
            loadData();
            AlertService.success('Terhapus', 'Bahan baku berhasil dihapus.');
        }
    };

    const handleRestockSubmit = async (e) => {
        e.preventDefault();
        if (!showRestockModal) return;

        const qty = parseFloat(restockForm.qty) || 0;
        const cost = parseFloat(restockForm.cost) || 0;
        const totalCost = qty * cost;

        if (qty <= 0) {
            AlertService.error('Gagal', 'Jumlah restok harus lebih dari 0.');
            return;
        }

        const purchaseItem = {
            id: showRestockModal.id,
            name: showRestockModal.name,
            qty: qty,
            cost: cost,
            isIngredient: true
        };

        await dbService.createPurchase(
            restockForm.supplierId ? parseInt(restockForm.supplierId) : null,
            [purchaseItem],
            totalCost
        );

        AlertService.success('Berhasil', `Stok ${showRestockModal.name} berhasil ditambahkan sebanyak ${qty} ${showRestockModal.unit}.`);
        setShowRestockModal(null);
        setRestockForm({ qty: '', cost: '', supplierId: '' });
        loadData();
    };

    const openRestock = (ing) => {
        setShowRestockModal(ing);
        setRestockForm({
            qty: '',
            cost: String(ing.buyPrice || 0),
            supplierId: ing.supplierId ? String(ing.supplierId) : ''
        });
    };

    const filteredIngredients = ingredients.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
            {/* ── HEADER BAR ─────────────────────────── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', background: 'var(--card-bg)', padding: '10px 14px', borderRadius: 16, boxShadow: 'var(--shadow)', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}>
                <div className="modern-input-group" style={{ width: '260px', border: '1px solid var(--border-color)', borderRadius: 12, flexShrink: 1 }}>
                    <Search size={16} style={{ color: 'var(--text-muted)', marginLeft: 10 }} />
                    <input
                        placeholder="Cari bahan baku..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ fontSize: 13, padding: '8px 10px', border: 'none', background: 'transparent', width: '100%', color: 'var(--text-main)' }}
                    />
                    {searchTerm && (
                        <X size={14} onClick={() => setSearchTerm('')}
                            style={{ cursor: 'pointer', color: 'var(--text-muted)', marginRight: 10 }} />
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            if (showForm) {
                                setEditingId(null);
                                setForm({ name: '', stock: '0', unit: 'gram', buyPrice: '0', supplierId: '' });
                            }
                            setShowForm(!showForm);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, width: 'auto' }}
                    >
                        {showForm ? <X size={16} /> : <Plus size={16} />}
                        {showForm ? 'Batal' : 'Tambah Bahan'}
                    </button>
                </div>
            </div>

            {/* FORM TAMBAH/EDIT */}
            {showForm && (
                <div className="card mb-4" style={{ border: '2px solid var(--primary)', borderRadius: 16, background: 'var(--card-bg)' }}>
                    <h3 style={{ marginBottom: 14, fontSize: 14 }}>{editingId ? '✏️ Edit Bahan Baku' : '➕ Tambah Bahan Baku Baru'}</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label>Nama Bahan Baku</label>
                            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Susu UHT / Biji Kopi Arabica" />
                        </div>
                        <div className="grid-2">
                            <div className="input-group">
                                <label>Satuan Unit</label>
                                <select className="modern-select" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                                    {units.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Supplier Utama (Opsional)</label>
                                <select className="modern-select" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })}>
                                    <option value="">-- Tanpa Supplier --</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid-2">
                            <div className="input-group">
                                <label>Harga Beli per Unit (Rp)</label>
                                <input type="number" step="any" required value={form.buyPrice} onChange={e => setForm({ ...form, buyPrice: e.target.value })} placeholder="Contoh: 15" />
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Misal Rp 15 per ml atau Rp 200 per gram</span>
                            </div>
                            <div className="input-group">
                                <label>Stok Awal ({form.unit}) {editingId && <span style={{ color: 'var(--error)' }}>(Gunakan menu restok untuk tambah)</span>}</label>
                                <input 
                                    type="number" 
                                    step="any" 
                                    required 
                                    value={form.stock} 
                                    onChange={e => setForm({ ...form, stock: e.target.value })} 
                                    placeholder="0"
                                    readOnly={!!editingId}
                                    style={{ background: editingId ? 'var(--input-bg)' : 'transparent', opacity: editingId ? 0.7 : 1 }}
                                />
                            </div>
                        </div>
                        <button className="btn" type="submit" style={{ width: '100%', marginTop: 10 }}>
                            {editingId ? 'Simpan Perubahan' : 'Simpan Bahan Baku'}
                        </button>
                    </form>
                </div>
            )}

            {/* DAFTAR BAHAN BAKU */}
            <div className="product-list">
                {filteredIngredients.length === 0 && (
                    <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                        📦 Belum ada data bahan baku
                    </div>
                )}
                {filteredIngredients.map(i => {
                    const supplierName = suppliers.find(s => s.id == i.supplierId)?.name;
                    const isLowStock = i.stock < (i.unit === 'gram' || i.unit === 'ml' ? 300 : 10);
                    return (
                        <div key={i.id} className="card product-list-card" style={{ marginBottom: 10, padding: '12px 20px', border: '1px solid var(--border-color)', borderRadius: 16, background: 'var(--card-bg)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                                <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-color)' }}>
                                    <ClipboardList size={26} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-main)', marginBottom: 2 }}>
                                        {i.name}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 11, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <span>Satuan: <b>{i.unit}</b></span>
                                        <span>|</span>
                                        <span>Harga/unit: <b>Rp {i.buyPrice.toLocaleString('id-ID')}</b></span>
                                        {supplierName && (
                                            <>
                                                <span>|</span>
                                                <span>Supplier: <b>{supplierName}</b></span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Stock Display */}
                                <div style={{ textAlign: 'right', marginRight: 10 }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>STOK SAAT INI</div>
                                    <span style={{
                                        padding: '4px 10px', borderRadius: 8, fontSize: 13, fontWeight: 800,
                                        background: isLowStock ? 'var(--error-bg)' : 'var(--success-bg)',
                                        color: isLowStock ? 'var(--error-text)' : 'var(--success-text)',
                                        display: 'inline-block'
                                    }}>
                                        {i.stock.toLocaleString('id-ID')} {i.unit}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    <button className="btn-icon" onClick={() => openRestock(i)} title="Restok Bahan Baku" style={{ width: 38, height: 38, background: 'var(--primary-bg)', border: 'none', color: 'var(--primary)', borderRadius: 10 }}>
                                        <ArrowUpCircle size={18} />
                                    </button>
                                    <button className="btn-icon" onClick={() => handleEdit(i)} title="Edit" style={{ width: 38, height: 38, background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: 10 }}>
                                        <Edit2 size={18} />
                                    </button>
                                    <button className="btn-icon" onClick={() => handleDelete(i.id)} title="Hapus" style={{ width: 38, height: 38, background: 'var(--error-bg)', border: 'none', color: 'var(--error)', borderRadius: 10 }}>
                                        <Trash size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* RESTOCK MODAL */}
            {showRestockModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: 16,
                    backdropFilter: 'blur(2px)'
                }}>
                    <div className="card" style={{ maxWidth: 400, width: '100%', padding: 24, borderRadius: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>📦 Restok Bahan Baku</h3>
                            <button onClick={() => setShowRestockModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
                        </div>
                        <p style={{ fontSize: 13, marginBottom: 20 }}>
                            Restok bahan: <b style={{ color: 'var(--text-main)' }}>{showRestockModal.name}</b> (Stok: {showRestockModal.stock} {showRestockModal.unit})
                        </p>
                        <form onSubmit={handleRestockSubmit}>
                            <div className="input-group">
                                <label>Jumlah Tambah ({showRestockModal.unit})</label>
                                <input 
                                    type="number" 
                                    step="any" 
                                    required 
                                    autoFocus
                                    value={restockForm.qty} 
                                    onChange={e => setRestockForm({ ...restockForm, qty: e.target.value })} 
                                    placeholder="Contoh: 1000" 
                                />
                            </div>
                            <div className="input-group">
                                <label>Harga Beli per Unit (Rp)</label>
                                <input 
                                    type="number" 
                                    step="any" 
                                    required 
                                    value={restockForm.cost} 
                                    onChange={e => setRestockForm({ ...restockForm, cost: e.target.value })} 
                                    placeholder="Contoh: 15" 
                                />
                            </div>
                            <div className="input-group">
                                <label>Pilih Supplier</label>
                                <select className="modern-select" value={restockForm.supplierId} onChange={e => setRestockForm({ ...restockForm, supplierId: e.target.value })}>
                                    <option value="">-- Tanpa Supplier --</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Estimasi Biaya:</span>
                                <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary)' }}>
                                    Rp {((parseFloat(restockForm.qty) || 0) * (parseFloat(restockForm.cost) || 0)).toLocaleString('id-ID')}
                                </span>
                            </div>

                            <button className="btn btn-primary" type="submit" style={{ width: '100%', height: 44 }}>
                                <Check size={18} /> Simpan Pembelian
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IngredientsTab;
