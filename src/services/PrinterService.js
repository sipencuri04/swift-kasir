
class PrinterService {
    constructor() {
        this.connectedDeviceId = null;
    }

    async listDevices() {
        return new Promise((resolve, reject) => {
            if (window.bluetoothSerial) {
                window.bluetoothSerial.list(resolve, reject);
            } else {
                reject(new Error('Bluetooth tidak tersedia di perangkat ini (Gunakan HP/Tablet Android)'));
            }
        });
    }

    async connect(address) {
        return new Promise((resolve, reject) => {
            if (window.bluetoothSerial) {
                window.bluetoothSerial.connect(address, () => {
                    this.connectedDeviceId = address;
                    resolve();
                }, reject);
            } else {
                reject(new Error('Koneksi dibatalkan. Bluetooth tidak didukung.'));
            }
        });
    }

    async isConnected() {
        return new Promise((resolve) => {
            if (window.bluetoothSerial) {
                window.bluetoothSerial.isConnected(() => resolve(true), () => resolve(false));
            } else {
                resolve(false);
            }
        });
    }

    async disconnect() {
        if (window.bluetoothSerial) {
            window.bluetoothSerial.disconnect();
        }
        this.connectedDeviceId = null;
    }

    async printReceipt(storeName, items, total, date, storeAddress = '', transactionId = null) {
        const isConn = await this.isConnected();
        if (!isConn) throw new Error("Printer not connected");

        const ESC = '\x1B';
        const LF = '\x0A';

        // Commands accumulator
        let cmds = '';

        // Initialize
        cmds += ESC + '@';

        // Address & Name
        cmds += ESC + 'a' + '\x01'; // Center
        cmds += ESC + '!' + '\x10'; // Double height
        cmds += storeName + LF;
        cmds += ESC + '!' + '\x00'; // Normal text

        if (storeAddress) cmds += storeAddress + LF;

        cmds += date + LF;
        if (transactionId) {
             cmds += `ID: ${transactionId}` + LF;
        }
        cmds += ESC + 'a' + '\x00'; // Left
        cmds += '--------------------------------' + LF + LF;

        // Items
        items.forEach(item => {
            cmds += item.name + LF;
            const line2 = `${item.qty} x ${item.price.toLocaleString('id-ID')}`;
            const totalItem = (item.qty * item.price).toLocaleString('id-ID');

            const spaceCount = 32 - line2.length - totalItem.length;
            const spaces = ' '.repeat(Math.max(0, spaceCount));

            cmds += line2 + spaces + totalItem + LF + LF; // Jarak ekstra agar struk lebih panjang (boros kertas)
        });

        cmds += '--------------------------------' + LF + LF;

        // Total
        cmds += ESC + 'a' + '\x02'; // Right align
        cmds += ESC + '!' + '\x08'; // Bold
        cmds += `TOTAL: ${total.toLocaleString('id-ID')}` + LF;
        cmds += ESC + '!' + '\x00'; // Normal
        cmds += ESC + 'a' + '\x00'; // Left

        // Footer
        cmds += LF + LF;
        cmds += ESC + 'a' + '\x01'; // Center

        if (transactionId) {
            const idStr = String(transactionId);
            const storeLength = idStr.length + 3;
            const pL = storeLength & 0xFF;
            const pH = (storeLength >> 8) & 0xFF;

            cmds += '\x1D\x28\x6B\x04\x00\x31\x41\x32\x00'; // QR Model 2
            cmds += '\x1D\x28\x6B\x03\x00\x31\x43\x06'; // QR Size 6
            cmds += '\x1D\x28\x6B\x03\x00\x31\x45\x30'; // Error Correction L
            cmds += '\x1D\x28\x6B' + String.fromCharCode(pL) + String.fromCharCode(pH) + '\x31\x50\x30' + idStr; // Store Data
            cmds += '\x1D\x28\x6B\x03\x00\x31\x51\x30'; // Print QR
            
            cmds += LF;
            cmds += `ID: ${idStr}` + LF + LF;
        }

        cmds += 'Terima Kasih atas Kunjungan Anda!' + LF + LF;
        cmds += 'Selamat datang kembali di toko kami.' + LF + LF;
        cmds += 'Kepuasan Anda adalah prioritas utama.' + LF + LF;
        cmds += 'Barang yang sudah dibeli tidak' + LF;
        cmds += 'dapat ditukar atau dikembalikan.' + LF + LF;
        cmds += 'Simpan struk ini sebagai bukti' + LF;
        cmds += 'pembayaran yang sah.' + LF + LF + LF;
        cmds += 'Powered by Swift Kasir' + LF;
        cmds += LF + LF + LF; // Feed

        // Prepare Final Payload (Uint8Array)
        const payload = [];

        // 1. Check for Logo
        const storeLogo = localStorage.getItem('store_logo');
        if (storeLogo) {
            try {
                const imageBytes = await this.getImageBytes(storeLogo);
                payload.push(...imageBytes);
            } catch (e) {
                console.error("Failed to print logo", e);
            }
        }

        // 2. Add text commands
        for (let i = 0; i < cmds.length; i++) {
            payload.push(cmds.charCodeAt(i) & 0xFF);
        }

        // 3. Open Cash Drawer at the end
        // ESC p 0 25 250 (Kick Drawer 1)
        payload.push(0x1B, 0x70, 0x00, 0x19, 0xFA);

        const uint8Array = new Uint8Array(payload);

        if (window.bluetoothSerial) {
            return new Promise((resolve, reject) => {
                window.bluetoothSerial.write(uint8Array.buffer, resolve, reject);
            });
        } else {
            throw new Error('Bluetooth tidak tersedia untuk mencetak struk.');
        }
    }

    async getImageBytes(base64) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const width = img.width;
                const height = img.height;
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, width, height);

                const bytesPerLine = Math.ceil(width / 8);
                const data = new Uint8Array(bytesPerLine * height);

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const idx = (y * width + x) * 4;
                        const r = imageData.data[idx];
                        const isBlack = r < 128;
                        if (isBlack) {
                            const byteIndex = y * bytesPerLine + Math.floor(x / 8);
                            const bitIndex = 7 - (x % 8);
                            data[byteIndex] |= (1 << bitIndex);
                        }
                    }
                }

                const header = [0x1D, 0x76, 0x30, 0x00];
                const xL = bytesPerLine & 0xFF;
                const xH = (bytesPerLine >> 8) & 0xFF;
                const yL = height & 0xFF;
                const yH = (height >> 8) & 0xFF;
                header.push(xL, xH, yL, yH);

                const alignCenter = [0x1B, 0x61, 0x01]; // ESC a 1
                const resetAlign = [0x1B, 0x61, 0x00]; // ESC a 0

                resolve([...alignCenter, ...header, ...Array.from(data), ...resetAlign, 0x0A]);
            };
            img.onerror = reject;
            img.src = base64;
        });
    }

    async openCashDrawer() {
        const isConn = await this.isConnected();
        if (!isConn) throw new Error("Printer not connected");

        // ESC p 0 25 250 (Kick Drawer 1)
        const ESC_p = [0x1B, 0x70, 0x00, 0x19, 0xFA];
        const uint8Array = new Uint8Array(ESC_p);

        if (window.bluetoothSerial) {
            return new Promise((resolve, reject) => {
                window.bluetoothSerial.write(uint8Array.buffer, resolve, reject);
            });
        } else {
            throw new Error('Bluetooth tidak tersedia untuk membuka laci kasir.');
        }
    }
}

export const printerService = new PrinterService();
