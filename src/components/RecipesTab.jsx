import React, { useEffect, useState } from 'react';
import { dbService } from '../services/DatabaseService';
import { Plus, Trash, X, Search, Check, Utensils, BookOpen, AlertTriangle } from 'lucide-react';
import { AlertService } from '../utils/AlertService';

const RecipesTab = () => {
    const [products, setProducts] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const [recipes, setRecipes] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [recipeItems, setRecipeItems] = useState([]); // Array of { ingredientId, quantity, unit }
    const [isEditing, setIsEditing] = useState(false);

    // Modal state for adding product directly
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [newProductForm, setNewProductForm] = useState({ name: '', price: '', categoryId: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const p = await dbService.getProducts();
        const ing = await dbService.getIngredients();
        const rec = await dbService.getRecipes();
        const cats = await dbService.getCategories();
        
        setProducts(p);
        setIngredients(ing);
        setRecipes(rec);
        setCategories(cats || []);

        if (selectedProduct) {
            const updatedProduct = p.find(prod => prod.id === selectedProduct.id);
            setSelectedProduct(updatedProduct || null);
            const currentRecipe = rec.filter(r => r.productId === selectedProduct.id);
            
            // Map saved DB items (base units) to display items (with automatic units)
            const mappedItems = currentRecipe.map(r => {
                const ingredient = ing.find(i => i.id === r.ingredientId);
                const baseUnit = ingredient?.unit || 'gram';
                let displayUnit = baseUnit;
                let displayQty = r.quantity;

                if (baseUnit === 'kg' && r.quantity < 1) {
                    displayUnit = 'gram';
                    displayQty = r.quantity * 1000;
                } else if (baseUnit === 'liter' && r.quantity < 1) {
                    displayUnit = 'ml';
                    displayQty = r.quantity * 1000;
                }

                return {
                    ingredientId: r.ingredientId,
                    quantity: displayQty,
                    unit: displayUnit
                };
            });
            setRecipeItems(mappedItems);
        }
    };

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        const currentRecipe = recipes.filter(r => r.productId === product.id);
        
        const mappedItems = currentRecipe.map(r => {
            const ingredient = ingredients.find(i => i.id === r.ingredientId);
            const baseUnit = ingredient?.unit || 'gram';
            let displayUnit = baseUnit;
            let displayQty = r.quantity;

            if (baseUnit === 'kg' && r.quantity < 1) {
                displayUnit = 'gram';
                displayQty = r.quantity * 1000;
            } else if (baseUnit === 'liter' && r.quantity < 1) {
                displayUnit = 'ml';
                displayQty = r.quantity * 1000;
            }

            return {
                ingredientId: r.ingredientId,
                quantity: displayQty,
                unit: displayUnit
            };
        });
        
        setRecipeItems(mappedItems);
        setIsEditing(false);
    };

    const handleAddIngredient = () => {
        if (ingredients.length === 0) {
            AlertService.error('Gagal', 'Silakan buat bahan baku terlebih dahulu di tab Bahan Baku.');
            return;
        }
        
        const unused = ingredients.find(ing => !recipeItems.some(item => item.ingredientId === ing.id));
        const defaultId = unused ? unused.id : ingredients[0].id;
        const targetIng = ingredients.find(i => i.id === defaultId);
        
        setRecipeItems([...recipeItems, { 
            ingredientId: defaultId, 
            quantity: 1, 
            unit: targetIng?.unit || 'gram' 
        }]);
    };

    const handleRemoveIngredient = (index) => {
        setRecipeItems(recipeItems.filter((_, i) => i !== index));
    };

    const handleItemChange = (index, field, value) => {
        const updated = [...recipeItems];
        if (field === 'ingredientId') {
            const targetIng = ingredients.find(i => i.id === parseInt(value));
            updated[index] = { 
                ...updated[index], 
                ingredientId: parseInt(value),
                unit: targetIng?.unit || 'gram'
            };
        } else {
            updated[index] = { ...updated[index], [field]: value };
        }
        setRecipeItems(updated);
    };

    const getItemCost = (item) => {
        const ing = ingredients.find(i => i.id === parseInt(item.ingredientId));
        if (!ing) return 0;
        
        const qty = parseFloat(item.quantity) || 0;
        const baseUnit = ing.unit || 'gram';
        let dbQty = qty;

        if (item.unit === 'gram' && baseUnit === 'kg') {
            dbQty = qty / 1000;
        } else if (item.unit === 'kg' && baseUnit === 'gram') {
            dbQty = qty * 1000;
        } else if (item.unit === 'ml' && baseUnit === 'liter') {
            dbQty = qty / 1000;
        } else if (item.unit === 'liter' && baseUnit === 'ml') {
            dbQty = qty * 1000;
        }

        return dbQty * (ing.buyPrice || 0);
    };

    const getCompatibleUnits = (baseUnit) => {
        if (baseUnit === 'kg' || baseUnit === 'gram') {
            return [
                { value: 'gram', label: 'g (Gram)' },
                { value: 'kg', label: 'kg (Kilogram)' }
            ];
        }
        if (baseUnit === 'liter' || baseUnit === 'ml') {
            return [
                { value: 'ml', label: 'ml (Mililiter)' },
                { value: 'liter', label: 'L (Liter)' }
            ];
        }
        return [{ value: baseUnit, label: baseUnit }];
    };

    const handleSave = async () => {
        if (!selectedProduct) return;
        
        const ids = recipeItems.map(item => parseInt(item.ingredientId));
        const hasDuplicates = ids.some((val, i) => ids.indexOf(val) !== i);
        if (hasDuplicates) {
            AlertService.error('Gagal', 'Ada bahan baku ganda di resep. Silakan gabungkan atau hapus salah satu.');
            return;
        }

        const invalidQty = recipeItems.some(item => parseFloat(item.quantity) <= 0);
        if (invalidQty) {
            AlertService.error('Gagal', 'Semua jumlah bahan baku harus lebih dari 0.');
            return;
        }

        // Convert user display units back to ingredient base units for DB storage
        const dbRecipeItems = recipeItems.map(item => {
            const ing = ingredients.find(i => i.id === parseInt(item.ingredientId));
            const baseUnit = ing?.unit || 'gram';
            const qty = parseFloat(item.quantity) || 0;
            let dbQty = qty;

            if (item.unit === 'gram' && baseUnit === 'kg') {
                dbQty = qty / 1000;
            } else if (item.unit === 'kg' && baseUnit === 'gram') {
                dbQty = qty * 1000;
            } else if (item.unit === 'ml' && baseUnit === 'liter') {
                dbQty = qty / 1000;
            } else if (item.unit === 'liter' && baseUnit === 'ml') {
                dbQty = qty * 1000;
            }

            return {
                ingredientId: item.ingredientId,
                quantity: dbQty
            };
        });

        try {
            await dbService.updateRecipe(selectedProduct.id, dbRecipeItems);
            AlertService.success('Berhasil', 'Resep produk berhasil disimpan.');
            setIsEditing(false);
            loadData();
        } catch (e) {
            AlertService.error('Error', e.message);
        }
    };

    const handleAddProductSubmit = async (e) => {
        e.preventDefault();
        if (!newProductForm.name || !newProductForm.price) return;

        try {
            const newProd = await dbService.addProduct({
                name: newProductForm.name,
                price: parseFloat(newProductForm.price),
                categoryId: newProductForm.categoryId ? parseInt(newProductForm.categoryId) : null,
                stock: 0,
                buyPrice: 0
            });

            AlertService.success('Berhasil', `Produk F&B "${newProductForm.name}" berhasil dibuat.`);
            setNewProductForm({ name: '', price: '', categoryId: '' });
            setShowAddProductModal(false);

            // Reload and automatically select the new product
            const p = await dbService.getProducts();
            const rec = await dbService.getRecipes();
            const ing = await dbService.getIngredients();
            setProducts(p);
            setRecipes(rec);
            setIngredients(ing);

            const createdProduct = p.find(prod => prod.id === newProd.id);
            if (createdProduct) {
                setSelectedProduct(createdProduct);
                setRecipeItems([]);
                setIsEditing(true); // Open edit mode instantly
            }
        } catch (err) {
            AlertService.error('Error', err.message);
        }
    };

    const calculateEffectiveStock = (prodId) => {
        const prodRecipes = recipes.filter(r => r.productId === prodId);
        if (prodRecipes.length === 0) return null;
        
        const limits = prodRecipes.map(r => {
            const ing = ingredients.find(i => i.id === r.ingredientId);
            if (!ing) return 0;
            return (ing.stock || 0) / r.quantity;
        });
        
        return Math.floor(Math.min(...limits));
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const currentRawCost = recipeItems.reduce((acc, item) => {
        return acc + getItemCost(item);
    }, 0);

    const currentMargin = selectedProduct?.price 
        ? Math.round(((selectedProduct.price - currentRawCost) / selectedProduct.price) * 100)
        : 0;

    return (
        <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
            <style>{`
                .recipes-layout {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 16px;
                    align-items: start;
                }
                @media (min-width: 768px) {
                    .recipes-layout {
                        grid-template-columns: 320px 1fr;
                    }
                }
                .recipe-item-row {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    margin-bottom: 12px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid var(--border-color);
                }
            `}</style>

            <div className="recipes-layout">
                {/* LEFT COLUMN: Product Selector */}
                <div className="card" style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column', margin: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                        {/* Search Input */}
                        <div className="modern-input-group" style={{ border: '1px solid var(--border-color)', borderRadius: 12 }}>
                            <Search size={16} style={{ color: 'var(--text-muted)', marginLeft: 10 }} />
                            <input
                                placeholder="Cari produk..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ fontSize: 13, padding: '8px 10px', border: 'none', background: 'transparent', width: '100%', color: 'var(--text-main)' }}
                            />
                        </div>
                        {/* Add F&B Product Button */}
                        <button 
                            onClick={() => setShowAddProductModal(true)}
                            className="btn btn-primary"
                            style={{ padding: '8px 12px', fontSize: 13, borderRadius: 10, height: 36, display: 'flex', justifyContent: 'center', gap: 6 }}
                        >
                            <Plus size={16} /> Tambah Produk F&B
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }} className="custom-scrollbar">
                        {filteredProducts.map(p => {
                            const hasRecipe = recipes.some(r => r.productId === p.id);
                            const computedStock = calculateEffectiveStock(p.id);
                            const isSelected = selectedProduct?.id === p.id;
                            
                            return (
                                <div 
                                    key={p.id} 
                                    onClick={() => handleProductSelect(p)}
                                    style={{
                                        padding: '10px 14px',
                                        background: isSelected ? 'var(--primary-bg)' : 'var(--bg-color)',
                                        border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                                        borderRadius: 12,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                            Harga: Rp {p.price.toLocaleString()}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        {hasRecipe ? (
                                            <span style={{ 
                                                fontSize: 10, 
                                                padding: '2px 8px', 
                                                background: 'rgba(168, 85, 247, 0.15)', 
                                                color: '#a855f7', 
                                                borderRadius: 20, 
                                                fontWeight: 800 
                                            }}>
                                                RESEP ({computedStock !== null ? computedStock : 0} porsi)
                                            </span>
                                        ) : (
                                            <span style={{ 
                                                fontSize: 10, 
                                                padding: '2px 8px', 
                                                background: 'var(--border-color)', 
                                                color: 'var(--text-muted)', 
                                                borderRadius: 20, 
                                                fontWeight: 700 
                                            }}>
                                                Retail ({p.stock} pcs)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT COLUMN: Recipe Details */}
                <div className="card" style={{ minHeight: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column', margin: 0 }}>
                    {!selectedProduct ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: 40 }}>
                            <BookOpen size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                            <h3>Pilih Produk</h3>
                            <p style={{ fontSize: 13 }}>Pilih produk di kolom kiri atau buat produk F&B baru untuk mengatur resep dan bahan bakunya.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
                            {/* Header Info */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--border-color)', pb: 14, marginBottom: 16, paddingBottom: 14 }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Utensils size={20} className="text-primary" />
                                        <h2 style={{ margin: 0, fontSize: 18 }}>Resep untuk: {selectedProduct.name}</h2>
                                    </div>
                                    <p style={{ fontSize: 12, marginTop: 4 }}>
                                        Hubungkan bahan baku penyusun beserta takaran yang dibutuhkan untuk menyajikan 1 unit produk ini.
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {!isEditing ? (
                                        <button className="btn btn-outline" onClick={() => setIsEditing(true)} style={{ width: 'auto', padding: '6px 14px', fontSize: 13, borderRadius: 10 }}>
                                            Edit Resep
                                        </button>
                                    ) : (
                                        <>
                                            <button className="btn btn-outline btn-danger" onClick={() => { setIsEditing(false); handleProductSelect(selectedProduct); }} style={{ width: 'auto', padding: '6px 14px', fontSize: 13, borderRadius: 10, color: 'var(--error)', borderColor: 'var(--error)' }}>
                                                Batal
                                            </button>
                                            <button className="btn btn-primary" onClick={handleSave} style={{ width: 'auto', padding: '6px 14px', fontSize: 13, borderRadius: 10 }}>
                                                Simpan Resep
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Cost Breakdown Info */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, background: 'var(--bg-color)', padding: 12, borderRadius: 12, marginBottom: 20 }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>HARGA JUAL</div>
                                    <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-main)' }}>Rp {selectedProduct.price.toLocaleString()}</div>
                                </div>
                                <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>BIAYA BAHAN</div>
                                    <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--primary)' }}>Rp {currentRawCost.toLocaleString('id-ID')}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>MARGIN LABA</div>
                                    <div style={{ fontSize: 15, fontWeight: 900, color: currentMargin >= 30 ? 'var(--success)' : 'var(--warning-text)' }}>
                                        {currentMargin}%
                                    </div>
                                </div>
                            </div>

                            {/* Recipe Items Form / Viewer */}
                            <div style={{ flex: 1, minHeight: 180 }}>
                                {recipeItems.length === 0 ? (
                                    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', border: '2px dashed var(--border-color)', borderRadius: 14 }}>
                                        <AlertTriangle size={28} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.4 }} />
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>Belum Ada Resep</div>
                                        <p style={{ fontSize: 12, maxWidth: 300, margin: '6px auto 0' }}>
                                            Produk ini masih diperlakukan sebagai barang retail (menggunakan stok langsung produk).
                                        </p>
                                        {isEditing && (
                                            <button className="btn btn-outline" onClick={handleAddIngredient} style={{ width: 'auto', padding: '6px 14px', fontSize: 12, margin: '14px auto 0', borderRadius: 8 }}>
                                                <Plus size={14} /> Tambah Bahan
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ display: 'flex', fontWeight: 'bold', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border-color)' }}>
                                            <span style={{ flex: 2 }}>Bahan Baku</span>
                                            <span style={{ flex: 1.5, textAlign: 'center' }}>Jumlah Takaran</span>
                                            <span style={{ width: 100, textAlign: 'right' }}>Estimasi Biaya</span>
                                            {isEditing && <span style={{ width: 40 }}></span>}
                                        </div>

                                        {recipeItems.map((item, index) => {
                                            const ing = ingredients.find(i => i.id === parseInt(item.ingredientId));
                                            const compatibleUnits = ing ? getCompatibleUnits(ing.unit) : [];
                                            return (
                                                <div key={index} className="recipe-item-row">
                                                    {/* Ingredient Selector / Label */}
                                                    <div style={{ flex: 2, minWidth: 0 }}>
                                                        {isEditing ? (
                                                            <select
                                                                className="modern-select"
                                                                value={item.ingredientId}
                                                                onChange={e => handleItemChange(index, 'ingredientId', parseInt(e.target.value))}
                                                                style={{ padding: '6px 10px', fontSize: 13 }}
                                                            >
                                                                {ingredients.map(ig => (
                                                                    <option key={ig.id} value={ig.id}>{ig.name}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{ing?.name || 'Bahan tidak dikenal'}</span>
                                                        )}
                                                    </div>

                                                    {/* Quantity Input with Unit Dropdown */}
                                                    <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                                        {isEditing ? (
                                                            <>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    required
                                                                    value={item.quantity}
                                                                    onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                                                                    style={{ padding: '6px 8px', fontSize: 13, textAlign: 'center', width: '60px' }}
                                                                />
                                                                <select
                                                                    className="modern-select"
                                                                    value={item.unit}
                                                                    onChange={e => handleItemChange(index, 'unit', e.target.value)}
                                                                    style={{ padding: '6px', fontSize: 11, width: '75px', flexShrink: 0 }}
                                                                >
                                                                    {compatibleUnits.map(cu => (
                                                                        <option key={cu.value} value={cu.value}>{cu.label}</option>
                                                                    ))}
                                                                </select>
                                                            </>
                                                        ) : (
                                                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                                                                {item.quantity} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>{item.unit}</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Cost Value */}
                                                    <div style={{ width: 100, textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>
                                                        Rp {getItemCost(item).toLocaleString('id-ID')}
                                                    </div>

                                                    {/* Remove Button */}
                                                    {isEditing && (
                                                        <button 
                                                            onClick={() => handleRemoveIngredient(index)}
                                                            style={{ width: 32, height: 32, padding: 0, color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            <Trash size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {isEditing && (
                                            <button className="btn btn-outline" onClick={handleAddIngredient} style={{ width: 'auto', padding: '6px 14px', fontSize: 12, marginTop: 14, borderRadius: 8 }}>
                                                <Plus size={14} /> Tambah Bahan
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ADD PRODUCT DIRECTLY MODAL */}
            {showAddProductModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: 16,
                    backdropFilter: 'blur(2px)'
                }}>
                    <div className="card" style={{ maxWidth: 400, width: '100%', padding: 24, borderRadius: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>➕ Tambah Produk F&B Baru</h3>
                            <button onClick={() => setShowAddProductModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddProductSubmit}>
                            <div className="input-group">
                                <label>Nama Produk F&B</label>
                                <input 
                                    required 
                                    autoFocus
                                    value={newProductForm.name} 
                                    onChange={e => setNewProductForm({ ...newProductForm, name: e.target.value })} 
                                    placeholder="Contoh: Kopi Vanilla / Roti Bakar Coklat" 
                                />
                            </div>
                            <div className="grid-2">
                                <div className="input-group">
                                    <label>Harga Jual (Rp)</label>
                                    <input 
                                        type="number" 
                                        required 
                                        value={newProductForm.price} 
                                        onChange={e => setNewProductForm({ ...newProductForm, price: e.target.value })} 
                                        placeholder="Contoh: 20000" 
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Kategori</label>
                                    <select 
                                        className="modern-select" 
                                        value={newProductForm.categoryId} 
                                        onChange={e => setNewProductForm({ ...newProductForm, categoryId: e.target.value })}
                                    >
                                        <option value="">-- Kategori --</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <button className="btn btn-primary" type="submit" style={{ width: '100%', height: 44, marginTop: 16 }}>
                                <Check size={18} /> Simpan & Buat Resep
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecipesTab;
