// Fix standalone build by copying static files (symlinks don't work in packaged apps)
const fs = require('fs');
const path = require('path');

const staticSrc = path.join(process.cwd(), '.next/static');
const staticDst = path.join(process.cwd(), '.next/standalone/.next/static');
const staticDstDir = path.dirname(staticDst);

console.log('Copying static files for standalone build...');
console.log('Source:', staticSrc);
console.log('Destination:', staticDst);

if (!fs.existsSync(staticSrc)) {
  console.error('ERROR: .next/static does not exist! Run "npm run build" first.');
  process.exit(1);
}

// Create .next directory in standalone if it doesn't exist
if (!fs.existsSync(staticDstDir)) {
  console.log('Creating .next directory in standalone...');
  fs.mkdirSync(staticDstDir, { recursive: true });
}

// Remove existing directory if it exists
if (fs.existsSync(staticDst)) {
  console.log('Removing existing static destination...');
  try {
    if (fs.lstatSync(staticDst).isSymbolicLink()) {
      fs.unlinkSync(staticDst);
    } else {
      fs.rmSync(staticDst, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('Error removing existing:', err);
  }
}

// Copy static files recursively
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  console.log('Copying static files...');
  copyRecursiveSync(staticSrc, staticDst);
  console.log('✓ Copied static files to:', staticDst);
  console.log('  → From:', staticSrc);
} catch (err) {
  console.error('ERROR copying static files:', err);
  process.exit(1);
}

console.log('✓ Static files copied successfully!');

// Patch the standalone server.js to write PORT_FILE
const standaloneServerPath = path.join(process.cwd(), '.next/standalone/server.js');
if (fs.existsSync(standaloneServerPath)) {
  console.log('Patching standalone server.js to support PORT_FILE...');
  let serverContent = fs.readFileSync(standaloneServerPath, 'utf8');
  
  // Check if already patched
  if (!serverContent.includes('PORT_FILE')) {
    // Find the line where the server starts listening and add port file writing
    // The standalone server uses: server.listen(currentPort, hostname, ...)
    // We need to add code to write the port file after the server starts
    
    const patchCode = `
// Electron PORT_FILE support (injected by fix-standalone-static.js)
const originalListen = require('http').Server.prototype.listen;
require('http').Server.prototype.listen = function(...args) {
  const result = originalListen.apply(this, args);
  this.once('listening', () => {
    const addr = this.address();
    if (addr && process.env.PORT_FILE) {
      try {
        require('fs').writeFileSync(process.env.PORT_FILE, String(addr.port));
        console.log('PORT_FILE written:', process.env.PORT_FILE, '->', addr.port);
      } catch (e) {
        console.error('Failed to write PORT_FILE:', e);
      }
    }
  });
  return result;
};
// End Electron PORT_FILE support

`;
    
    // Prepend the patch to the server file
    serverContent = patchCode + serverContent;
    fs.writeFileSync(standaloneServerPath, serverContent);
    console.log('✓ Patched standalone server.js with PORT_FILE support');
  } else {
    console.log('✓ Standalone server.js already has PORT_FILE support');
  }
} else {
  console.warn('WARNING: standalone/server.js not found, skipping patch');
}
