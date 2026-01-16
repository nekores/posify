// Wrapper for Next.js standalone server to handle port file writing
// This ensures the Electron app can discover which port the server is using
const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const fs = require('fs');

const hostname = process.env.HOSTNAME || '127.0.0.1';
const port = parseInt(process.env.PORT || '0', 10);

// Find the standalone server relative to this script's location
const standaloneDir = path.dirname(__dirname);
const nextDir = path.join(standaloneDir, '.next', 'standalone');

// The standalone server.js is in the .next/standalone directory
let serverPath = path.join(nextDir, 'server.js');

// If running from within .next/standalone, adjust path
if (!fs.existsSync(serverPath)) {
  serverPath = path.join(__dirname, '..', 'server.js');
}

if (!fs.existsSync(serverPath)) {
  console.error('Could not find Next.js standalone server at:', serverPath);
  process.exit(1);
}

console.log('Loading Next.js standalone server from:', serverPath);
console.log('Working directory:', process.cwd());

// Change to the standalone directory so Next.js can find its files
const serverDir = path.dirname(serverPath);
process.chdir(serverDir);

// Set up environment
process.env.NODE_ENV = 'production';
process.env.PORT = String(port);
process.env.HOSTNAME = hostname;

// The standalone server.js from Next.js starts the server automatically
// when required, so we just need to require it
require(serverPath);

// Note: The standalone server handles its own port binding
// We need to check if it wrote the port file, or wait for it to be ready
const portFile = process.env.PORT_FILE;
if (portFile) {
  // The standalone server might not write the port file, so we'll do it
  // by monitoring when the server becomes ready
  const checkReady = setInterval(() => {
    const http = require('http');
    const testPort = port || 3000;
    
    const req = http.get(`http://${hostname}:${testPort}`, { timeout: 1000 }, (res) => {
      // Server is ready
      clearInterval(checkReady);
      try {
        fs.writeFileSync(portFile, String(testPort));
        console.log(`Port file written: ${portFile} -> ${testPort}`);
      } catch (e) {
        console.error('Failed to write port file:', e);
      }
    });
    
    req.on('error', () => {
      // Server not ready yet, keep checking
    });
    
    req.setTimeout(1000, () => {
      req.destroy();
    });
  }, 500);
  
  // Stop checking after 30 seconds
  setTimeout(() => {
    clearInterval(checkReady);
  }, 30000);
}
