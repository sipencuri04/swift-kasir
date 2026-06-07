import fs from 'fs';
import path from 'path';

const srcPath = path.resolve('node_modules/sql.js/dist/sql-wasm.wasm');
const destDir = path.resolve('public/assets');
const destPath = path.join(destDir, 'sql-wasm.wasm');
const destRoot = path.resolve('public/sql-wasm.wasm');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

try {
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        fs.copyFileSync(srcPath, destRoot);
        console.log('Success: Copied sql-wasm.wasm into public/assets/ AND public/');
    } else {
        console.error('Error: Source file not found at', srcPath);
    }
} catch (err) {
    console.error('Error copying file:', err);
}
