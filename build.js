const fs = require('fs');
const path = require('path');

// Copy JS files from src/js to assets/js
const srcDir = path.join(__dirname, 'src', 'js');
const assetsDir = path.join(__dirname, 'assets', 'js');

// Ensure assets/js directory exists
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

// Copy source JS files
const jsFiles = ['scanner.js', 'admin-scanner-fields.js'];
jsFiles.forEach(file => {
    const src = path.join(srcDir, file);
    const dest = path.join(assetsDir, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`Copied ${file} to assets/js/`);
    }
});

// Copy QR scanner library files from node_modules
const qrScannerDir = path.join(__dirname, 'node_modules', 'qr-scanner');
const qrFiles = [
    { src: 'qr-scanner.umd.min.js', dest: 'qr-scanner.min.js' },
    { src: 'qr-scanner-worker.min.js', dest: 'qr-scanner-worker.min.js' },
];

qrFiles.forEach(({ src, dest }) => {
    const srcPath = path.join(qrScannerDir, src);
    const destPath = path.join(assetsDir, dest);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${src} -> ${dest}`);
    } else {
        console.warn(`Warning: ${srcPath} not found`);
    }
});

console.log('Build JS complete.');
