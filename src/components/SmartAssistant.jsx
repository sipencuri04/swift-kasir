import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/DatabaseService';
import { Bot, Send, X, MessageSquare, ChevronDown, Sparkles, FileDown, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAndShareFile } from '../utils/exportHelper';

const SmartAssistant = ({ onClose }) => {
    const [messages, setMessages] = useState([
        { text: "Halo! Saya Asisten Pintar Swift Kasir. Saya bisa membantu menganalisis data toko Anda. Coba tanya: 'Berapa omset hari ini?', 'Barang apa yang stoknya menipis?', atau 'Apa barang paling laris?'", sender: 'bot' }
    ]);
    const [input, setInput] = useState('');
    const [botType, setBotType] = useState('offline');
    const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
    const [apiKey, setApiKey] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const savedBotType = localStorage.getItem('assistant_bot_type');
        const savedGeminiModel = localStorage.getItem('assistant_gemini_model');
        const savedApiKey = localStorage.getItem('assistant_api_key');
        if (savedBotType) setBotType(savedBotType);
        if (savedGeminiModel) setGeminiModel(savedGeminiModel);
        if (savedApiKey) setApiKey(savedApiKey);
    }, []);

    const saveSettings = () => {
        localStorage.setItem('assistant_bot_type', botType);
        localStorage.setItem('assistant_gemini_model', geminiModel);
        localStorage.setItem('assistant_api_key', apiKey);
        setShowSettings(false);
        setMessages(prev => [...prev, { text: `✅ Pengaturan disimpan. Menggunakan bot: ${botType === 'gemini' ? `Gemini AI (${geminiModel})` : 'Offline'}.`, sender: 'bot' }]);
    };

    const formatCurrency = (num) => `Rp ${Math.round(num || 0).toLocaleString('id-ID')}`;

    const processInput = async (userInput) => {
        const text = userInput.toLowerCase();
        let reply = "";

        const getOfflineReply = async (text) => {
            let offlineReply = "Maaf, saya belum paham. Coba tanyakan seputar 'omset 1 Desember', 'stok kemarin', atau 'penjualan bulan Januari'.";
            try {
                const now = new Date();
                const todayStr = now.toISOString().split('T')[0];
                const currentYear = now.getFullYear();
                const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');

                // Helper for Indonesian Month Mapping
                const monthsMap = {
                    januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
                    juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
                    jan: '01', feb: '02', mar: '03', apr: '04', jun: '06',
                    jul: '07', agu: '08', sep: '09', okt: '10', nov: '11', des: '12'
                };

                // ---------------------------------------------------------
                // DATE PARSING LOGIC (FLEXIBLE)
                // ---------------------------------------------------------
                let targetDate = todayStr;
                let targetPeriod = todayStr.slice(0, 7); // Default month
                let label = "Hari Ini";

                // 1. Check for specific dates like "1 desember 2026" or "12 mei"
                const dateMatch = text.match(/(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|sep|okt|nov|des)\s*(\d{4})?/i);
                if (dateMatch) {
                    const d = dateMatch[1].padStart(2, '0');
                    const m = monthsMap[dateMatch[2].toLowerCase()];
                    const y = dateMatch[3] || currentYear;
                    targetDate = `${y}-${m}-${d}`;
                    targetPeriod = `${y}-${m}`;
                    label = `${dateMatch[1]} ${dateMatch[2]} ${y}`;
                } 
                // 2. Check for "bulan [Nama Bulan]"
                else {
                    const monthOnlyMatch = text.match(/bulan\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|sep|okt|nov|des)/i);
                    if (monthOnlyMatch) {
                        const m = monthsMap[monthOnlyMatch[1].toLowerCase()];
                        targetPeriod = `${currentYear}-${m}`;
                        targetDate = null; // We are looking at a whole month
                        label = `Bulan ${monthOnlyMatch[1]}`;
                    }
                    // 3. Check for "kemarin"
                    else if (text.match(/kemarin/)) {
                        const d = new Date(); d.setDate(d.getDate() - 1);
                        targetDate = d.toISOString().split('T')[0];
                        label = "Kemarin";
                    }
                    // 4. Check for "tahun [YYYY]"
                    else if (text.match(/tahun\s+(\d{4})/)) {
                        const yearMatch = text.match(/tahun\s+(\d{4})/);
                        targetPeriod = yearMatch[1];
                        targetDate = null;
                        label = `Tahun ${yearMatch[1]}`;
                    }
                }

                // Future Check
                const isFuture = targetDate ? new Date(targetDate) > now : false;

                // SMALL TALK
                if (text.match(/^(halo|hi|hai|pagi|siang|sore|malam|assalamualaikum)/)) {
                    return "Halo Bos! 👋 Saya asisten cerdas Anda. Mau cek data tanggal berapa hari ini?";
                }
                if (text.match(/(terima kasih|makasih|thanks|thank you)/)) {
                    return "Sama-sama! Semoga bisnisnya lancar jaya. 🚀 Ada lagi yang ingin ditanyakan?";
                }

                // ---------------------------------------------------------
                // INTENT: TARIK LAPORAN (EXPORT PDF/EXCEL)
                // ---------------------------------------------------------
                if (text.match(/(tarik|download|export|cetak).*(laporan|pdf|excel)/)) {
                    if (isFuture) return "Laporan masa depan belum tersedia, Bos. Jualan dulu yang semangat ya!";

                    const isExcel = text.includes('excel') || text.includes('xlsx');
                    const isPdf = text.includes('pdf');
                    const isItemReport = text.includes('item');
                    const isStockReport = text.includes('stok') || text.includes('fisik');
                    const isSalesReport = !isItemReport && !isStockReport;

                    const storeName = localStorage.getItem('store_name') || 'Swift Kasir';
                    const period = targetDate || targetPeriod;

                    if (isStockReport) {
                        const products = await dbService.getProducts();
                        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                        autoTable(doc, {
                            head: [['No', 'Kode', 'Nama Produk', 'Kategori', 'Stok Sistem']],
                            body: products.map((p, i) => [i + 1, p.code || '-', p.name, p.category || '-', p.stock]),
                            styles: { fontSize: 9 }
                        });
                        const base64Data = doc.output('datauristring').split(',')[1];
                        saveAndShareFile(`Laporan_Stok_${storeName}.pdf`, base64Data, 'application/pdf');
                        return "✅ Laporan Stok (PDF) berhasil dibuat dan siap dibagikan!";
                    }

                    if (isExcel) {
                        const wb = XLSX.utils.book_new();
                        const trans = await dbService.getTransactions();
                        const filtered = trans.filter(t => t.date.startsWith(period));
                        
                        if (filtered.length === 0) return `Tidak ada data transaksi pada *${label}* untuk dibuatkan laporan Excel.`;

                        if (isSalesReport) {
                            // Laporan Penjualan Lengkap
                            const wsData = filtered.map(t => {
                                let itemStr = "";
                                try {
                                    const items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
                                    itemStr = items.map(i => `${i.name} (${i.qty})`).join(', ');
                                } catch(e) {}

                                return {
                                    'No. Nota': t.id,
                                    'Tanggal': new Date(t.date).toLocaleDateString('id-ID'),
                                    'Waktu': new Date(t.date).toLocaleTimeString('id-ID'),
                                    'Metode Bayar': t.paymentMethod || 'Tunai',
                                    'Rincian Item': itemStr,
                                    'Subtotal': (t.total || 0) + (t.discount || 0),
                                    'Diskon': t.discount || 0,
                                    'Pajak': t.tax || 0,
                                    'Total Akhir': t.total,
                                    'Profit': t.profit
                                };
                            });
                            const ws = XLSX.utils.json_to_sheet(wsData);
                            XLSX.utils.book_append_sheet(wb, ws, "Laporan Penjualan");
                        } else {
                            // Laporan Per Item
                            const agg = {};
                            filtered.forEach(t => {
                                let items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
                                items.forEach(i => {
                                    if (!agg[i.name]) agg[i.name] = { 'Nama Produk': i.name, 'Total Terjual': 0, 'Total Omset': 0, 'Total Untung': 0 };
                                    agg[i.name]['Total Terjual'] += i.qty;
                                    agg[i.name]['Total Omset'] += (i.price * i.qty);
                                    agg[i.name]['Total Untung'] += (i.profit || 0);
                                });
                            });
                            const ws = XLSX.utils.json_to_sheet(Object.values(agg));
                            XLSX.utils.book_append_sheet(wb, ws, "Detail Per Item");
                        }
                        const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
                        saveAndShareFile(`Laporan_Lengkap_${label.replace(/ /g, '_')}.xlsx`, base64Data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                        return `✅ Laporan Excel *Lengkap* periode *${label}* berhasil dibuat!`;
                    }

                    if (isPdf) {
                        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                        const trans = await dbService.getTransactions();
                        const filtered = trans.filter(t => t.date.startsWith(period));

                        if (filtered.length === 0) return `Tidak ada data transaksi pada *${label}* untuk dibuatkan laporan PDF.`;

                        doc.setFontSize(16);
                        doc.text(`${storeName} - Laporan Penjualan Lengkap`, 14, 15);
                        doc.setFontSize(10);
                        doc.text(`Periode: ${label}`, 14, 22);

                        if (isSalesReport) {
                            autoTable(doc, {
                                startY: 30,
                                head: [['ID', 'Waktu', 'Item', 'Metode', 'Total', 'Profit']],
                                body: filtered.map(t => {
                                    let itemStr = "";
                                    try {
                                        const items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
                                        itemStr = items.map(i => `${i.name}x${i.qty}`).join('\n');
                                    } catch(e) {}
                                    return [
                                        t.id, 
                                        new Date(t.date).toLocaleString('id-ID'), 
                                        itemStr,
                                        t.paymentMethod || 'Tunai',
                                        formatCurrency(t.total), 
                                        formatCurrency(t.profit)
                                    ];
                                }),
                                styles: { fontSize: 8, cellPadding: 2 }
                            });
                        } else {
                            const agg = {};
                            filtered.forEach(t => {
                                let items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
                                items.forEach(i => {
                                    if (!agg[i.name]) agg[i.name] = { name: i.name, qty: 0, total: 0, profit: 0 };
                                    agg[i.name].qty += i.qty;
                                    agg[i.name].total += (i.price * i.qty);
                                    agg[i.name].profit += (i.profit || 0);
                                });
                            });
                            autoTable(doc, {
                                startY: 30,
                                head: [['Produk', 'Terjual', 'Total Omset', 'Total Profit']],
                                body: Object.values(agg).map(i => [i.name, i.qty, formatCurrency(i.total), formatCurrency(i.profit)]),
                                styles: { fontSize: 9 }
                            });
                        }
                        const base64Data = doc.output('datauristring').split(',')[1];
                        saveAndShareFile(`Laporan_Lengkap_${label.replace(/ /g, '_')}.pdf`, base64Data, 'application/pdf');
                        return `✅ Laporan PDF *Lengkap* periode *${label}* berhasil dibuat!`;
                    }
                }

                // ---------------------------------------------------------
                // INTENT: OMSET / PENJUALAN (DYNAMICAL)
                // ---------------------------------------------------------
                if (text.match(/(omset|penjualan|laku|pendapatan|dapet|cuan|keuntungan|profit|laba)/)) {
                    if (isFuture) return `Waduh, tanggal *${label}* itu kan masa depan, Bos. Saya belum bisa meramal, tapi semoga nanti laris manis ya! 🔮`;

                    if (targetDate) {
                        // Check daily stats
                        const stats = await dbService.getDailyStats(targetDate);
                        if (stats.count === 0) return `Untuk tanggal *${label}*, sepertinya belum ada transaksi yang tercatat.`;
                        
                        return `📊 Laporan Penjualan (${label}):\n- Total Transaksi: ${stats.count}\n- Omset: ${formatCurrency(stats.total)}\n- Profit: ${formatCurrency(stats.profit)}\n\n💡 Ingin cek 'barang terlaris' pada tanggal ini juga?`;
                    } else {
                        // Check monthly/yearly stats (targetPeriod)
                        const transactions = await dbService.getTransactions();
                        const filtered = transactions.filter(t => t.date.startsWith(targetPeriod));
                        const total = filtered.reduce((acc, t) => acc + (t.total || 0), 0);
                        const profit = filtered.reduce((acc, t) => acc + (t.profit || 0), 0);
                        
                        if (filtered.length === 0) return `Data untuk periode *${label}* tidak ditemukan.`;
                        
                        return `📊 Ringkasan Penjualan (${label}):\n- Total Transaksi: ${filtered.length}\n- Omset Total: ${formatCurrency(total)}\n- Profit Total: ${formatCurrency(profit)}`;
                    }
                }

                // ---------------------------------------------------------
                // INTENT: CEK STOK SPESIFIK PRODUK (cek stok [nama barang])
                // ---------------------------------------------------------
                const stockMatch = text.match(/(cek stok|stok|berapa sisa|sisa stok)\s+(.+)/i);
                if (stockMatch && stockMatch[2] && stockMatch[2].length > 2) {
                    const keyword = stockMatch[2].trim().toLowerCase()
                        .replace(/\b(pada|tanggal|hari|per|bulan|kemarin|besok)\b.*$/, '')
                        .trim();
                    if (keyword.length > 1 && !keyword.match(/^(menipis|habis|kosong|kurang|dikit|limit)$/)) {
                        const products = await dbService.getProducts();
                        const found = products.filter(p => p.name.toLowerCase().includes(keyword));
                        if (found.length > 0) {
                            const list = found.slice(0, 5).map(p => `- ${p.name}: **${p.stock} pcs** (${formatCurrency(p.price)})`).join('\n');
                            return `📦 Stok saat ini untuk '${keyword}':\n${list}`;
                        } else {
                            return `❌ Produk dengan kata kunci '${keyword}' tidak ditemukan di database.`;
                        }
                    }
                }

                // ---------------------------------------------------------
                // INTENT: STOK PADA TANGGAL (HISTORICAL CALCULATION)
                // ---------------------------------------------------------
                if (text.match(/(stok).*(pada|tanggal|hari|per|bulan)/) || (text.match(/stok/) && dateMatch)) {
                    if (isFuture) return `Untuk tanggal *${label}*, stoknya belum bisa dipastikan, Bos. Yang pasti sekarang stok aman!`;

                    const [products, allTrans, allPurchases] = await Promise.all([
                        dbService.getProducts(),
                        dbService._get('transactions'),
                        dbService._get('purchases')
                    ]);

                    // If user asks for a specific date, we calculate historical stock
                    // Stock(Past) = CurrentStock + Sales(Past to Now) - Purchases(Past to Now)
                    const calculatePastStock = (productName, dateLimit) => {
                        const p = products.find(i => i.name.toLowerCase() === productName.toLowerCase() || productName.toLowerCase().includes(i.name.toLowerCase()));
                        if (!p) return null;

                        let salesAfter = 0;
                        allTrans.forEach(t => {
                            if (new Date(t.date) > new Date(dateLimit)) {
                                let items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
                                const item = items.find(i => i.name === p.name);
                                if (item) salesAfter += item.qty;
                            }
                        });

                        let purchasesAfter = 0;
                        allPurchases.forEach(pur => {
                            if (new Date(pur.date) > new Date(dateLimit)) {
                                let items = typeof pur.items === 'string' ? JSON.parse(pur.items) : pur.items;
                                const item = items.find(i => i.name === p.name);
                                if (item) purchasesAfter += item.qty;
                            }
                        });

                        return p.stock + salesAfter - purchasesAfter;
                    };

                    // Check if user mentioned a product name
                    const productMatch = text.match(/(stok|sisa)\s+([a-zA-Z0-9\s]+)\s+(pada|tanggal|hari)/i);
                    if (productMatch && productMatch[2]) {
                        const productName = productMatch[2].trim();
                        const pastStock = calculatePastStock(productName, targetDate || (targetPeriod + "-01"));
                        if (pastStock !== null) {
                            return `📦 Estimasi stok *${productName}* pada *${label}* adalah sekitar **${pastStock} pcs**.`;
                        }
                    }

                    // Generic stock summary for that period
                    const transInPeriod = allTrans.filter(t => t.date.startsWith(targetDate || targetPeriod));
                    if (transInPeriod.length > 0) {
                        const map = {};
                        transInPeriod.forEach(t => {
                            let items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
                            items.forEach(i => { if (!map[i.name]) map[i.name] = 0; map[i.name] += i.qty; });
                        });
                        const topSold = Object.entries(map).sort((a,b) => b[1] - a[1])[0];
                        return `Pada periode *${label}*, barang yang paling banyak keluar adalah *${topSold[0]}* sebanyak ${topSold[1]} pcs.\n\nUntuk melihat stok fisik saat ini, silakan ketik 'cek stok [nama barang]'.`;
                    }
                    
                    return `Saya tidak menemukan pergerakan stok yang mencolok pada *${label}*.`;
                }

                // ---------------------------------------------------------
                // REST OF THE INTENTS (REFINED)
                // ---------------------------------------------------------

                // STOK MENIPIS
                if (text.match(/(stok|barang|produk).*(habis|menipis|kosong|kurang|dikit|limit)/)) {
                    const products = await dbService.getProducts();
                    const lowStock = products.filter(p => p.stock <= 10).sort((a, b) => a.stock - b.stock);
                    if (lowStock.length === 0) return "Semua stok aman (di atas 10 pcs). Mantap Bos! ✅";
                    const list = lowStock.slice(0, 5).map(p => `- ${p.name} (Sisa ${p.stock})`).join('\n');
                    return `⚠️ Ada ${lowStock.length} barang yang stoknya kritis:\n${list}`;
                }
                
                // TERLARIS
                if (text.match(/(paling laris|terlaris|best seller|banyak dibeli)/)) {
                    const trans = await dbService.getTransactions(targetDate || targetPeriod);
                    const map = {};
                    trans.forEach(t => {
                        let items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
                        items.forEach(i => { if (!map[i.name]) map[i.name] = 0; map[i.name] += (i.qty || 0); });
                    });
                    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
                    if (sorted.length === 0) return `Belum ada data penjualan pada ${label}.`;
                    const list = sorted.map((s, i) => `${i + 1}. ${s[0]} (${s[1]} terjual)`).join('\n');
                    return `🚀 Produk *Terlaris* (${label}):\n${list}`;
                }

                // Fallback: Cek apakah nama produk ada di DB
                if (text.length >= 3 && !text.match(/hari|kemarin|bulan|tahun|omset|stok/)) {
                    const products = await dbService.getProducts();
                    const exactOrPartial = products.filter(p => p.name.toLowerCase().includes(text));
                    if (exactOrPartial.length > 0) {
                        const p = exactOrPartial[0];
                        return `🔍 Info Produk: *${p.name}*\n- Stok: ${p.stock} pcs\n- Harga: ${formatCurrency(p.price)}`;
                    }
                }

            } catch (error) {
                console.error("Bot Error:", error);
                return "Aduh, otak saya lagi muter-muter. Coba tanya hal lain ya!";
            }
            return offlineReply;
        };

        const getGeminiReply = async (text) => {
            if (!apiKey) {
                return "Mohon masukkan API Key Gemini di menu pengaturan (ikon ⚙️) terlebih dahulu.";
            }
            try {
                // Siapkan konteks lokal agar Gemini tahu data omset hari ini
                const now = new Date();
                const todayStr = now.toISOString().split('T')[0];
                const stats = await dbService.getDailyStats(todayStr);
                const products = await dbService.getProducts();
                const lowStock = products.filter(p => p.stock <= 10).map(p => `${p.name} (sisa ${p.stock})`).join(', ');
                
                const promptContext = `Anda adalah Asisten Pintar resmi untuk aplikasi "Swift Kasir" (sebuah aplikasi Point of Sale / Kasir Offline Desktop Desktop premium). 
Tugas Anda adalah membantu pengguna menganalisis data toko mereka serta memandu mereka cara menggunakan aplikasi Swift Kasir dengan ramah, profesional, dan akurat (jangan mengarang fitur yang tidak ada).

Berikut adalah detail Menu & Fitur yang ada di Swift Kasir untuk memandu pengguna:
1. **Dashboard**: Menampilkan ringkasan statistik toko seperti omset, profit, jumlah produk, transaksi hari ini, serta grafik penjualan terbaru.
2. **Transaksi (POS)**: Halaman utama kasir untuk melayani penjualan. Pengguna bisa scan barcode barang, input nama produk, mengatur diskon, memilih metode bayar (Tunai/QRIS), dan mencetak struk belanja ke printer thermal.
3. **Produk (Barang)**: Halaman manajemen inventaris produk. Pengguna dapat menambah/mengedit produk, mengelola stok, membuat barcode dengan Barcode Generator bawaan, serta mencetak Label Harga produk.
4. **Pembelian / Restok**: Tempat mencatat barang masuk dari supplier dan mencatat riwayat restok barang untuk memperbarui stok otomatis.
5. **Riwayat Transaksi**: Melihat daftar nota transaksi penjualan yang lalu, melakukan cetak ulang struk, atau melakukan pembatalan transaksi.
6. **Laporan**: Analisis keuangan toko yang lengkap (harian, bulanan, tahunan), grafik performa, serta tombol untuk mengekspor laporan transaksi ke format Excel atau PDF.
7. **Pengaturan**: Pengaturan nama toko, alamat/telepon pada struk, konfigurasi Printer Thermal, fitur Backup & Restore database, Impor produk dari Excel, serta Aktivasi Lisensi Aplikasi.

Data toko hari ini (${todayStr}):
- Omset Hari Ini: Rp ${stats.total.toLocaleString('id-ID')}
- Profit Hari Ini: Rp ${stats.profit.toLocaleString('id-ID')}
- Total Transaksi: ${stats.count}
- Barang stok kritis (<=10): ${lowStock || 'Semua aman di atas 10 pcs'}

Instruksi Respon:
- Jika pengguna bertanya tentang data keuangan/stok toko, gunakan data toko di atas.
- Jika pengguna bertanya tentang cara menggunakan fitur (misal: cetak struk, backup data, buat barcode), arahkan ke menu Swift Kasir yang sesuai di atas.
- Jangan mengarang fitur yang tidak tertulis di atas. Jawablah secara ringkas, jelas, dan bersahabat.

Pertanyaan pengguna: ${text}`;

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: promptContext }]
                        }]
                    })
                });
                
                const data = await response.json();
                if (data.error) {
                    // Jika model overload, beri tahu user
                    if (data.error.message.includes('high demand') || data.error.code === 503) {
                        return "Gemini API sedang sangat sibuk saat ini (High Demand). Mohon coba beberapa saat lagi atau gunakan Asisten Offline sementara waktu.";
                    }
                    return `Error API: ${data.error.message}`;
                }
                if (data.candidates && data.candidates.length > 0) {
                    return data.candidates[0].content.parts[0].text;
                }
                return "Maaf, saya tidak bisa memproses permintaan Anda saat ini.";
            } catch (error) {
                console.error("Gemini API Error:", error);
                return "Terjadi kesalahan koneksi saat menghubungi Gemini API.";
            }
        };

        reply = botType === 'gemini' ? await getGeminiReply(text) : await getOfflineReply(text);

        setTimeout(() => {
            setMessages(prev => [...prev, { text: reply, sender: 'bot' }]);
        }, 600); // Simulate typing delay
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim()) return;
        
        const userMsg = input.trim();
        setMessages(prev => [...prev, { text: userMsg, sender: 'user' }]);
        setInput('');
        
        processInput(userMsg);
    };

    return (
        <div style={{
            width: '100%', 
            height: 'calc(100vh - 180px)', // Tinggi dinamis agar pas 1 layar (dikurangi header & nav)
            borderRadius: 16,
            background: 'var(--card-bg)', border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            marginBottom: 10
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 20px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Bot size={24} />
                    <div>
                        <h3 style={{ margin: 0, fontSize: 16 }}>Asisten Pintar {botType === 'gemini' ? 'Gemini' : 'Offline'}</h3>
                        <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Siap Membantu</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 0, display: 'flex' }}>
                        <Settings size={20} />
                    </button>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 0, display: 'flex' }}>
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* Settings Area */}
            {showSettings && (
                <div style={{ padding: 16, background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: 14 }}>Pengaturan Bot AI</h4>
                    <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Pilih Bot:</label>
                        <select 
                            value={botType} 
                            onChange={(e) => setBotType(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                        >
                            <option value="offline">Asisten Offline (Bawaan)</option>
                            <option value="gemini">Gemini AI (Online)</option>
                        </select>
                    </div>
                    {botType === 'gemini' && (
                        <>
                            <div style={{ marginBottom: 10 }}>
                                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Pilih Model Gemini:</label>
                                <select 
                                    value={geminiModel} 
                                    onChange={(e) => setGeminiModel(e.target.value)}
                                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                                >
                                    <option value="gemini-2.5-flash">gemini-2.5-flash (Rekomendasi / Cepat)</option>
                                    <option value="gemini-2.5-pro">gemini-2.5-pro (Lebih Pintar)</option>
                                    <option value="gemini-2.0-flash">gemini-2.0-flash (Sebelumnya)</option>
                                </select>
                            </div>
                            <div style={{ marginBottom: 10 }}>
                                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>API Key Gemini (Gratis):</label>
                                <input 
                                    type="password" 
                                    value={apiKey} 
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Masukkan API Key..."
                                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                                />
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--primary)', textDecoration: 'none', display: 'inline-block', marginTop: 4 }}>Dapatkan API Key di sini</a>
                            </div>
                        </>
                    )}
                    <button onClick={saveSettings} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, width: '100%', fontWeight: 'bold' }}>Simpan Pengaturan</button>
                </div>
            )}

            {/* Chat Area */}
            <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-color)' }}>
                {messages.map((msg, idx) => (
                    <div key={idx} style={{
                        alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        background: msg.sender === 'user' ? 'var(--primary)' : 'var(--card-bg)',
                        color: msg.sender === 'user' ? 'white' : 'var(--text-main)',
                        padding: '10px 14px', borderRadius: 12,
                        borderBottomRightRadius: msg.sender === 'user' ? 4 : 12,
                        borderBottomLeftRadius: msg.sender === 'bot' ? 4 : 12,
                        border: msg.sender === 'bot' ? '1px solid var(--border-color)' : 'none',
                        fontSize: 14, lineHeight: 1.5,
                        whiteSpace: 'pre-wrap'
                    }}>
                        {msg.text}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} style={{
                padding: 12, background: 'var(--card-bg)', borderTop: '1px solid var(--border-color)',
                display: 'flex', gap: 8
            }}>
                <input 
                    value={input} onChange={e => setInput(e.target.value)}
                    placeholder="Ketik pertanyaan Anda..."
                    style={{
                        flex: 1, padding: '10px 16px', borderRadius: 20,
                        border: '1px solid var(--border-color)', background: 'var(--bg-color)',
                        color: 'var(--text-main)', outline: 'none'
                    }}
                />
                <button type="submit" style={{
                    width: 40, height: 40, borderRadius: 20, border: 'none',
                    background: 'var(--primary)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}>
                    <Send size={18} style={{ marginLeft: -2 }} />
                </button>
            </form>
        </div>
    );
};

export default SmartAssistant;
