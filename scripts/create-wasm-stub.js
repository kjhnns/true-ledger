const fs = require('fs');
const path = require('path');

function ensureWasm() {
  const target = path.join(__dirname, '..', 'node_modules', 'expo-sqlite', 'web', 'wa-sqlite');
  const file = path.join(target, 'wa-sqlite.wasm');
  try {
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    if (!fs.existsSync(file)) {
      // write minimal wasm header so bundlers see a file
      const buf = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
      fs.writeFileSync(file, buf);
      console.log('Created wasm stub at', file);
    } else {
      // nothing to do
      // console.log('wasm file already exists:', file);
    }
  } catch (err) {
    console.error('Failed to create wasm stub:', err);
    process.exit(0); // don't fail install
  }
}

ensureWasm();
