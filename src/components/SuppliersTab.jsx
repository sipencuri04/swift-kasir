import React, { useEffect, useState } from 'react';
import { dbService } from '../services/DatabaseService';
import { Plus, Trash, X, Search, Truck, Phone, MapPin } from 'lucide-react';
import { AlertService } from '../utils/AlertService';

const SuppliersTab = () => {
    const [suppliers, setSuppliers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', phone: '', address: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await dbService.getSuppliers();
        setSuppliers(data);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await dbService.addSupplier(form.name, form.phone, form.address);
        setForm({ name: '', phone: '', address: '' });
        setShowForm(false);
        loadData();
    };

    const handleDelete = async (id) => {
        if (await AlertService.confirm('Hapus Supplier', 'Yakin ingin menghapus supplier ini?')) {
            await dbService.deleteSupplier(id);
            loadData();
            AlertService.success('Terhapus', 'Supplier berhasil dihapus.');
        }
    };

    const filteredSuppliers = suppliers.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            {/* ── HEADER BAR ─────────────────────────── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', background: 'var(--card-bg)', padding: '10px 14px', borderRadius: 16, boxShadow: 'var(--shadow)', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}>
                <div className="modern-input-group" style={{ width: '260px', border: '1px solid var(--border-color)', borderRadius: 12, flexShrink: 1 }}>
                    <Search size={16} style={{ color: 'var(--text-muted)', marginLeft: 10 }} />
                    <input
                        placeholder="Cari suplier..."
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
                        onClick={() => setShowForm(!showForm)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, width: 'auto' }}
                    >
                        {showForm ? <X size={16} /> : <Plus size={16} />}
                        {showForm ? 'Batal' : 'Tambah Suplier'}
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="card mb-4" style={{ border: '2px solid var(--primary)', borderRadius: 16, background: 'var(--bg-color)' }}>
                    <h3 style={{ marginBottom: 14, fontSize: 14 }}>➕ Tambah Suplier Baru</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label>Nama Supplier</label>
                            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contoh: PT. Sumber Makmur" />
                        </div>
                        <div className="grid-2">
                            <div className="input-group">
                                <label>Telepon</label>
                                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0812..." />
                            </div>
                            <div className="input-group">
                                <label>Alamat</label>
                                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Jl. Raya..." />
                            </div>
                        </div>
                        <button className="btn" type="submit" style={{ width: '100%', marginTop: 10 }}>Simpan Suplier</button>
                    </form>
                </div>
            )}

            <div className="product-list">
                {filteredSuppliers.length === 0 && (
                    <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                        📦 Belum ada data suplier
                    </div>
                )}
                {filteredSuppliers.map(s => (
                    <div key={s.id} className="card product-list-card" style={{ marginBottom: 10, padding: '12px 20px', border: '1px solid var(--border-color)', borderRadius: 16, background: 'var(--card-bg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                            <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-color)' }}>
                                <Truck size={32} style={{ color: 'var(--text-muted)' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-main)', marginBottom: 4 }}>
                                    {s.name}
                                </div>
                                <div style={{ display: 'flex', gap: 12, color: 'var(--text-muted)', fontSize: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Phone size={14} style={{ opacity: 0.6 }} /> {s.phone || '-'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <MapPin size={14} style={{ opacity: 0.6 }} /> {s.address || '-'}
                                    </div>
                                </div>
                            </div>
                            <button className="btn-icon" onClick={() => handleDelete(s.id)} title="Hapus" style={{ width: 42, height: 42, background: 'var(--error-bg)', border: '1px solid var(--error-bg)', color: 'var(--error)', borderRadius: 12 }}>
                                <Trash size={20} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SuppliersTab;
