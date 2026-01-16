// Production server wrapper for Electron
// This wraps the Next.js standalone server to ensure proper configuration
const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const fs = require('fs');

// Find the standalone server
const appPath = process.env.ELECTRON_APP_PATH || __dirname;
const possibleServerPaths = [
  path.join(appPath, '.next', 'standalone', 'server.js'),
  path.join(appPath, 'server.js'),
  path.join(__dirname, 'server.js'),
];

let serverPath = null;
for (const p of possibleServerPaths) {
  if (fs.existsSync(p)) {
    serverPath = p;
    break;
  }
}

if (!serverPath) {
  console.error('Could not find Next.js standalone server');
  process.exit(1);
}

// Load the Next.js server
// The standalone server exports a default function or app
let nextApp;
try {
  // Try different ways the server might be exported
  const serverModule = require(serverPath);
  nextApp = serverModule.default || serverModule;
} catch (err) {
  console.error('Failed to load Next.js server:', err);
  process.exit(1);
}

const hostname = process.env.HOSTNAME || '127.0.0.1';
const port = parseInt(process.env.PORT || '0', 10);

// If nextApp is a function, it's the request handler
// If it's an object, we need to get the handler from it
const handle = typeof nextApp === 'function' 
  ? nextApp 
  : (nextApp.getRequestHandler ? nextApp.getRequestHandler() : null);

if (!handle) {
  console.error('Could not get request handler from Next.js server');
  process.exit(1);
}

// Create HTTP server
const server = createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  } catch (err) {
    console.error('Error handling request:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('internal server error');
    }
  }
});

server.listen(port, hostname, (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  const actualPort = server.address().port;
  console.log(`> Next.js server ready on http://${hostname}:${actualPort}`);
  
  // Write port to file if requested (for Electron to read)
  if (process.env.PORT_FILE) {
    try {
      fs.writeFileSync(process.env.PORT_FILE, String(actualPort));
    } catch (e) {
      // Ignore
    }
  }
});

