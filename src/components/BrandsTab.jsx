import React, { useEffect, useState } from 'react';
import { dbService } from '../services/DatabaseService';
import { Plus, Trash, X, Search, Tag } from 'lucide-react';
import { AlertService } from '../utils/AlertService';

const BrandsTab = () => {
    const [brands, setBrands] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await dbService.getBrands();
        setBrands(data);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await dbService.addBrand(name);
        setName('');
        setShowForm(false);
        loadData();
    };

    const handleDelete = async (id) => {
        if (await AlertService.confirm('Hapus Merek', 'Yakin ingin menghapus merek ini?')) {
            await dbService.deleteBrand(id);
            loadData();
            AlertService.success('Terhapus', 'Merek berhasil dihapus.');
        }
    };

    const filteredBrands = brands.filter(b => 
        b.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            {/* ── HEADER BAR ─────────────────────────── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', background: 'var(--card-bg)', padding: '10px 14px', borderRadius: 16, boxShadow: 'var(--shadow)', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}>
                <div className="modern-input-group" style={{ width: '260px', border: '1px solid var(--border-color)', borderRadius: 12, flexShrink: 1 }}>
                    <Search size={16} style={{ color: 'var(--text-muted)', marginLeft: 10 }} />
                    <input
                        placeholder="Cari merek..."
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
                        {showForm ? 'Batal' : 'Tambah Merek'}
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="card mb-4" style={{ border: '2px solid var(--primary)', borderRadius: 16, background: 'var(--bg-color)' }}>
                    <h3 style={{ marginBottom: 14, fontSize: 14 }}>➕ Tambah Merek Baru</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label>Nama Merek</label>
                            <input required value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Indofood" />
                        </div>
                        <button className="btn" type="submit" style={{ width: '100%', marginTop: 10 }}>Simpan Merek</button>
                    </form>
                </div>
            )}

            <div className="product-list">
                {filteredBrands.length === 0 && (
                    <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                        📦 Belum ada data merek
                    </div>
                )}
                {filteredBrands.map(b => (
                    <div key={b.id} className="card product-list-card" style={{ marginBottom: 10, padding: '12px 20px', border: '1px solid var(--border-color)', borderRadius: 16, background: 'var(--card-bg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                            <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-color)' }}>
                                <Tag size={32} style={{ color: 'var(--text-muted)' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-main)' }}>
                                    {b.name}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                    ID Merek: {b.id}
                                </div>
                            </div>
                            <button className="btn-icon" onClick={() => handleDelete(b.id)} title="Hapus" style={{ width: 42, height: 42, background: 'var(--error-bg)', border: '1px solid var(--error-bg)', color: 'var(--error)', borderRadius: 12 }}>
                                <Trash size={20} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BrandsTab;
