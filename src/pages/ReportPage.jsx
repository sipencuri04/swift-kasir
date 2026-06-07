import React, { useState, useEffect } from 'react';
import { dbService } from '../services/DatabaseService';
import { ChevronLeft, FileText, Package, Calendar, Download, TrendingUp, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAndShareFile } from '../utils/exportHelper';

const ReportPageInner = () => {
    const navigate = useNavigate();
    const [view, setView] = useState('menu'); // 'menu', 'sales', 'items', 'stock', 'payment', 'opname', 'shift', 'fnb'
    const [stats, setStats] = useState({ total: 0, profit: 0, count: 0 });
    const [transactions, setTransactions] = useState([]);
    const [itemStats, setItemStats] = useState([]);
    const [products, setProducts] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [opnameHistory, setOpnameHistory] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const [recipes, setRecipes] = useState([]);

    // Filters
    const [filterType, setFilterType] = useState('daily');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        // Load products & purchases sekali saat mount
        const loadStatic = async () => {
            const [p, pur, op, sh, ing, rec] = await Promise.all([
                dbService.getProducts(),
                dbService.getPurchases(),
                dbService.getStockOpnameHistory(),
                dbService.getShiftHistory(),
                dbService.getIngredients(),
                dbService.getRecipes(),
            ]);
            setProducts(p);
            setPurchases(pur);
            setOpnameHistory(op || []);
            setShifts(sh || []);
            setIngredients(ing || []);
            setRecipes(rec || []);
        };
        loadStatic();
    }, []);

    useEffect(() => {
        if (view !== 'menu') {
            let dateParam = selectedDate;
            if (filterType === 'monthly') dateParam = selectedMonth;
            if (filterType === 'yearly') dateParam = selectedYear;
            loadData(dateParam);
        }
    }, [view, filterType, selectedDate, selectedMonth, selectedYear, startDate, endDate]);

    const loadData = async (dateParam) => {
        try {
            let trans;
            if (view === 'fnb') {
                let start = startDate;
                let end = endDate;
                if (filterType === 'daily') {
                    start = selectedDate;
                    end = selectedDate;
                } else if (filterType === 'monthly') {
                    start = `${selectedMonth}-01`;
                    end = `${selectedMonth}-31`;
                } else if (filterType === 'yearly') {
                    start = `${selectedYear}-01-01`;
                    end = `${selectedYear}-12-31`;
                }
                trans = await dbService.getTransactionsRange(start, end);
            } else if (filterType === 'range') {
                trans = await dbService.getTransactionsRange(startDate, endDate);
            } else {
                trans = await dbService.getTransactions(dateParam);
            }
            setTransactions(trans);
            const daily = await dbService.getDailyStats(dateParam);
            setStats(daily);

            if (view === 'items') {
                const agg = {};
                trans.forEach(t => {
                    if (t.items && Array.isArray(t.items)) {
                        t.items.forEach(i => {
                            if (!agg[i.name]) {
                                agg[i.name] = { name: i.name, qty: 0, total: 0, totalCost: 0, profit: 0 };
                            }
                            const qty = i.qty || 0;
                            const price = i.price || 0;
                            const buyPrice = i.buyPrice || 0; // Assuming buyPrice is stored in transaction items

                            agg[i.name].qty += qty;
                            agg[i.name].total += (price * qty);
                            agg[i.name].totalCost += (buyPrice * qty);

                            // Profit calc: use stored profit if available, else derive
                            const itemProfit = (i.profit !== undefined) ? i.profit : ((price - buyPrice) * qty);
                            agg[i.name].profit += itemProfit;
                        });
                    }
                });

                const sortedItems = Object.values(agg).map(item => ({
                    ...item,
                    avgCost: item.qty > 0 ? (item.totalCost / item.qty) : 0,
                    avgSellPrice: item.qty > 0 ? (item.total / item.qty) : 0,
                    margin: item.profit
                })).sort((a, b) => b.qty - a.qty);

                setItemStats(sortedItems);
            }
        } catch (error) {
            console.error("Error loading report:", error);
        }
    };

    // ─── F&B REPORT CALCULATIONS & HELPERS ─────────────────────────────────
    const formatUnitQty = (qty, baseUnit) => {
        let displayUnit = baseUnit || 'gram';
        let displayQty = qty;

        if (baseUnit === 'kg' && qty < 1) {
            displayUnit = 'gram';
            displayQty = qty * 1000;
        } else if (baseUnit === 'liter' && qty < 1) {
            displayUnit = 'ml';
            displayQty = qty * 1000;
        }
        
        const formattedQty = Number.isInteger(displayQty) ? displayQty : displayQty.toFixed(2);
        return `${formattedQty} ${displayUnit}`;
    };

    const fnbStats = React.useMemo(() => {
        if (view !== 'fnb' || !transactions || !ingredients || !recipes) {
            return { ingredientUsage: [], productMargins: [], totalRevenue: 0, totalHPP: 0, totalProfit: 0 };
        }

        // 1. Calculate Product Margin Analysis
        const productSales = {};
        transactions.forEach(t => {
            let items = t.items;
            if (typeof items === 'string') {
                try { items = JSON.parse(items); } catch { items = []; }
            }
            if (Array.isArray(items)) {
                items.forEach(item => {
                    const productId = item.id;
                    const hasRecipe = recipes.some(r => r.productId === productId);
                    if (hasRecipe) {
                        if (!productSales[productId]) {
                            productSales[productId] = {
                                id: productId,
                                name: item.name,
                                qtySold: 0,
                                totalRevenue: 0,
                            };
                        }
                        productSales[productId].qtySold += (item.qty || 0);
                        productSales[productId].totalRevenue += ((item.price || 0) * (item.qty || 0));
                    }
                });
            }
        });

        const productMargins = Object.values(productSales).map(p => {
            const prodRecipes = recipes.filter(r => r.productId === p.id);
            const portionHPP = prodRecipes.reduce((sum, r) => {
                const ing = ingredients.find(i => i.id === r.ingredientId);
                if (!ing) return sum;
                return sum + (r.quantity * (ing.buyPrice || 0));
            }, 0);

            const totalHPP = portionHPP * p.qtySold;
            const profit = p.totalRevenue - totalHPP;
            const marginPct = p.totalRevenue > 0 ? (profit / p.totalRevenue) * 100 : 0;

            return {
                ...p,
                portionHPP,
                totalHPP,
                profit,
                marginPct
            };
        }).sort((a, b) => b.qtySold - a.qtySold);

        // 2. Calculate Ingredient Usage
        const ingredientUsageMap = {};
        transactions.forEach(t => {
            let items = t.items;
            if (typeof items === 'string') {
                try { items = JSON.parse(items); } catch { items = []; }
            }
            if (Array.isArray(items)) {
                items.forEach(item => {
                    const productId = item.id;
                    const prodRecipes = recipes.filter(r => r.productId === productId);
                    
                    prodRecipes.forEach(r => {
                        const ingId = r.ingredientId;
                        if (!ingredientUsageMap[ingId]) {
                            const ing = ingredients.find(i => i.id === ingId);
                            ingredientUsageMap[ingId] = {
                                id: ingId,
                                name: ing ? ing.name : `Bahan #${ingId}`,
                                unit: ing ? ing.unit : 'gram',
                                buyPrice: ing ? (ing.buyPrice || 0) : 0,
                                quantityUsed: 0
                            };
                        }
                        ingredientUsageMap[ingId].quantityUsed += (r.quantity * (item.qty || 0));
                    });
                });
            }
        });

        const ingredientUsage = Object.values(ingredientUsageMap).map(ing => {
            const totalCost = ing.quantityUsed * ing.buyPrice;
            return {
                ...ing,
                totalCost
            };
        }).sort((a, b) => b.totalCost - a.totalCost);

        const totalRevenue = productMargins.reduce((sum, p) => sum + p.totalRevenue, 0);
        const totalHPP = productMargins.reduce((sum, p) => sum + p.totalHPP, 0);
        const totalProfit = totalRevenue - totalHPP;

        return {
            ingredientUsage,
            productMargins,
            totalRevenue,
            totalHPP,
            totalProfit
        };
    }, [view, transactions, ingredients, recipes]);

    const handleExportFnBExcel = () => {
        const wb = XLSX.utils.book_new();
        const now = new Date();
        const printDate = now.toLocaleString('id-ID');
        const storeName = localStorage.getItem('store_name') || 'Swift Kasir';
        const periodLabel = filterType === 'daily' ? selectedDate
            : filterType === 'monthly' ? selectedMonth
            : filterType === 'yearly' ? selectedYear
            : `${startDate} s/d ${endDate}`;

        const { ingredientUsage, productMargins, totalRevenue, totalHPP, totalProfit } = fnbStats;

        // Sheet 1: Margin Produk
        const marginData = [
            [`LAPORAN MARGIN PENJUALAN F&B - ${storeName.toUpperCase()}`],
            [`Periode: ${periodLabel}   |   Dicetak: ${printDate}`],
            [],
            ['No', 'Nama Produk', 'Terjual (Porsi)', 'Harga Jual Rata-rata (Rp)', 'HPP per Porsi (Rp)', 'Total Omset (Rp)', 'Total HPP (Rp)', 'Laba Kotor (Rp)', 'Margin (%)'],
        ];

        productMargins.forEach((p, idx) => {
            const price = p.qtySold > 0 ? (p.totalRevenue / p.qtySold) : 0;
            marginData.push([
                idx + 1,
                p.name,
                p.qtySold,
                Math.round(price),
                Math.round(p.portionHPP),
                Math.round(p.totalRevenue),
                Math.round(p.totalHPP),
                Math.round(p.profit),
                parseFloat(p.marginPct.toFixed(1))
            ]);
        });

        marginData.push([]);
        marginData.push([
            '', 'TOTAL F&B',
            productMargins.reduce((sum, p) => sum + p.qtySold, 0),
            '',
            '',
            Math.round(totalRevenue),
            Math.round(totalHPP),
            Math.round(totalProfit),
            totalRevenue > 0 ? parseFloat(((totalProfit / totalRevenue) * 100).toFixed(1)) : 0
        ]);

        const wsMargin = XLSX.utils.aoa_to_sheet(marginData);
        wsMargin['!cols'] = [
            { wch: 4 }, { wch: 30 }, { wch: 16 }, { wch: 22 }, { wch: 18 },
            { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }
        ];
        XLSX.utils.book_append_sheet(wb, wsMargin, 'Margin Produk');

        // Sheet 2: Pemakaian Bahan Baku
        const ingredientData = [
            [`LAPORAN PEMAKAIAN BAHAN BAKU F&B - ${storeName.toUpperCase()}`],
            [`Periode: ${periodLabel}   |   Dicetak: ${printDate}`],
            [],
            ['No', 'Nama Bahan Baku', 'Jumlah Terpakai', 'Satuan', 'Harga Satuan (Rp)', 'Total Biaya Bahan (Rp)'],
        ];

        ingredientUsage.forEach((ing, idx) => {
            ingredientData.push([
                idx + 1,
                ing.name,
                parseFloat(ing.quantityUsed.toFixed(3)),
                ing.unit,
                Math.round(ing.buyPrice),
                Math.round(ing.totalCost)
            ]);
        });

        const totalIngCost = ingredientUsage.reduce((sum, i) => sum + i.totalCost, 0);
        ingredientData.push([]);
        ingredientData.push([
            '', 'TOTAL BIAYA BAHAN BAKU', '', '', '', Math.round(totalIngCost)
        ]);

        const wsIngredient = XLSX.utils.aoa_to_sheet(ingredientData);
        wsIngredient['!cols'] = [
            { wch: 4 }, { wch: 30 }, { wch: 16 }, { wch: 10 }, { wch: 18 }, { wch: 22 }
        ];
        XLSX.utils.book_append_sheet(wb, wsIngredient, 'Pemakaian Bahan');

        const fileName = `Laporan_FnB_${periodLabel}_${storeName}.xlsx`;
        const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        saveAndShareFile(fileName, base64Data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    };

    const handleExportFnBPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const storeName = localStorage.getItem('store_name') || 'Swift Kasir';
        const periodLabel = filterType === 'daily' ? selectedDate
            : filterType === 'monthly' ? selectedMonth
            : filterType === 'yearly' ? selectedYear
            : `${startDate} s/d ${endDate}`;
        const printDate = new Date().toLocaleString('id-ID');
        const rp = (v) => 'Rp ' + Math.round(v || 0).toLocaleString('id-ID');

        // Header
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('LAPORAN KHUSUS F&B & BAHAN BAKU', 14, 16);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text(`Toko : ${storeName}`, 14, 23);
        doc.text(`Periode : ${periodLabel}`, 14, 28);
        doc.text(`Dicetak : ${printDate}`, 14, 33);
        doc.setLineWidth(0.5);
        doc.line(14, 36, 283, 36);

        // Summary boxes
        const { ingredientUsage, productMargins, totalRevenue, totalHPP, totalProfit } = fnbStats;
        const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

        doc.setFontSize(8);
        [
            { label: 'Total Omset F&B', value: rp(totalRevenue), color: [6, 182, 212] },
            { label: 'Total HPP Bahan', value: rp(totalHPP), color: [239, 68, 68] },
            { label: 'Laba Kotor F&B', value: rp(totalProfit), color: [16, 185, 129] },
            { label: 'Margin Laba F&B', value: avgMargin + '%', color: [139, 92, 246] },
        ].forEach((b, i) => {
            const x = 14 + i * 68;
            doc.setFillColor(245, 245, 245);
            doc.roundedRect(x, 39, 65, 14, 2, 2, 'F');
            doc.setFont('helvetica', 'normal'); 
            doc.setTextColor(100); 
            doc.text(b.label, x + 3, 44);
            doc.setFont('helvetica', 'bold');   
            doc.setTextColor(b.color[0], b.color[1], b.color[2]);  
            doc.text(b.value, x + 3, 50);
        });

        // 1. Margin Table
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30);
        doc.text('1. Analisis Margin Penjualan Produk F&B', 14, 60);

        const marginHead = [['No', 'Nama Produk', 'Terjual', 'Harga Jual', 'HPP/Porsi', 'Total Omset', 'Total HPP', 'Laba Kotor', 'Margin %']];
        const marginBody = productMargins.map((p, idx) => {
            return [
                idx + 1,
                p.name,
                p.qtySold + ' porsi',
                rp(p.totalRevenue / p.qtySold),
                rp(p.portionHPP),
                rp(p.totalRevenue),
                rp(p.totalHPP),
                rp(p.profit),
                p.marginPct.toFixed(1) + '%'
            ];
        });
        marginBody.push([
            '', 'TOTAL F&B', 
            productMargins.reduce((sum, p) => sum + p.qtySold, 0) + ' porsi', 
            '', '', 
            rp(totalRevenue), 
            rp(totalHPP), 
            rp(totalProfit), 
            avgMargin + '%'
        ]);

        autoTable(doc, {
            startY: 63,
            head: marginHead,
            body: marginBody,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [6, 182, 212], textColor: 255, fontStyle: 'bold' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 8 },
                1: { cellWidth: 55 },
                2: { halign: 'center' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right' },
                7: { halign: 'right' },
                8: { halign: 'center' }
            },
            didParseCell: (data) => {
                if (data.row.index === marginBody.length - 1) {
                    data.cell.styles.fillColor = [224, 242, 254];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        // 2. Ingredient Usage Table
        const nextY = doc.lastAutoTable.finalY + 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30);
        doc.text('2. Laporan Pemakaian Bahan Baku', 14, nextY);

        const ingHead = [['No', 'Nama Bahan Baku', 'Jumlah Terpakai', 'Harga Satuan (HPP)', 'Total Biaya Bahan']];
        const ingBody = ingredientUsage.map((ing, idx) => {
            return [
                idx + 1,
                ing.name,
                formatUnitQty(ing.quantityUsed, ing.unit),
                `${rp(ing.buyPrice)} / ${ing.unit}`,
                rp(ing.totalCost)
            ];
        });
        const totalIngCost = ingredientUsage.reduce((sum, i) => sum + i.totalCost, 0);
        ingBody.push(['', 'TOTAL BIAYA BAHAN BAKU', '', '', rp(totalIngCost)]);

        autoTable(doc, {
            startY: nextY + 3,
            head: ingHead,
            body: ingBody,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [168, 85, 247], textColor: 255, fontStyle: 'bold' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 8 },
                1: { cellWidth: 70 },
                2: { halign: 'left' },
                3: { halign: 'right' },
                4: { halign: 'right' }
            },
            didParseCell: (data) => {
                if (data.row.index === ingBody.length - 1) {
                    data.cell.styles.fillColor = [243, 232, 255];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        // Page numbers
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i); 
            doc.setFontSize(7); 
            doc.setTextColor(150);
            doc.text(`Halaman ${i} dari ${pageCount}  |  ${storeName}  |  Laporan Khusus F&B`,
                doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 8, { align: 'center' });
        }

        const fileName = `Laporan_FnB_${periodLabel}_${storeName}.pdf`;
        const base64Data = doc.output('datauristring').split(',')[1];
        saveAndShareFile(fileName, base64Data, 'application/pdf');
    };

    const handleExport = () => {
        const wb = XLSX.utils.book_new();
        const now = new Date();
        const printDate = now.toLocaleString('id-ID');

        // ── Ambil nama toko dari localStorage jika tersimpan
        const storeName = localStorage.getItem('store_name') || 'Swift Kasir';
        const periodLabel = filterType === 'daily' ? selectedDate
            : filterType === 'monthly' ? selectedMonth
            : selectedYear;

        if (view === 'sales') {
            // ─────────────────────────────────────────────
            // LAPORAN PENJUALAN
            // ─────────────────────────────────────────────
            const wsData = [
                [`LAPORAN PENJUALAN - ${storeName.toUpperCase()}`],
                [`Periode: ${periodLabel}   |   Dicetak: ${printDate}`],
                [], // baris kosong
                // Header kolom
                ['No', 'Tanggal', 'Jam', 'Detail Item', 'Qty Total', 'Metode Bayar', 'Diskon (Rp)', 'Total (Rp)', 'Profit (Rp)'],
            ];

            let totalOmzet = 0, totalProfit = 0, totalDiskon = 0;

            transactions.forEach((t, idx) => {
                let items = t.items;
                if (typeof items === 'string') try { items = JSON.parse(items); } catch { items = []; }

                const detailItem = Array.isArray(items)
                    ? items.map(i => `${i.name} x${i.qty}`).join(', ')
                    : '-';
                const qtyTotal = Array.isArray(items)
                    ? items.reduce((a, i) => a + (i.qty || 0), 0)
                    : 0;
                const diskon = t.discount || 0;
                const total  = t.total   || 0;
                const profit = t.profit  || 0;

                totalOmzet  += total;
                totalProfit += profit;
                totalDiskon += diskon;

                wsData.push([
                    idx + 1,
                    new Date(t.date).toLocaleDateString('id-ID'),
                    new Date(t.date).toLocaleTimeString('id-ID'),
                    detailItem,
                    qtyTotal,
                    (t.paymentMethod || 'cash').toUpperCase(),
                    diskon,   // angka murni
                    total,    // angka murni
                    profit,   // angka murni
                ]);
            });

            // Baris TOTAL
            wsData.push([]);
            wsData.push([
                '', '', '', `TOTAL (${transactions.length} transaksi)`, '',
                '', totalDiskon, totalOmzet, totalProfit
            ]);

            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Lebar kolom
            ws['!cols'] = [
                {wch:4}, {wch:14}, {wch:10}, {wch:40}, {wch:8},
                {wch:12}, {wch:14}, {wch:14}, {wch:14}
            ];

            XLSX.utils.book_append_sheet(wb, ws, 'Laporan Penjualan');

        } else {
            // ─────────────────────────────────────────────
            // LAPORAN PER ITEM
            // ─────────────────────────────────────────────
            const wsData = [
                [`LAPORAN PER ITEM - ${storeName.toUpperCase()}`],
                [`Periode: ${periodLabel}   |   Dicetak: ${printDate}`],
                [],
                // Header
                ['No', 'Nama Barang', 'Harga Beli (Rp)', 'Harga Jual (Rp)', 'Margin %', 'Qty Terjual', 'HPP Total (Rp)', 'Omset (Rp)', 'Laba (Rp)'],
            ];

            let totalQty = 0, totalHPP = 0, totalOmzet = 0, totalLaba = 0;

            itemStats.forEach((item, idx) => {
                const hargaBeli = Math.round(item.avgCost);
                const hargaJual = Math.round(item.avgSellPrice);
                const marginPct = hargaJual > 0
                    ? parseFloat(((hargaJual - hargaBeli) / hargaJual * 100).toFixed(1))
                    : 0;

                totalQty    += item.qty;
                totalHPP    += item.totalCost;
                totalOmzet  += item.total;
                totalLaba   += item.margin;

                wsData.push([
                    idx + 1,
                    item.name,
                    hargaBeli,    // number
                    hargaJual,    // number
                    marginPct,    // number (persen)
                    item.qty,     // number
                    Math.round(item.totalCost),  // number
                    Math.round(item.total),      // number
                    Math.round(item.margin),     // number
                ]);
            });

            // Baris TOTAL
            wsData.push([]);
            wsData.push([
                '', `TOTAL (${itemStats.length} produk)`,
                '', '', '', totalQty, Math.round(totalHPP), Math.round(totalOmzet), Math.round(totalLaba)
            ]);

            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Lebar kolom
            ws['!cols'] = [
                {wch:4}, {wch:30}, {wch:16}, {wch:16}, {wch:10},
                {wch:12}, {wch:16}, {wch:16}, {wch:16}
            ];

            XLSX.utils.book_append_sheet(wb, ws, 'Laporan Per Item');
        }

        const fileName = `${view === 'sales' ? 'Penjualan' : 'PerItem'}_${periodLabel}_${storeName}.xlsx`;
        const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        saveAndShareFile(fileName, base64Data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    };

    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const storeName = localStorage.getItem('store_name') || 'Swift Kasir';
        const periodLabel = filterType === 'daily' ? selectedDate
            : filterType === 'monthly' ? selectedMonth
            : selectedYear;
        const printDate = new Date().toLocaleString('id-ID');
        const rp = (v) => 'Rp ' + Math.round(v || 0).toLocaleString('id-ID');

        // ── Header
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(view === 'sales' ? 'LAPORAN PENJUALAN' : 'LAPORAN BARANG / ITEM', 14, 16);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text(`Toko : ${storeName}`, 14, 23);
        doc.text(`Periode : ${periodLabel}`, 14, 28);
        doc.text(`Dicetak : ${printDate}`, 14, 33);
        doc.setLineWidth(0.5);
        doc.line(14, 36, 283, 36);

        if (view === 'items') {
            const totalQty   = itemStats.reduce((a, i) => a + i.qty, 0);
            const totalOmzet = itemStats.reduce((a, i) => a + i.total, 0);
            const totalLaba  = itemStats.reduce((a, i) => a + i.margin, 0);
            const avgMargin  = totalOmzet > 0 ? ((totalLaba / totalOmzet) * 100).toFixed(1) : 0;

            // Summary boxes
            doc.setFontSize(8);
            [{ label: 'Total Produk', value: itemStats.length + ' item' },
             { label: 'Total Qty',    value: totalQty + ' pcs' },
             { label: 'Total Omzet', value: rp(totalOmzet) },
             { label: 'Total Laba',  value: rp(totalLaba) },
             { label: 'Avg Margin',  value: avgMargin + '%' },
            ].forEach((b, i) => {
                const x = 14 + i * 54;
                doc.setFillColor(240, 248, 255);
                doc.roundedRect(x, 39, 52, 14, 2, 2, 'F');
                doc.setFont('helvetica', 'normal'); doc.setTextColor(100); doc.text(b.label, x+3, 44);
                doc.setFont('helvetica', 'bold');   doc.setTextColor(30);  doc.text(b.value, x+3, 50);
            });

            const head = [['No','Nama Barang','Harga Beli','Harga Jual','Margin %','Qty Terjual','HPP Total','Omzet','Laba']];
            const body = itemStats.map((item, idx) => {
                const hb = Math.round(item.avgCost), hj = Math.round(item.avgSellPrice);
                const m  = hj > 0 ? ((hj - hb) / hj * 100).toFixed(1) : 0;
                return [idx+1, item.name, rp(hb), rp(hj), m+'%', item.qty+' pcs', rp(item.totalCost), rp(item.total), rp(item.margin)];
            });
            body.push(['','TOTAL','','','', totalQty+' pcs',
                rp(itemStats.reduce((a,i)=>a+i.totalCost,0)), rp(totalOmzet), rp(totalLaba)]);

            autoTable(doc, {
                startY: 56, head, body,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 0: { halign:'center', cellWidth:8 }, 1: { cellWidth:55 }, 4: { halign:'center' }, 5: { halign:'center' } },
                didParseCell: (data) => {
                    if (data.row.index === body.length - 1) { data.cell.styles.fillColor = [219,234,254]; data.cell.styles.fontStyle = 'bold'; }
                    if (data.column.index === 4 && data.section === 'body') {
                        const pct = parseFloat(data.cell.raw);
                        if (pct < 10) data.cell.styles.textColor = [220,38,38];
                        else if (pct >= 20) data.cell.styles.textColor = [22,163,74];
                    }
                },
            });
            const fy = doc.lastAutoTable.finalY + 5;
            doc.setFontSize(7); doc.setTextColor(150);
            doc.text('* Margin merah = di bawah 10% (perlu evaluasi harga). Hijau = 20%+ (bagus).', 14, fy);

        } else {
            const totalOmzet  = transactions.reduce((a,t) => a+(t.total   ||0), 0);
            const totalProfit = transactions.reduce((a,t) => a+(t.profit  ||0), 0);
            const totalDiskon = transactions.reduce((a,t) => a+(t.discount||0), 0);

            doc.setFontSize(8);
            [{ label:'Total Transaksi', value: transactions.length+' trx' },
             { label:'Total Diskon',    value: rp(totalDiskon) },
             { label:'Total Omzet',     value: rp(totalOmzet)  },
             { label:'Total Profit',    value: rp(totalProfit) },
            ].forEach((b, i) => {
                const x = 14 + i * 68;
                doc.setFillColor(240,255,248);
                doc.roundedRect(x, 39, 65, 14, 2, 2, 'F');
                doc.setFont('helvetica','normal'); doc.setTextColor(100); doc.text(b.label, x+3, 44);
                doc.setFont('helvetica','bold');   doc.setTextColor(30);  doc.text(b.value, x+3, 50);
            });

            const head = [['No','Tanggal','Jam','Detail Item','Qty','Metode Bayar','Diskon','Total','Profit']];
            const body = transactions.map((t, idx) => {
                let items = t.items;
                if (typeof items === 'string') try { items = JSON.parse(items); } catch { items = []; }
                const detail = Array.isArray(items) ? items.map(i=>`${i.name} x${i.qty}`).join(', ') : '-';
                const qty    = Array.isArray(items) ? items.reduce((a,i)=>a+(i.qty||0),0) : 0;
                return [idx+1, new Date(t.date).toLocaleDateString('id-ID'), new Date(t.date).toLocaleTimeString('id-ID'),
                    detail, qty, (t.paymentMethod||'cash').toUpperCase(), rp(t.discount), rp(t.total), rp(t.profit)];
            });
            body.push(['',`TOTAL (${transactions.length} trx)`,'','','','', rp(totalDiskon), rp(totalOmzet), rp(totalProfit)]);

            autoTable(doc, {
                startY: 56, head, body,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [5,150,105], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 0: { halign:'center', cellWidth:8 }, 3: { cellWidth:70 } },
                didParseCell: (data) => {
                    if (data.row.index === body.length - 1) { data.cell.styles.fillColor = [209,250,229]; data.cell.styles.fontStyle = 'bold'; }
                },
            });
        }

        // Nomor halaman
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150);
            doc.text(`Halaman ${i} dari ${pageCount}  |  ${storeName}  |  ${printDate}`,
                doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 8, { align: 'center' });
        }
        const fileName = `${view === 'sales' ? 'Penjualan' : 'PerItem'}_${periodLabel}_${storeName}.pdf`;
        const base64Data = doc.output('datauristring').split(',')[1];
        saveAndShareFile(fileName, base64Data, 'application/pdf');
    };

    // ── Laporan Stok PDF ──
    const handleStockPDF = () => {
        const storeName = localStorage.getItem('store_name') || 'Swift Kasir';
        const printDate = new Date().toLocaleString('id-ID');

        // Hitung terakhir restok per produk dari data purchases
        const lastRestok = {};
        purchases.forEach(pur => {
            let items = pur.items;
            if (typeof items === 'string') try { items = JSON.parse(items); } catch { items = []; }
            if (!Array.isArray(items)) return;
            items.forEach(i => {
                if (!lastRestok[i.id] || new Date(pur.date) > new Date(lastRestok[i.id].date)) {
                    lastRestok[i.id] = { date: pur.date, qty: i.qty };
                }
            });
        });

        let list = products.map(p => ({
            ...p,
            lastRestokDate: lastRestok[p.id]?.date || null,
            lastRestokQty:  lastRestok[p.id]?.qty  || 0,
        })).sort((a, b) => a.stock - b.stock); // urut stok terendah dulu

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // Header
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text('FORM CEK FISIK STOK BARANG', 14, 16);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text(`Toko : ${storeName}`, 14, 23);
        doc.text(`Tanggal Cetak : ${printDate}`, 14, 28);
        doc.text('Nama Karyawan : ___________________________     Tanda Tangan : ________________', 14, 34);
        doc.setLineWidth(0.5); doc.line(14, 37, 196, 37);

        doc.setFontSize(8); doc.setTextColor(180, 0, 0);
        doc.text(`Menampilkan semua ${list.length} barang. Baris berwarna menandakan perlu restok.`, 14, 42);
        doc.setTextColor(0);

        const head = [['No', 'Nama Barang', 'Stok Sistem', 'Terakhir Restok', 'Qty Restok', 'Stok Fisik (Isi)', 'Selisih', 'Ket.']];
        const body = list.map((p, i) => [
            i + 1,
            p.name,
            p.stock,
            p.lastRestokDate ? new Date(p.lastRestokDate).toLocaleDateString('id-ID') : '-',
            p.lastRestokQty > 0 ? p.lastRestokQty + ' pcs' : '-',
            '', // diisi manual karyawan
            '', // selisih diisi manual
            p.stock <= 5 ? '⚠ HABIS' : p.stock <= 10 ? '⚡ RENDAH' : '',
        ]);

        autoTable(doc, {
            startY: 46,
            head, body,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 8 },
                1: { cellWidth: 60 },
                2: { halign: 'center', cellWidth: 18 },
                3: { cellWidth: 26 },
                4: { halign: 'center', cellWidth: 18 },
                5: { cellWidth: 22 }, // kolom isi manual
                6: { cellWidth: 18 }, // selisih manual
                7: { cellWidth: 16 },
            },
            didParseCell: (data) => {
                if (data.section === 'body') {
                    const row = list[data.row.index];
                    if (row && row.stock <= 5) data.cell.styles.fillColor = [254, 226, 226];
                    else if (row && row.stock <= 10) data.cell.styles.fillColor = [254, 243, 199];
                }
            },
        });

        const fy = doc.lastAutoTable.finalY + 6;
        doc.setFontSize(7); doc.setTextColor(120);
        doc.text('Keterangan: ⚠ HABIS = stok ≤ 5 (wajib restok segera) | ⚡ RENDAH = stok ≤ 10 (perlu perhatian)', 14, fy);
        doc.text('Kolom "Stok Fisik" diisi oleh karyawan berdasarkan hitungan fisik di gudang/toko.', 14, fy + 4);

        // Footer halaman
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150);
            doc.text(`Hal ${i}/${pageCount}  |  ${storeName}  |  ${printDate}`,
                doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 8, { align: 'center' });
        }

        const fileName = `CekFisik_SemuaBarang_${storeName}_${new Date().toISOString().split('T')[0]}.pdf`;
        const base64Data = doc.output('datauristring').split(',')[1];
        saveAndShareFile(fileName, base64Data, 'application/pdf');
    };

    if (view === 'menu') {
        return (
            <div className="page-container">
                <h1>Laporan</h1>
                <p className="text-muted">Pilih jenis laporan yang ingin ditampilkan.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
                    <div className="card" onClick={() => setView('items')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                        <div style={{ background: '#e0f2fe', padding: 10, borderRadius: 12, color: '#0284c7', flexShrink: 0 }}>
                            <Package size={26} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: 0, marginBottom: 4, fontSize: 15 }}>Laporan Per Item</h3>
                            <div className="text-muted" style={{ fontSize: 12 }}>Detail penjualan per barang</div>
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: 20 }}>›</span>
                    </div>

                    <div className="card" onClick={() => setView('sales')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                        <div style={{ background: '#dcfce7', padding: 10, borderRadius: 12, color: '#16a34a', flexShrink: 0 }}>
                            <FileText size={26} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: 0, marginBottom: 4, fontSize: 15 }}>Laporan Penjualan</h3>
                            <div className="text-muted" style={{ fontSize: 12 }}>Rekap transaksi & omset harian</div>
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: 20 }}>›</span>
                    </div>

                    <div className="card" onClick={() => setView('fnb')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                        <div style={{ background: '#ecfeff', padding: 10, borderRadius: 12, color: '#0891b2', flexShrink: 0 }}>
                            <span style={{ fontSize: 22 }}>🌿</span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: 0, marginBottom: 4, fontSize: 15 }}>Laporan F&B & Bahan Baku</h3>
                            <div className="text-muted" style={{ fontSize: 12 }}>Analisis resep HPP & pemakaian bahan</div>
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: 20 }}>›</span>
                    </div>

                    <div className="card" onClick={() => setView('stock')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                        <div style={{ background: '#fef3c7', padding: 10, borderRadius: 12, color: '#d97706', flexShrink: 0 }}>
                            <TrendingUp size={26} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: 0, marginBottom: 4, fontSize: 15 }}>Laporan Stok & Restok</h3>
                            <div className="text-muted" style={{ fontSize: 12 }}>Cek stok barang & form fisik karyawan</div>
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: 20 }}>›</span>
                    </div>

                    <div className="card" onClick={() => setView('payment')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                        <div style={{ background: '#f0fdf4', padding: 10, borderRadius: 12, color: '#16a34a', flexShrink: 0 }}>
                            <span style={{ fontSize: 22 }}>📱</span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: 0, marginBottom: 4, fontSize: 15 }}>Rekap QRIS vs Tunai</h3>
                            <div className="text-muted" style={{ fontSize: 12 }}>Perbandingan metode pembayaran</div>
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: 20 }}>›</span>
                    </div>

                    <div className="card" onClick={() => setView('opname')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                        <div style={{ background: '#fef3c7', padding: 10, borderRadius: 12, color: '#92400e', flexShrink: 0 }}>
                            <span style={{ fontSize: 22 }}>📋</span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: 0, marginBottom: 4, fontSize: 15 }}>Laporan Selisih Stock Opname</h3>
                            <div className="text-muted" style={{ fontSize: 12 }}>Hasil audit stok fisik vs sistem</div>
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: 20 }}>›</span>
                    </div>

                    <div className="card" onClick={() => setView('shift')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                        <div style={{ background: '#ede9fe', padding: 10, borderRadius: 12, color: '#7c3aed', flexShrink: 0 }}>
                            <span style={{ fontSize: 22 }}>⏱️</span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: 0, marginBottom: 4, fontSize: 15 }}>Riwayat Shift</h3>
                            <div className="text-muted" style={{ fontSize: 12 }}>Detail omset & kas tiap shift</div>
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: 20 }}>›</span>
                    </div>
                </div>
            </div>
        );
    }

    // ── STOCK VIEW ───────────────────────────────
    if (view === 'stock') {
        // Hitung lastRestok per produk
        const lastRestok = {};
        purchases.forEach(pur => {
            let items = pur.items;
            if (typeof items === 'string') try { items = JSON.parse(items); } catch { items = []; }
            if (!Array.isArray(items)) return;
            items.forEach(i => {
                if (!lastRestok[i.id] || new Date(pur.date) > new Date(lastRestok[i.id].date)) {
                    lastRestok[i.id] = { date: pur.date, qty: i.qty };
                }
            });
        });
        const stockList = products.map(p => ({
            ...p,
            lastRestokDate: lastRestok[p.id]?.date || null,
            lastRestokQty:  lastRestok[p.id]?.qty  || 0,
        })).sort((a, b) => a.stock - b.stock);
        const lowCount = stockList.filter(p => p.stock <= 10).length;

        return (
            <div className="page-container">
                <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
                    <button className="btn-icon" onClick={() => setView('menu')} style={{ background: 'transparent', border: '1px solid var(--border-color)' }}>
                        <ChevronLeft size={20} />
                    </button>
                    <h1 style={{ margin: 0 }}>Laporan Stok & Restok</h1>
                </div>

                {/* Info & tombol download */}
                <div className="card" style={{ marginBottom: 14, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{products.length} total barang</div>
                            <div style={{ fontSize: 12, color: 'var(--error)', marginTop: 2 }}>
                                ⚠ {lowCount} barang stok rendah (≤10)
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button className="btn" onClick={() => handleStockPDF()}
                                style={{ background: 'var(--primary)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, width: 'auto' }}>
                                <FileText size={14} /> Download PDF Cek Fisik
                            </button>
                        </div>
                    </div>
                </div>

                {/* Preview daftar */}
                {stockList.map((p, i) => (
                    <div key={p.id} className="card" style={{
                        marginBottom: 6, padding: '10px 14px',
                        borderLeft: `3px solid ${p.stock <= 5 ? 'var(--error)' : p.stock <= 10 ? 'var(--warning-text)' : 'var(--success)'}`
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 22, flexShrink: 0 }}>{i+1}.</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                    Restok terakhir: {p.lastRestokDate ? new Date(p.lastRestokDate).toLocaleDateString('id-ID') : 'Belum pernah'}
                                    {p.lastRestokQty > 0 && ` (+${p.lastRestokQty} pcs)`}
                                </div>
                            </div>
                            <span style={{
                                fontWeight: 800, fontSize: 16, flexShrink: 0,
                                color: p.stock <= 5 ? 'var(--error)' : p.stock <= 10 ? 'var(--warning-text)' : 'var(--success)'
                            }}>{p.stock}</span>
                            <span style={{ fontSize: 10, flexShrink: 0, color: 'var(--text-muted)' }}>pcs</span>
                            {p.stock <= 10 ? (
                                <span style={{ fontSize: 10, background: 'var(--error-bg)', color: 'var(--error-text)', padding: '4px 8px', borderRadius: 4, flexShrink: 0, fontWeight: 'bold' }}>
                                    RESTOK
                                </span>
                            ) : (
                                <span style={{ fontSize: 10, background: 'var(--success-bg)', color: 'var(--success-text)', padding: '4px 8px', borderRadius: 4, flexShrink: 0, fontWeight: 'bold' }}>
                                    AMAN
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Route view baru
    if (view === 'payment') {
        return <PaymentRekapView filterType={filterType} selectedDate={selectedDate} selectedMonth={selectedMonth} selectedYear={selectedYear} onBack={() => setView('menu')} />;
    }
    if (view === 'opname') {
        return <OpnameDiffView opnameHistory={opnameHistory} onBack={() => setView('menu')} />;
    }
    if (view === 'shift') {
        return <ShiftHistoryView shifts={shifts} onBack={() => setView('menu')} />;
    }
    if (view === 'fnb') {
        const { ingredientUsage, productMargins, totalRevenue, totalHPP, totalProfit } = fnbStats;
        const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;
        
        return (
            <div className="page-container">
                <div className="flex items-center gap-2" style={{ marginBottom: 24 }}>
                    <button className="btn-icon" onClick={() => setView('menu')} style={{ background: 'transparent', border: '1px solid var(--border-color)' }}>
                        <ChevronLeft size={20} />
                    </button>
                    <h1 style={{ margin: 0 }}>Laporan F&B & Bahan Baku</h1>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        <button
                            className="btn"
                            style={{ width: 'auto', padding: '8px 12px', background: 'var(--error)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}
                            onClick={handleExportFnBPDF}
                            title="Download PDF"
                        >
                            <FileText size={15} /> PDF
                        </button>
                        <button
                            className="btn btn-success"
                            style={{ width: 'auto', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}
                            onClick={handleExportFnBExcel}
                            title="Download Excel"
                        >
                            <Download size={15} /> Excel
                        </button>
                    </div>
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
                              <option value="range">Rentang Tanggal</option>
                          </select>
                        </div>

                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label>Pilih Periode</label>
                          {filterType === 'daily' && (
                              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                          )}
                          {filterType === 'monthly' && (
                              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                          )}
                          {filterType === 'yearly' && (
                              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                                  {[0, 1, 2, 3, 4].map(i => {
                                      const y = new Date().getFullYear() - i;
                                      return <option key={y} value={y}>{y}</option>
                                  })}
                              </select>
                          )}
                          {filterType === 'range' && (
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                  <span className="text-muted" style={{ fontSize: 13 }}>s/d</span>
                                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                              </div>
                          )}
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                    <div className="card" style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: 'white' }}>
                        <div style={{ opacity: 0.9, fontSize: 13 }}>Omset Penjualan F&B</div>
                        <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>Rp {totalRevenue.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="card" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white' }}>
                        <div style={{ opacity: 0.9, fontSize: 13 }}>Total HPP Bahan Baku</div>
                        <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>Rp {totalHPP.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="card" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}>
                        <div style={{ opacity: 0.9, fontSize: 13 }}>Laba Kotor F&B</div>
                        <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>Rp {totalProfit.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="card" style={{ background: 'linear-gradient(135deg, #a855f7, #9333ea)', color: 'white' }}>
                        <div style={{ opacity: 0.9, fontSize: 13 }}>Margin Laba Kotor F&B</div>
                        <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>{avgMargin}%</div>
                    </div>
                </div>

                {/* Tables stack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Table 1: Margin Produk */}
                    <div className="card" style={{ padding: 18 }}>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ background: '#ecfeff', color: '#0891b2', padding: '4px 8px', borderRadius: 8, fontSize: 14 }}>📈</span>
                            Analisis Margin Penjualan Produk F&B
                        </h3>
                        <p className="text-muted" style={{ margin: '0 0 16px 0', fontSize: 12 }}>Detail margin keuntungan berdasarkan HPP resep aktual</p>
                        
                        <div className="table-container" style={{ margin: 0 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                                <thead>
                                    <tr className="table-header-row">
                                        <th style={{ padding: 12 }}>Produk</th>
                                        <th style={{ padding: 12, textAlign: 'center' }}>Terjual</th>
                                        <th style={{ padding: 12, textAlign: 'right' }}>Harga Jual</th>
                                        <th style={{ padding: 12, textAlign: 'right' }}>HPP / Porsi</th>
                                        <th style={{ padding: 12, textAlign: 'right' }}>Omset</th>
                                        <th style={{ padding: 12, textAlign: 'right' }}>Laba Kotor</th>
                                        <th style={{ padding: 12, textAlign: 'center' }}>Margin %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productMargins.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                                                Tidak ada penjualan produk F&B pada periode ini
                                            </td>
                                        </tr>
                                    ) : (
                                        productMargins.map((p, idx) => (
                                            <tr key={idx} className="table-row">
                                                <td style={{ padding: 12, fontWeight: 500 }}>{p.name}</td>
                                                <td style={{ padding: 12, textAlign: 'center' }}>{p.qtySold}</td>
                                                <td style={{ padding: 12, textAlign: 'right', fontSize: 13 }}>Rp {Math.round(p.totalRevenue / p.qtySold).toLocaleString('id-ID')}</td>
                                                <td style={{ padding: 12, textAlign: 'right', fontSize: 13 }}>Rp {Math.round(p.portionHPP).toLocaleString('id-ID')}</td>
                                                <td style={{ padding: 12, textAlign: 'right', fontSize: 13 }}>Rp {p.totalRevenue.toLocaleString('id-ID')}</td>
                                                <td style={{ padding: 12, textAlign: 'right', fontSize: 13, color: 'var(--success)' }}>Rp {p.profit.toLocaleString('id-ID')}</td>
                                                <td style={{ padding: 12, textAlign: 'center' }}>
                                                    <span style={{ 
                                                        background: p.marginPct >= 20 ? 'var(--success-bg)' : p.marginPct >= 10 ? 'var(--warning-bg)' : 'var(--error-bg)',
                                                        color: p.marginPct >= 20 ? 'var(--success-text)' : p.marginPct >= 10 ? 'var(--warning-text)' : 'var(--error-text)',
                                                        padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 'bold'
                                                    }}>
                                                        {p.marginPct.toFixed(1)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Table 2: Pemakaian Bahan Baku */}
                    <div className="card" style={{ padding: 18 }}>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ background: '#f3e8ff', color: '#9333ea', padding: '4px 8px', borderRadius: 8, fontSize: 14 }}>🌿</span>
                            Laporan Pemakaian Bahan Baku
                        </h3>
                        <p className="text-muted" style={{ margin: '0 0 16px 0', fontSize: 12 }}>Akumulasi bahan baku yang terpakai untuk membuat pesanan</p>

                        <div className="table-container" style={{ margin: 0 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                                <thead>
                                    <tr className="table-header-row">
                                        <th style={{ padding: 12 }}>Bahan Baku</th>
                                        <th style={{ padding: 12, textAlign: 'left' }}>Jumlah Terpakai</th>
                                        <th style={{ padding: 12, textAlign: 'right' }}>Harga Satuan (HPP)</th>
                                        <th style={{ padding: 12, textAlign: 'right' }}>Total Biaya Bahan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ingredientUsage.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                                                Tidak ada bahan baku yang digunakan pada periode ini
                                            </td>
                                        </tr>
                                    ) : (
                                        ingredientUsage.map((ing, idx) => (
                                            <tr key={idx} className="table-row">
                                                <td style={{ padding: 12, fontWeight: 500 }}>{ing.name}</td>
                                                <td style={{ padding: 12, textAlign: 'left' }}>{formatUnitQty(ing.quantityUsed, ing.unit)}</td>
                                                <td style={{ padding: 12, textAlign: 'right', fontSize: 13 }}>Rp {ing.buyPrice.toLocaleString('id-ID')} / {ing.unit}</td>
                                                <td style={{ padding: 12, textAlign: 'right', fontSize: 13, fontWeight: 'bold' }}>Rp {Math.round(ing.totalCost).toLocaleString('id-ID')}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="flex items-center gap-2" style={{ marginBottom: 24 }}>
                <button className="btn-icon" onClick={() => setView('menu')} style={{ background: 'transparent', border: '1px solid var(--border-color)' }}>
                    <ChevronLeft size={20} />
                </button>
                <h1 style={{ margin: 0 }}>{view === 'sales' ? 'Laporan Penjualan' : 'Laporan Per Item'}</h1>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button
                        className="btn"
                        style={{ width: 'auto', padding: '8px 12px', background: 'var(--error)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}
                        onClick={handleExportPDF}
                        title="Download PDF"
                    >
                        <FileText size={15} /> PDF
                    </button>
                    <button
                        className="btn btn-success"
                        style={{ width: 'auto', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}
                        onClick={handleExport}
                        title="Download Excel"
                    >
                        <Download size={15} /> Excel
                    </button>
                </div>
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
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                        )}
                        {filterType === 'monthly' && (
                            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
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

            {view === 'sales' && (
                <>
                    <div className="grid-2" style={{ marginBottom: 20 }}>
                        <div className="card" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white' }}>
                            <div style={{ opacity: 0.9, fontSize: 13 }}>Total Omset</div>
                            <div style={{ fontSize: 24, fontWeight: 'bold' }}>Rp {stats.total.toLocaleString('id-ID')}</div>
                        </div>
                        <div className="card" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}>
                            <div style={{ opacity: 0.9, fontSize: 13 }}>Total Profit</div>
                            <div style={{ fontSize: 24, fontWeight: 'bold' }}>Rp {stats.profit.toLocaleString('id-ID')}</div>
                        </div>
                    </div>

                    <div className="table-container">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                            <thead>
                                <tr className="table-header-row">
                                    <th style={{ padding: 12 }}>Waktu</th>
                                    <th style={{ padding: 12 }}>Items</th>
                                    <th style={{ padding: 12, textAlign: 'right' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(t => (
                                    <tr key={t.id} className="table-row">
                                        <td style={{ padding: 12 }}>
                                            {new Date(t.date).toLocaleDateString('id-ID')}<br />
                                            <span className="text-muted" style={{ fontSize: 12 }}>{new Date(t.date).toLocaleTimeString('id-ID')}</span>
                                        </td>
                                        <td style={{ padding: 12 }}>
                                            {t.items.length} Item
                                        </td>
                                        <td style={{ padding: 12, textAlign: 'right', fontWeight: 'bold' }}>
                                            Rp {t.total.toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {view === 'items' && (
                <>
                    <div className="card" style={{ marginBottom: 20 }}>
                        <h3>Top Produk</h3>
                        <p className="text-muted">Total {itemStats.length} produk terjual.</p>
                    </div>
                    <div className="table-container">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                            <thead>
                                <tr className="table-header-row">
                                    <th style={{ padding: 12, width: '30%' }}>Produk</th>
                                    <th style={{ padding: 12, textAlign: 'right' }}>Harga Beli</th>
                                    <th style={{ padding: 12, textAlign: 'right' }}>Harga Jual</th>
                                    <th style={{ padding: 12, textAlign: 'center' }}>Terjual</th>
                                    <th style={{ padding: 12, textAlign: 'right' }}>Omset</th>
                                    <th style={{ padding: 12, textAlign: 'right' }}>Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {itemStats.map((i, idx) => (
                                    <tr key={idx} className="table-row">
                                        <td style={{ padding: 12, fontWeight: 500 }}>{i.name}</td>
                                        <td style={{ padding: 12, textAlign: 'right', fontSize: 13 }}>Rp {Math.round(i.avgCost).toLocaleString('id-ID')}</td>
                                        <td style={{ padding: 12, textAlign: 'right', fontSize: 13 }}>Rp {Math.round(i.avgSellPrice).toLocaleString('id-ID')}</td>
                                        <td style={{ padding: 12, textAlign: 'center' }}>{i.qty}</td>
                                        <td style={{ padding: 12, textAlign: 'right' }}>Rp {Math.round(i.total).toLocaleString('id-ID')}</td>
                                        <td style={{ padding: 12, textAlign: 'right', color: 'var(--success)' }}>Rp {Math.round(i.margin).toLocaleString('id-ID')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );

    // Route new views — dipindah setelah return utama biar tidak error, pakai helper
};

// Helper: ambil inner component berdasarkan view
const RouteView = ({ view, ...props }) => {
    if (view === 'payment') return <PaymentRekapView {...props} />;
    if (view === 'opname') return <OpnameDiffView {...props} />;
    if (view === 'shift') return <ShiftHistoryView {...props} />;
    return null;
};


// ─── VIEW: REKAP QRIS vs TUNAI ──────────────────────────────────────────────
const PaymentRekapView = ({ transactions, onBack, filterType, selectedDate, selectedMonth, selectedYear, loadData }) => {
    const rp = v => `Rp ${Math.round(v || 0).toLocaleString('id-ID')}`;
    const [localFilter, setLocalFilter] = useState(filterType || 'daily');
    const [localDate, setLocalDate] = useState(selectedDate);
    const [localMonth, setLocalMonth] = useState(selectedMonth);
    const [localYear, setLocalYear] = useState(selectedYear);
    const [trans, setTrans] = useState(transactions || []);

    const load = async () => {
        let param = localDate;
        if (localFilter === 'monthly') param = localMonth;
        if (localFilter === 'yearly') param = localYear;
        const t = await dbService.getTransactions(param);
        setTrans(t);
    };

    useEffect(() => { load(); }, [localFilter, localDate, localMonth, localYear]);

    const cash = trans.filter(t => (t.paymentMethod || 'cash') !== 'qris');
    const qris = trans.filter(t => t.paymentMethod === 'qris');
    const totalCash = cash.reduce((a, t) => a + (t.total || 0), 0);
    const totalQris = qris.reduce((a, t) => a + (t.total || 0), 0);
    const grandTotal = totalCash + totalQris;

    return (
        <div className="page-container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button className="btn-icon" onClick={onBack} style={{ background: 'transparent', border: '1px solid var(--border-color)' }}>
                    <ChevronLeft size={20} />
                </button>
                <h1 style={{ margin: 0 }}>Rekap QRIS vs Tunai</h1>
            </div>

            {/* Filter */}
            <div className="card" style={{ marginBottom: 16, padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="modern-select" style={{ fontSize: 13 }} value={localFilter} onChange={e => setLocalFilter(e.target.value)}>
                    <option value="daily">Harian</option>
                    <option value="monthly">Bulanan</option>
                    <option value="yearly">Tahunan</option>
                </select>
                {localFilter === 'daily' && <input type="date" value={localDate} onChange={e => setLocalDate(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)' }} />}
                {localFilter === 'monthly' && <input type="month" value={localMonth} onChange={e => setLocalMonth(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)' }} />}
            </div>

            {/* Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
                {[{icon:'💵',label:'Tunai',total:totalCash,count:cash.length,bg:'#16a34a'},{icon:'📱',label:'QRIS',total:totalQris,count:qris.length,bg:'#2563eb'},{icon:'💰',label:'Total',total:grandTotal,count:trans.length,bg:'#7c3aed'}].map(c => (
                    <div key={c.label} className="card" style={{ background: `linear-gradient(135deg,${c.bg},${c.bg}dd)`, color: 'white', textAlign: 'center', padding: '14px 10px' }}>
                        <div style={{ fontSize: 22 }}>{c.icon}</div>
                        <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>{c.label}</div>
                        <div style={{ fontWeight: 900, fontSize: 17, marginTop: 4 }}>{rp(c.total)}</div>
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{c.count} trx</div>
                    </div>
                ))}
            </div>

            {/* Progress */}
            {grandTotal > 0 && (
                <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Proporsi Pembayaran</div>
                    <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden' }}>
                        <div style={{ flex: totalCash / grandTotal, background: '#16a34a' }} />
                        <div style={{ flex: totalQris / grandTotal, background: '#2563eb' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>💵 Tunai: {Math.round(totalCash / grandTotal * 100)}%</span>
                        <span>📱 QRIS: {Math.round(totalQris / grandTotal * 100)}%</span>
                    </div>
                </div>
            )}

            {/* Tabel */}
            <div className="table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr className="table-header-row">
                        <th style={{ padding: '10px 12px' }}>Waktu</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Metode</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
                    </tr></thead>
                    <tbody>
                        {trans.map(t => (
                            <tr key={t.id} className="table-row">
                                <td style={{ padding: '8px 12px' }}>
                                    <div>{new Date(t.date).toLocaleDateString('id-ID')}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(t.date).toLocaleTimeString('id-ID')}</div>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                    <span style={{ background: t.paymentMethod === 'qris' ? '#dbeafe' : '#dcfce7', color: t.paymentMethod === 'qris' ? '#1d4ed8' : '#15803d', padding: '3px 10px', borderRadius: 20, fontWeight: 700, fontSize: 11 }}>
                                        {t.paymentMethod === 'qris' ? '📱 QRIS' : '💵 Tunai'}
                                    </span>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>Rp {(t.total || 0).toLocaleString('id-ID')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── VIEW: LAPORAN SELISIH STOCK OPNAME ────────────────────────────────────
const OpnameDiffView = ({ opnameHistory, onBack }) => {
    const withDiff = (opnameHistory || []).filter(o => o.difference !== 0);
    const totalLoss = (opnameHistory || []).reduce((a, o) => a + (o.difference < 0 ? Math.abs(o.difference) : 0), 0);
    const totalGain = (opnameHistory || []).reduce((a, o) => a + (o.difference > 0 ? o.difference : 0), 0);
    return (
        <div className="page-container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button className="btn-icon" onClick={onBack} style={{ background: 'transparent', border: '1px solid var(--border-color)' }}><ChevronLeft size={20} /></button>
                <h1 style={{ margin: 0 }}>Laporan Selisih Stock Opname</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Total Record', value: (opnameHistory||[]).length, color: 'var(--primary)' },
                    { label: 'Selisih Minus', value: `-${totalLoss}`, color: 'var(--error)' },
                    { label: 'Selisih Plus', value: `+${totalGain}`, color: 'var(--success)' },
                    { label: 'Ada Selisih', value: withDiff.length, color: 'var(--warning-text)' },
                ].map(c => (
                    <div key={c.label} className="card" style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.label}</div>
                        <div style={{ fontWeight: 900, fontSize: 24, color: c.color, marginTop: 4 }}>{c.value}</div>
                    </div>
                ))}
            </div>
            {(opnameHistory||[]).length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 32 }}>
                    <div style={{ fontSize: 40 }}>📋</div>
                    <div style={{ fontWeight: 700, marginTop: 12 }}>Belum ada data opname</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Lakukan stock opname dari menu Barang</div>
                </div>
            ) : (
                <div className="table-container">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr className="table-header-row">
                            <th style={{ padding: '10px 12px' }}>Barang</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center' }}>Sistem</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center' }}>Fisik</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center' }}>Selisih</th>
                            <th style={{ padding: '10px 12px' }}>Tanggal</th>
                        </tr></thead>
                        <tbody>
                            {(opnameHistory||[]).map(o => (
                                <tr key={o.id} className="table-row">
                                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{o.productName}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{o.systemStock}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{o.actualStock}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                        <span style={{ fontWeight: 800, color: o.difference < 0 ? 'var(--error)' : o.difference > 0 ? 'var(--success)' : 'var(--text-muted)', background: o.difference < 0 ? 'var(--error-bg)' : o.difference > 0 ? 'var(--success-bg)' : 'transparent', padding: '2px 10px', borderRadius: 8 }}>
                                            {o.difference > 0 ? '+' : ''}{o.difference}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{new Date(o.date).toLocaleDateString('id-ID')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── VIEW: RIWAYAT SHIFT ────────────────────────────────────────────────────
const ShiftHistoryView = ({ shifts, onBack }) => {
    const [expandedId, setExpandedId] = useState(null);
    const rp = v => `Rp ${Math.round(v || 0).toLocaleString('id-ID')}`;
    const fmt = d => d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
    const dur = (s, e) => { if (!s || !e) return '-'; const ms = new Date(e) - new Date(s); return `${Math.floor(ms / 3600000)}j ${Math.floor((ms % 3600000) / 60000)}m`; };
    const handleExportShift = () => {
        if (!shifts || shifts.length === 0) return;
        const wb = XLSX.utils.book_new();
        const wsData = [
            ['Waktu Mulai', 'Waktu Selesai', 'Durasi', 'Kas Awal', 'Omset Shift', 'Ekspektasi Kas', 'Kas Aktual', 'Selisih', 'Status']
        ];
        
        shifts.forEach(s => {
            const diff = (s.actualCash || 0) - (s.expectedCash || 0);
            const isOpen = s.status === 'open';
            const omset = (s.expectedCash || 0) - (s.initialCash || 0);
            wsData.push([
                fmt(s.startTime),
                isOpen ? '-' : fmt(s.endTime),
                dur(s.startTime, s.endTime),
                s.initialCash || 0,
                omset,
                s.expectedCash || 0,
                s.actualCash || 0,
                diff,
                isOpen ? 'Aktif' : 'Selesai'
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Shift');
        const fileName = `Riwayat_Shift_${new Date().toISOString().split('T')[0]}.xlsx`;
        const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        saveAndShareFile(fileName, base64Data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    };

    return (
        <div className="page-container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button className="btn-icon" onClick={onBack} style={{ background: 'transparent', border: '1px solid var(--border-color)' }}><ChevronLeft size={20} /></button>
                <h1 style={{ margin: 0 }}>Riwayat Shift</h1>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button
                        className="btn btn-success"
                        style={{ width: 'auto', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}
                        onClick={handleExportShift}
                        title="Download Excel"
                    >
                        <Download size={15} /> Excel
                    </button>
                </div>
            </div>
            {(shifts||[]).length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 32 }}>
                    <div style={{ fontSize: 40 }}>⏱️</div>
                    <div style={{ fontWeight: 700, marginTop: 12 }}>Belum ada riwayat shift</div>
                </div>
            ) : (shifts||[]).map(s => {
                const diff = (s.actualCash || 0) - (s.expectedCash || 0);
                const isOpen = s.status === 'open';
                const expanded = expandedId === s.id;
                return (
                    <div key={s.id} className="card" style={{ marginBottom: 10, cursor: 'pointer', overflow: 'hidden' }}
                        onClick={() => setExpandedId(expanded ? null : s.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>
                                    {fmt(s.startTime)}
                                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: isOpen ? 'var(--primary-bg)' : 'var(--bg-color)', color: isOpen ? 'var(--primary)' : 'var(--text-muted)' }}>
                                        {isOpen ? '🟢 AKTIF' : '🔴 SELESAI'}
                                    </span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Durasi: {dur(s.startTime, s.endTime)}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 900, color: 'var(--primary)', fontSize: 16 }}>{rp(s.expectedCash)}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ekspektasi Kas</div>
                            </div>
                        </div>
                        {expanded && (
                            <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 12 }}>
                                    {[
                                        { label: 'Kas Awal', value: rp(s.initialCash) },
                                        { label: 'Omset Shift', value: rp((s.expectedCash || 0) - (s.initialCash || 0)) },
                                        { label: 'Ekspektasi Kas', value: rp(s.expectedCash), color: 'var(--primary)' },
                                        { label: 'Kas Aktual', value: rp(s.actualCash) },
                                        { label: 'Selisih', value: (diff >= 0 ? '+' : '') + rp(diff), color: diff < 0 ? 'var(--error)' : 'var(--success)' },
                                        { label: 'Tutup Shift', value: fmt(s.endTime) },
                                    ].map(item => (
                                        <div key={item.label} style={{ background: 'var(--bg-color)', borderRadius: 8, padding: '8px 12px' }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.label}</div>
                                            <div style={{ fontWeight: 800, fontSize: 13, color: item.color || 'var(--text-main)', marginTop: 2 }}>{item.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ─── Main wrapper ────────────────────────────────────────────────────────────
const ReportPage = (props) => <ReportPageInner {...props} />;
export default ReportPage;
