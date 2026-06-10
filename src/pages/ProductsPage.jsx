import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dbService } from '../services/DatabaseService';
import { Plus, Trash, X, Pencil, Search, FileSpreadsheet, Package, Truck, Tag, ArrowUpCircle, Calendar, Clock, ArrowLeft, ClipboardList, CheckSquare, Barcode, Printer, BookOpen } from 'lucide-react';
import CameraScanner from '../components/CameraScanner';
import BarcodeGenerator from '../components/BarcodeGenerator';
import JsBarcode from 'jsbarcode';
import SuppliersTab from '../components/SuppliersTab';
import BrandsTab from '../components/BrandsTab';
import PurchasePage from './PurchasePage';
import RestockHistoryPage from './RestockHistoryPage';
import StockOpnameTab from '../components/StockOpnameTab';
import StockOpnameHistoryTab from '../components/StockOpnameHistoryTab';
import PriceLabelTab from '../components/PriceLabelTab';
import IngredientsTab from '../components/IngredientsTab';
import RecipesTab from '../components/RecipesTab';
import { AlertService } from '../utils/AlertService';

const ProductsPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(null);

    const menuItems = [
        { id: 'products', name: 'Daftar Produk', icon: <Package size={28} />, color: '#6366f1' },
        { id: 'suppliers', name: 'Suplier', icon: <Truck size={28} />, color: '#10b981' },
        { id: 'brands', name: 'Merek', icon: <Tag size={28} />, color: '#f59e0b' },
        { id: 'ingredients', name: 'Bahan Baku (F&B)', icon: <ClipboardList size={28} />, color: '#06b6d4' },
        { id: 'recipes', name: 'Resep Produk', icon: <BookOpen size={28} />, color: '#a855f7' },
        { id: 'restock', name: 'Restok Barang', icon: <ArrowUpCircle size={28} />, color: '#ec4899' },
        { id: 'restock_history', name: 'Riwayat Restok', icon: <Clock size={28} />, color: '#8b5cf6' },
        { id: 'stock_opname', name: 'Stock Opname', icon: <CheckSquare size={28} />, color: '#ef4444' },
        { id: 'so_history', name: 'Riwayat SO', icon: <ClipboardList size={28} />, color: '#64748b' },
        { id: 'labels', name: 'Cetak Label Harga', icon: <Barcode size={28} />, color: '#0ea5e9' },
    ];

    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [brands, setBrands] = useState([]);
    const [categories, setCategories] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [barcodeProduct, setBarcodeProduct] = useState(null);

    const [formData, setFormData] = useState({
        name: '', price: '', buyPrice: '', stock: '', supplierId: '', brandId: '', categoryId: '', barcode: '', image: null
    });
    const [editingId, setEditingId] = useState(null);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const [productRecipes, setProductRecipes] = useState([]);

    useEffect(() => {
        if (activeTab === 'products' || activeTab === null) {
            loadProducts();
            loadMasterData();
        }
    }, [activeTab]);

    const loadProducts = async () => {
        // Sync harga modal dari resep sebelum load daftar produk
        await dbService.syncAllProductsBuyPrice();
        const data = await dbService.getProducts();
        const rec = await dbService.getRecipes();
        setProducts(data);
        setProductRecipes(rec || []);
    };

    const loadMasterData = async () => {
        const s = await dbService.getSuppliers();
        const b = await dbService.getBrands();
        const c = await dbService.getCategories();
        setSuppliers(s);
        setBrands(b);
        setCategories(c || []);
    };

    const handleDelete = async (id) => {
        if (await AlertService.confirm('Hapus Produk', 'Apakah Anda yakin ingin menghapus produk ini? Data yang dihapus tidak dapat dikembalikan.')) {
            await dbService.deleteProduct(id);
            loadProducts();
            AlertService.success('Terhapus', 'Produk berhasil dihapus.');
        }
    };

    const handleEdit = async (product) => {
        // Sync harga modal dari resep agar nilai selalu fresh
        await dbService.syncAllProductsBuyPrice();
        const freshProducts = await dbService.getProducts();
        const fresh = freshProducts.find(p => p.id === product.id) || product;

        setFormData({
            name: fresh.name,
            price: fresh.price,
            buyPrice: fresh.buyPrice,
            stock: fresh.stock,
            supplierId: fresh.supplierId || '',
            brandId: fresh.brandId || '',
            categoryId: fresh.categoryId || '',
            barcode: fresh.barcode || '',
            image: fresh.image || null
        });
        setEditingId(fresh.id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setFormData({ name: '', price: '', buyPrice: '', stock: '', supplierId: '', brandId: '', categoryId: '', barcode: '', image: null });
        setEditingId(null);
        setShowForm(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name) return;

        const data = {
            name: formData.name,
            price: formData.price,
            buyPrice: formData.buyPrice,
            stock: formData.stock,
            supplierId: formData.supplierId,
            brandId: formData.brandId,
            barcode: formData.barcode,
            image: formData.image
        };

        if (editingId) {
            await dbService.updateProduct(editingId, data);
        } else {
            await dbService.addProduct(data);
        }

        resetForm();
        loadProducts();
    };

    return (
        <div className="page-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {activeTab && (
                        <button 
                            onClick={() => setActiveTab(null)}
                            style={{ 
                                background: 'none', 
                                border: 'none', 
                                cursor: 'pointer', 
                                color: 'var(--text-main)', 
                                padding: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                transition: 'background-color 0.2s'
                            }}
                            onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
                            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>
                            {activeTab ? menuItems.find(m => m.id === activeTab)?.name : 'Data Master'}
                        </h1>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                            {activeTab ? 'Kelola detail data terpilih' : 'Pilih menu untuk mengelola data toko Anda'}
                        </p>
                    </div>
                </div>
            </div>

            {!activeTab ? (
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(2, 1fr)', 
                    gap: 16,
                    paddingBottom: 40
                }}>
                    {menuItems.map((item) => (
                        <div 
                            key={item.id} 
                            onClick={() => setActiveTab(item.id)}
                            className="card" 
                            style={{ 
                                padding: '24px 16px', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                gap: 16,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: '1px solid var(--border-color)',
                                borderRadius: 20,
                                textAlign: 'center'
                            }}
                            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <div style={{ 
                                width: 64, 
                                height: 64, 
                                borderRadius: 18, 
                                background: `${item.color}15`, 
                                color: item.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: `0 8px 16px ${item.color}10`
                            }}>
                                {item.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>{item.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Kelola {item.name.toLowerCase()}</div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ animation: 'slideInRight 0.3s ease-out' }}>
                    {activeTab === 'suppliers' && <SuppliersTab />}
                    {activeTab === 'brands' && <BrandsTab />}
                    {activeTab === 'ingredients' && <IngredientsTab />}
                    {activeTab === 'recipes' && <RecipesTab />}
                    {activeTab === 'restock' && <PurchasePage onComplete={() => { setActiveTab('products'); loadProducts(); }} />}
                    {activeTab === 'restock_history' && <RestockHistoryPage />}
                    {activeTab === 'stock_opname' && <StockOpnameTab onComplete={loadProducts} />}
                    {activeTab === 'so_history' && <StockOpnameHistoryTab />}
                    {activeTab === 'labels' && <PriceLabelTab />}

                    {activeTab === 'products' && (
                        <>
                    {/* Header Bar */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', background: 'var(--card-bg)', padding: '12px 16px', borderRadius: 16, boxShadow: 'var(--shadow)', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}>
                        <div className="modern-input-group" style={{ width: '300px', flexShrink: 1 }}>
                            <Search size={18} style={{ color: 'var(--text-muted)', marginLeft: 12 }} />
                            <input
                                placeholder="Cari nama barang..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ fontSize: 13, padding: '10px 12px', border: 'none', background: 'transparent', width: '100%', color: 'var(--text-main)' }}
                            />
                            {searchTerm && (
                                <X size={16} onClick={() => setSearchTerm('')}
                                    style={{ cursor: 'pointer', color: 'var(--text-muted)', marginRight: 12 }} />
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                            <button
                                className="btn"
                                onClick={() => navigate('/settings')}
                                style={{ background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-bg)', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600, width: 'auto' }}
                            >
                                <FileSpreadsheet size={16} /> Excel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => showForm ? resetForm() : setShowForm(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, width: 'auto' }}
                            >
                                {showForm ? <X size={16} /> : <Plus size={16} />}
                                {showForm ? 'Batal' : 'Tambah Produk'}
                            </button>
                        </div>
                    </div>

                    {/* Info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, padding: '0 4px', fontWeight: 600 }}>
                        <span>Menampilkan {filteredProducts.length} barang</span>
                        <span>Total Stok: <b style={{ color: 'var(--text-main)' }}>{filteredProducts.reduce((a, p) => a + (p.stock || 0), 0).toLocaleString('id-ID')}</b></span>
                    </div>

                    {/* ── FORM TAMBAH/EDIT ───────────────────── */}
                    {showForm && (
                        <div className="card" style={{ border: '2px solid var(--primary)', marginBottom: 20, borderRadius: 16, background: 'var(--card-bg)' }}>
                            <h3 style={{ marginBottom: 14, fontSize: 14, color: 'var(--text-main)' }}>{editingId ? '✏️ Edit Barang' : '➕ Tambah Barang Baru'}</h3>
                            <form onSubmit={handleSubmit}>
                                <div className="input-group">
                                    <label>Nama Barang</label>
                                    <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="Contoh: Indomie Goreng" />
                                </div>
                                <div className="input-group">
                                    <label>Barcode / Kode Scan (Opsional)</label>
                                    <CameraScanner onScan={(text) => setFormData({ ...formData, barcode: text })} />
                                    <input value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} placeholder="Atau ketik manual / scan pakai alat fisik di sini..." />
                                </div>
                                <div className="grid-2">
                                    <div className="input-group">
                                        <label>Merek</label>
                                        <select className="modern-select" value={formData.brandId} onChange={e => setFormData({ ...formData, brandId: e.target.value })}>
                                            <option value="">-- Merek --</option>
                                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>Suplier</label>
                                        <select className="modern-select" value={formData.supplierId} onChange={e => setFormData({ ...formData, supplierId: e.target.value })}>
                                            <option value="">-- Suplier --</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {/* Kategori */}
                                <div className="input-group">
                                    <label>Kategori</label>
                                    <select className="modern-select" value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })}>
                                        <option value="">-- Pilih Kategori --</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid-2">
                                    <div className="input-group">
                                        <label>
                                            Harga Beli
                                            {editingId && productRecipes.some(r => r.productId === editingId) && (
                                                <span style={{ fontSize: 10, color: 'var(--success-text)', marginLeft: 8, fontWeight: 700 }}>✅ Auto dari Resep</span>
                                            )}
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.buyPrice}
                                            onChange={e => setFormData({ ...formData, buyPrice: e.target.value })}
                                            placeholder="0"
                                            readOnly={editingId && productRecipes.some(r => r.productId === editingId)}
                                            style={editingId && productRecipes.some(r => r.productId === editingId) ? { background: 'var(--success-bg)', color: 'var(--success-text)', fontWeight: 700 } : {}}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Harga Jual</label>
                                        <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required placeholder="0" />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label>Stok {editingId && <span style={{ fontSize: 10, color: 'var(--error)', marginLeft: 8 }}>(Gunakan menu Restok/Opname untuk ubah stok)</span>}</label>
                                    <input 
                                        type="number" 
                                        value={formData.stock} 
                                        onChange={e => setFormData({ ...formData, stock: e.target.value })} 
                                        required 
                                        placeholder="0" 
                                        readOnly={!!editingId}
                                        style={{ background: editingId ? 'var(--input-bg)' : 'transparent', opacity: editingId ? 0.7 : 1 }}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Gambar Produk (Opsional)</label>
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                        {formData.image && (
                                            <img src={formData.image} alt="Preview" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />
                                        )}
                                        <input 
                                            type="file" 
                                            className="modern-input"
                                            accept="image/*" 
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setFormData({ ...formData, image: reader.result });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }} 
                                            style={{ padding: '8px' }}
                                        />
                                        {formData.image && (
                                            <button type="button" onClick={() => setFormData({...formData, image: null})} className="btn-icon" style={{ color: 'var(--error)' }}>
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', height: 48, borderRadius: 12, fontWeight: 700 }}>
                                    {editingId ? 'Simpan Perubahan' : 'Simpan Barang'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* ── DAFTAR PRODUK (Card list) ──────────── */}
                    {filteredProducts.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                            {searchTerm ? '🔍 Barang tidak ditemukan' : '📦 Belum ada data barang'}
                        </div>
                    ) : (
                        filteredProducts.map(p => {
                            const brandName    = brands.find(b => b.id == p.brandId)?.name;
                            const supplierName = suppliers.find(s => s.id == p.supplierId)?.name;
                            const margin = p.buyPrice ? Math.round(((p.price - p.buyPrice) / p.price) * 100) : null;

                            return (
                                <div key={p.id} className="card product-list-card" style={{ marginBottom: 10, padding: '12px 20px', border: '1px solid var(--border-color)', borderRadius: 16 }}>
                                    <div className="product-card-content">
                                        {/* Gambar Thumbnail Besar */}
                                        <div className="product-img-col" style={{ background: 'var(--bg-color)', borderRadius: 12 }}>
                                            {p.image ? (
                                                <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ fontSize: 24, opacity: 0.5 }}>📦</div>
                                            )}
                                        </div>

                                        {/* Nama + Meta */}
                                        <div className="product-info-col">
                                            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-main)', marginBottom: 4 }}>
                                                {p.name}
                                            </div>
                                            {(brandName || supplierName) && (
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <span style={{ background: 'var(--bg-color)', padding: '2px 10px', borderRadius: 8, fontWeight: 600, border: '1px solid var(--border-color)' }}>{brandName || 'No Brand'}</span>
                                                    <span style={{ opacity: 0.3 }}>|</span>
                                                    <span>{supplierName || 'No Supplier'}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Stok badge */}
                                        <div className="product-stock-col">
                                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>Stok</div>
                                            <span style={{
                                                padding: '6px 14px', borderRadius: 10, fontSize: 14, fontWeight: 800,
                                                background: p.stock <= 5 ? 'var(--error-bg)' : 'var(--success-bg)',
                                                color: p.stock <= 5 ? 'var(--error-text)' : 'var(--success-text)',
                                                border: `1px solid ${p.stock <= 5 ? 'var(--error-bg)' : 'var(--success-bg)'}`,
                                                display: 'inline-block', minWidth: 50
                                            }}>
                                                {p.stock || 0}
                                            </span>
                                        </div>

                                        {/* Harga */}
                                        <div className="product-price-col">
                                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>Harga Jual</div>
                                            <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--primary)' }}>
                                                Rp {(p.price || 0).toLocaleString('id-ID')}
                                            </div>
                                            {margin !== null && (
                                                <div style={{ fontSize: 12, color: margin >= 20 ? 'var(--success-text)' : 'var(--warning-text)', fontWeight: 700, marginTop: 4 }}>
                                                    Untung {margin}%
                                                </div>
                                            )}
                                        </div>

                                        {/* Aksi */}
                                        <div className="product-actions-col">
                                            <button className="btn-icon" onClick={() => setBarcodeProduct(p)} title="Cetak Label Harga" style={{ width: 42, height: 42, background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0284c7', borderRadius: 12 }}>
                                                <Barcode size={20} />
                                            </button>
                                            <button className="btn-icon" onClick={() => handleEdit(p)} title="Edit" style={{ width: 42, height: 42, background: 'var(--primary-bg)', border: '1px solid var(--primary-bg)', color: 'var(--primary)', borderRadius: 12 }}>
                                                <Pencil size={20} />
                                            </button>
                                            <button className="btn-icon" onClick={() => handleDelete(p.id)} title="Hapus" style={{ width: 42, height: 42, background: 'var(--error-bg)', border: '1px solid var(--error-bg)', color: 'var(--error)', borderRadius: 12 }}>
                                                <Trash size={20} />
                                            </button>

                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {/* BarcodeGenerator Modal */}
                    {barcodeProduct && (
                        <BarcodeGenerator product={barcodeProduct} onClose={() => setBarcodeProduct(null)} />
                    )}
                </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProductsPage;
