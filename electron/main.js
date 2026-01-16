const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');

let mainWindow;
let splashWindow;
let serverProcess = null;
let actualPort = null;

const isDev = process.env.NODE_ENV === 'development';

// Load environment variables from .env file
function loadEnvFile() {
  const possibleEnvPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(app.getAppPath(), '.env'),
    path.join(process.resourcesPath || '', '.env'),
    path.join(app.getPath('userData'), '.env'),
  ];
  
  for (const envPath of possibleEnvPaths) {
    try {
      if (fs.existsSync(envPath)) {
        console.log('Loading .env from:', envPath);
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
              const value = valueParts.join('=').replace(/^["']|["']$/g, '');
              if (!process.env[key]) {
                process.env[key] = value;
                console.log(`  Set ${key}=${value.substring(0, 20)}...`);
              }
            }
          }
        }
        return true;
      }
    } catch (e) {
      console.error('Error loading .env from', envPath, e);
    }
  }
  
  console.warn('No .env file found. Using default DATABASE_URL if not set.');
  return false;
}

// Load env file early
loadEnvFile();

// Function to find an available port
function findAvailablePort(startPort = 0) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    
    server.on('error', (err) => {
      if (startPort === 0) {
        // If port 0 fails, try a random high port
        findAvailablePort(Math.floor(Math.random() * 50000) + 10000)
          .then(resolve)
          .catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

// Function to send error to splash window
function showSplashError(errorType, message) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(`
      window.postMessage({ type: 'error', errorType: '${errorType}', message: '${message.replace(/'/g, "\\'")}' }, '*');
    `);
  }
}

// Function to update splash status
function updateSplashStatus(message) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(`
      window.postMessage({ type: 'status', message: '${message.replace(/'/g, "\\'")}' }, '*');
    `);
  }
}

function createSplashWindow() {
  try {
    splashWindow = new BrowserWindow({
      width: 500,
      height: 600,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    const splashPath = path.join(__dirname, 'splash.html');
    if (fs.existsSync(splashPath)) {
      splashWindow.loadFile(splashPath);
    } else {
      // Inline splash screen if file not found
      splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              color: white;
              text-align: center;
            }
            .logo { font-size: 48px; margin-bottom: 20px; }
            h1 { margin: 0; font-size: 32px; }
            .loader { margin-top: 30px; }
            .dot {
              display: inline-block;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: #38ef7d;
              margin: 0 4px;
              animation: bounce 1.4s infinite;
            }
            .dot:nth-child(2) { animation-delay: 0.2s; }
            .dot:nth-child(3) { animation-delay: 0.4s; }
            @keyframes bounce {
              0%, 80%, 100% { transform: scale(0); }
              40% { transform: scale(1); }
            }
          </style>
        </head>
        <body>
          <div>
            <div class="logo">📊</div>
            <h1>Posify</h1>
            <p>Starting application...</p>
            <div class="loader">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </body>
        </html>
      `));
    }
    splashWindow.center();
    splashWindow.show();
  } catch (error) {
    console.error('Error creating splash window:', error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      // Enable web security but allow localhost
      webSecurity: true,
      // Allow loading local resources
      allowRunningInsecureContent: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
    title: 'Posify',
    show: false, // Keep hidden until content is fully loaded
    backgroundColor: '#1a1a2e',
  });
  
  // Log when page starts loading
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('Page started loading');
  });
  
  // Log when resources fail to load
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) {
      console.error('Main frame failed to load:', errorCode, errorDescription, validatedURL);
    } else {
      console.warn('Resource failed to load:', errorCode, errorDescription, validatedURL);
    }
  });

  // Only show main window and close splash when page content is FULLY loaded
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading');
    
    // Check if page actually has content before showing
    mainWindow.webContents.executeJavaScript(`
      (function() {
        const body = document.body;
        const hasContent = body && (
          body.children.length > 0 || 
          body.innerText.trim().length > 0 ||
          body.querySelector('div, main, section, article')
        );
        return hasContent;
      })();
    `).then((hasContent) => {
      console.log('Page has content:', hasContent);
      
      if (!hasContent) {
        console.warn('Page loaded but appears to be empty, waiting longer...');
        // Wait a bit more for React to hydrate
        setTimeout(() => {
          checkAndShowWindow();
        }, 2000);
      } else {
        checkAndShowWindow();
      }
    }).catch((err) => {
      console.error('Error checking page content:', err);
      // Show window anyway after delay
    setTimeout(() => {
        checkAndShowWindow();
      }, 1000);
    });
  });
  
  function checkAndShowWindow() {
    // Wait for Next.js to hydrate and render content
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds max
    
    const checkContent = () => {
      attempts++;
      
      mainWindow.webContents.executeJavaScript(`
        (function() {
          // Check for Next.js hydration markers or actual content
          const hasNextContent = document.querySelector('#__next') || 
                                 document.querySelector('[data-nextjs-root]') ||
                                 document.querySelector('main') ||
                                 document.querySelector('body > div');
          
          // Check for login page specific elements
          const hasLoginContent = document.querySelector('form') ||
                                  document.querySelector('input[type="text"]') ||
                                  document.querySelector('input[type="password"]') ||
                                  document.querySelector('button[type="submit"]');
          
          // Check if body has visible content
          const body = document.body;
          const hasVisibleContent = body && (
            body.children.length > 0 || 
            body.innerText.trim().length > 10 ||
            window.getComputedStyle(body).display !== 'none'
          );
          
          // Check for loading indicators (CircularProgress, spinners, etc.)
          const hasLoadingIndicator = document.querySelector('[role="progressbar"]') ||
                                      document.querySelector('.MuiCircularProgress-root') ||
                                      body.innerText.includes('Loading');
          
          return {
            hasNextContent: !!hasNextContent,
            hasLoginContent: !!hasLoginContent,
            hasVisibleContent: hasVisibleContent,
            hasLoadingIndicator: !!hasLoadingIndicator,
            bodyChildren: body ? body.children.length : 0,
            bodyText: body ? body.innerText.trim().substring(0, 100) : '',
            currentUrl: window.location.href
          };
        })();
      `).then((result) => {
        console.log('Content check result:', result);
        
        // Show window if we have actual content (not just loading indicators)
        const hasRealContent = (result.hasNextContent || result.hasLoginContent || result.hasVisibleContent) && 
                               !result.hasLoadingIndicator &&
                               result.bodyChildren > 0;
        
        if (hasRealContent) {
          console.log('Real content detected, showing window');
          if (splashWindow) {
            splashWindow.close();
            splashWindow = null;
          }
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        } else if (attempts < maxAttempts) {
          // If we see a loading indicator, that's progress - wait a bit more
          if (result.hasLoadingIndicator) {
            console.log('Loading indicator detected, waiting for content...');
          }
          // Wait a bit more for React/Next.js to render
          setTimeout(checkContent, 500);
        } else {
          // Timeout - show window anyway and log warning
          console.warn('Content check timeout, showing window anyway');
          console.warn('Last check result:', result);
          if (splashWindow) {
            splashWindow.close();
            splashWindow = null;
          }
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      }).catch((err) => {
        console.error('Error checking content:', err);
        // Fallback - show window anyway after a delay
        if (attempts >= maxAttempts) {
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
        } else {
          setTimeout(checkContent, 500);
        }
  });
    };
    
    // Start checking
    setTimeout(checkContent, 500);
  }

  // Handle load errors - keep splash visible and show error
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
    console.error('Current actualPort:', actualPort);
    // Don't close splash - show error dialog
    const { dialog } = require('electron');
    dialog.showErrorBox('Load Error', `Failed to load: ${errorDescription}\n\nURL: ${validatedURL}\nPort: ${actualPort}\n\nPlease check the console for more details.`);
  });
  
  // Enable console logging for debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer ${level}]:`, message);
    if (level >= 3) { // Error level
      console.error(`Renderer error at ${sourceId}:${line}:`, message);
    }
  });
  
  // Catch uncaught exceptions in renderer
  mainWindow.webContents.on('uncaught-exception', (event, error) => {
    console.error('Uncaught exception in renderer:', error);
  });
  
  // Catch JavaScript errors
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Render process gone:', details);
    const { dialog } = require('electron');
    dialog.showErrorBox('Render Error', `Render process crashed: ${details.reason}`);
  });
  
  // Log when DOM is ready
  mainWindow.webContents.on('dom-ready', () => {
    console.log('DOM ready');
  });

  // Only open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();

  // Wait for server to be ready, then load the URL
  waitForServer().then((port) => {
    // Load login page directly to avoid redirect delays
    const url = `http://127.0.0.1:${port}/login`;
    console.log('Server is ready, loading URL:', url);
    
    // Listen for navigation to handle redirects
    mainWindow.webContents.on('did-navigate', (event, navigationUrl) => {
      console.log('Navigated to:', navigationUrl);
    });
    
    mainWindow.webContents.on('did-navigate-in-page', (event, navigationUrl) => {
      console.log('In-page navigation to:', navigationUrl);
    });
    
    mainWindow.loadURL(url, {
      // Wait for all resources to load
      extraHeaders: ''
    });
  }).catch((err) => {
    console.error('Failed to connect to server:', err);
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    const { dialog } = require('electron');
    dialog.showErrorBox('Startup Error', `Failed to start server: ${err.message}\n\nPlease ensure PostgreSQL is running.`);
  });
}

function waitForServer(maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    if (actualPort) {
      // Server already started, verify it's still running
      const http = require('http');
      const url = `http://127.0.0.1:${actualPort}`;
      const req = http.get(url, { timeout: 2000 }, () => {
        resolve(actualPort);
      });
      req.on('error', () => {
        // Port might have changed, wait a bit and try again
        setTimeout(() => waitForServer().then(resolve).catch(reject), 1000);
      });
      return;
    }

    const http = require('http');
    let attempts = 0;
    
    const checkServer = () => {
      if (!actualPort) {
        // Still waiting for server to start and assign a port
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkServer, 500);
        } else {
          reject(new Error(`Server not responding after ${maxAttempts} attempts`));
        }
        return;
      }

      attempts++;
      const url = `http://127.0.0.1:${actualPort}`;
      const req = http.get(url, { timeout: 2000 }, () => {
        resolve(actualPort);
      });
      
      req.on('error', (err) => {
        if (attempts < maxAttempts) {
          setTimeout(checkServer, 1000);
        } else {
          reject(new Error(`Server not responding after ${maxAttempts} attempts`));
        }
      });
      
      req.setTimeout(2000, () => {
        req.destroy();
        if (attempts < maxAttempts) {
          setTimeout(checkServer, 1000);
        } else {
          reject(new Error('Server timeout'));
        }
      });
    };
    
    setTimeout(checkServer, 2000);
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Sale', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('navigate', '/pos') },
        { type: 'separator' },
        { label: 'Print', accelerator: 'CmdOrCtrl+P', click: () => mainWindow.webContents.print() },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        { label: 'Dashboard', click: () => mainWindow.loadURL(`http://127.0.0.1:${actualPort || 3000}/dashboard`) },
        { label: 'POS', click: () => mainWindow.loadURL(`http://127.0.0.1:${actualPort || 3000}/pos`) },
        { label: 'Products', click: () => mainWindow.loadURL(`http://127.0.0.1:${actualPort || 3000}/products`) },
        { label: 'Sales', click: () => mainWindow.loadURL(`http://127.0.0.1:${actualPort || 3000}/sales`) },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Posify',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Posify',
              message: 'Posify',
              detail: 'Version 1.0.0\n\nPoint of Sale System\n\n© 2024 Posify',
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Start Next.js server
function startNextServer() {
  return new Promise(async (resolve, reject) => {
    // Find an available port first
    try {
      actualPort = await findAvailablePort(0); // 0 = let OS assign a random port
      console.log('Using port:', actualPort);
    } catch (err) {
      console.error('Failed to find available port:', err);
      actualPort = 0; // Fallback to let Next.js choose
    }

    if (isDev) {
      // Development mode: use custom server script
      const cwdPath = path.join(__dirname, '..');
      const serverFile = path.join(cwdPath, 'server.js');
      
      if (!fs.existsSync(serverFile)) {
        reject(new Error('server.js not found. Please ensure it exists in the project root.'));
        return;
      }
      
      console.log('Starting Next.js development server on port', actualPort);
      
      // Use a temp file to communicate the actual port back
      const portFile = path.join(cwdPath, '.electron-port');
      
      serverProcess = spawn('node', ['server.js'], {
        shell: true,
        cwd: cwdPath,
        env: { 
          ...process.env, 
          PORT: String(actualPort),
          HOSTNAME: '127.0.0.1',
          NODE_ENV: 'development',
          PORT_FILE: portFile
        },
        stdio: 'pipe',
      });
      
      // Clean up port file on exit
      serverProcess.on('exit', () => {
        try {
          if (fs.existsSync(portFile)) {
            fs.unlinkSync(portFile);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      });
      
      // Watch for port file to be created and update actualPort
      const checkPortFile = setInterval(() => {
        try {
          if (fs.existsSync(portFile)) {
            const portFromFile = parseInt(fs.readFileSync(portFile, 'utf8').trim(), 10);
            if (portFromFile && portFromFile !== actualPort) {
              actualPort = portFromFile;
              console.log('Server bound to port:', actualPort);
            }
          }
        } catch (e) {
          // Ignore read errors
        }
      }, 500);
      
      // Stop checking after 10 seconds
      setTimeout(() => clearInterval(checkPortFile), 10000);
      
      setupServerListeners(serverProcess, resolve, reject);
    } else {
      // Production mode: spawn the standalone server as a SEPARATE PROCESS
      // This is critical - the standalone server must run in its own process
      // for API routes to work correctly
      const appPath = app.getAppPath();
      const resourcesPath = process.resourcesPath || path.dirname(appPath);
      
      console.log('App path:', appPath);
      console.log('Resources path:', resourcesPath);
      
      // Find server.js in various locations
      const possiblePaths = [
        path.join(resourcesPath, '.next', 'standalone', 'server.js'),
        path.join(resourcesPath, 'app.asar.unpacked', '.next', 'standalone', 'server.js'),
        path.join(appPath, '.next', 'standalone', 'server.js'),
        path.join(__dirname, '..', '.next', 'standalone', 'server.js'),
      ];
      
      let serverPath = null;
      let serverDir = null;
      for (const p of possiblePaths) {
        try {
          if (fs.existsSync(p) && fs.statSync(p).isFile()) {
            serverPath = p;
            serverDir = path.dirname(serverPath);
            console.log('Found server at:', serverPath);
            console.log('Server directory:', serverDir);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!serverPath || !serverDir) {
        console.error('Server not found. Tried:', possiblePaths);
        reject(new Error('Server file not found. Make sure you ran "npm run build" first.'));
        return;
      }
      
      console.log('Starting Next.js production server as child process...');
      console.log('Port:', actualPort);
      console.log('Hostname: 127.0.0.1');
      
      // Verify the server file exists and is accessible
      if (!fs.existsSync(serverPath)) {
        console.error('Server file does not exist:', serverPath);
        reject(new Error(`Server file not found: ${serverPath}`));
        return;
      }
      
      // Use a temp file to communicate the actual port back
      const portFile = path.join(serverDir, '.electron-port');
      
      // Ensure Next.js can find static files
      const staticPath = path.join(serverDir, '.next', 'static');
      const staticPathAlt = path.join(serverDir, '..', 'static');
      const staticPathAlt2 = path.join(resourcesPath, '.next', 'static');
      
      console.log('Checking for static files...');
      if (fs.existsSync(staticPath)) {
        console.log('✓ Static files found at:', staticPath);
      } else if (fs.existsSync(staticPathAlt)) {
        console.log('✓ Static files found at alternative location:', staticPathAlt);
        try {
          if (!fs.existsSync(path.dirname(staticPath))) {
            fs.mkdirSync(path.dirname(staticPath), { recursive: true });
          }
          fs.symlinkSync(path.relative(path.dirname(staticPath), staticPathAlt), staticPath, 'dir');
          console.log('✓ Created symlink to static files');
        } catch (err) {
          console.error('Failed to create symlink:', err);
        }
      } else if (fs.existsSync(staticPathAlt2)) {
        console.log('✓ Static files found at resources location:', staticPathAlt2);
      } else {
        console.error('✗ WARNING: Static files not found in any location!');
      }
      
      // Run the server in the same process using require()
      // Note: We must set up the environment before requiring the server
      console.log('Starting Next.js server in-process...');
      
      // Change to server directory and set environment
      const originalCwd = process.cwd();
      
      try {
        process.chdir(serverDir);
        process.env.NODE_ENV = 'production';
        process.env.PORT = String(actualPort);
        process.env.HOSTNAME = '127.0.0.1';
        process.env.ELECTRON_APP_PATH = serverDir;
        process.env.PORT_FILE = portFile;
        process.env.NEXT_RUNTIME = 'nodejs';
        process.env.NEXTAUTH_URL = `http://127.0.0.1:${actualPort}`;
        if (!process.env.NEXTAUTH_SECRET) {
          process.env.NEXTAUTH_SECRET = 'posify-electron-secret-key-2024';
        }
        
        // Ensure DATABASE_URL is set (should have been loaded from .env)
        if (!process.env.DATABASE_URL) {
          console.error('WARNING: DATABASE_URL is not set! Database operations will fail.');
        } else {
          console.log('  DATABASE_URL:', process.env.DATABASE_URL.substring(0, 30) + '...');
        }
        
        console.log('Environment configured, loading server module...');
        console.log('  CWD:', process.cwd());
        console.log('  PORT:', process.env.PORT);
        console.log('  NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
        
        // Require the standalone server - it will start automatically
        require(serverPath);
        console.log('Next.js server module loaded');
        
        // Watch for port file to be created and update actualPort
        const checkPortFile = setInterval(() => {
          try {
            if (fs.existsSync(portFile)) {
              const portFromFile = parseInt(fs.readFileSync(portFile, 'utf8').trim(), 10);
              if (portFromFile && portFromFile !== actualPort) {
                console.log('Server bound to port:', portFromFile);
                actualPort = portFromFile;
              }
            }
          } catch (e) {
            // Ignore read errors
          }
        }, 500);
        
        // Stop checking after 10 seconds
        setTimeout(() => clearInterval(checkPortFile), 10000);
        
        // Give server time to start, then resolve
        setTimeout(() => {
          process.chdir(originalCwd);
          resolve();
        }, 3000);
        
      } catch (requireErr) {
        console.error('Failed to load server module:', requireErr);
        process.chdir(originalCwd);
        reject(new Error(`Failed to load server: ${requireErr.message}`));
      }
    }
  });
}

function setupServerListeners(server, resolve, reject) {
  let serverReady = false;
  
  server.stdout?.on('data', (data) => {
    const output = data.toString();
    console.log('Next.js:', output);
    // Check for various server ready indicators
    if ((output.includes('Ready') || 
         output.includes('started server') || 
         output.includes('Local:') || 
         output.includes('compiled') ||
         output.includes('○') || 
         output.includes('✓') ||
         output.includes('started') ||
         output.includes('listening') ||
         output.includes('http://')) && !serverReady) {
      serverReady = true;
      // Give server a moment to fully bind to port
      setTimeout(() => {
        console.log('Server ready, resolving...');
        resolve();
      }, 2000);
    }
  });

  server.stderr?.on('data', (data) => {
    const output = data.toString();
    console.log('Next.js stderr:', output);
    // Some servers output ready messages to stderr
    if ((output.includes('Ready') || 
         output.includes('started server') || 
         output.includes('Local:') ||
         output.includes('listening') ||
         output.includes('http://')) && !serverReady) {
      serverReady = true;
      setTimeout(() => {
        console.log('Server ready (from stderr), resolving...');
        resolve();
      }, 2000);
    }
    // Check for actual errors
    if (output.includes('Error') || output.includes('error') || output.includes('EADDRINUSE')) {
      console.error('Server error detected:', output);
    }
  });

  server.on('error', (err) => {
    console.error('Server process error:', err);
    if (!serverReady) {
    reject(err);
    }
  });

  server.on('exit', (code) => {
    console.log('Server process exited with code:', code);
    if (!serverReady && code !== 0) {
      reject(new Error(`Server exited with code ${code}`));
    }
  });

  // Timeout fallback - also try to connect to verify server is up
  setTimeout(() => {
    if (!serverReady) {
      console.log('Server startup timeout, checking if server is actually running...');
      // Try to verify server is running by checking the port
      waitForServer().then(() => {
        console.log('Server verified running, resolving...');
        serverReady = true;
        resolve();
      }).catch((err) => {
        console.log('Server not responding, but proceeding anyway...', err.message);
        // Still resolve - maybe server is running but not outputting expected messages
        serverReady = true;
      resolve();
      });
    }
  }, 15000);
}

// Function to start the application
async function startApplication() {
  try {
    updateSplashStatus('Starting server...');
    await startNextServer();
    
    updateSplashStatus('Checking database connection...');
    
    // Test database connection by making a request to an API endpoint
    const testDbConnection = () => {
      return new Promise((resolve, reject) => {
        const http = require('http');
        const testUrl = `http://127.0.0.1:${actualPort}/api/settings`;
        
        const req = http.get(testUrl, { timeout: 10000 }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.error && json.error.includes('database')) {
                reject(new Error('Database connection failed'));
              } else {
                resolve(true);
              }
            } catch (e) {
              // If we got a response, server is at least running
              resolve(true);
            }
          });
        });
        
        req.on('error', (err) => {
          reject(new Error(`Server not responding: ${err.message}`));
        });
        
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Connection timeout'));
        });
      });
    };
    
    // Wait a bit for server to fully initialize, then test DB
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      await testDbConnection();
      updateSplashStatus('Ready!');
      createWindow();
    } catch (dbError) {
      console.error('Database connection test failed:', dbError);
      showSplashError('database', 'Unable to connect to the database. Please ensure PostgreSQL is running and try again.');
    }
    
  } catch (error) {
    console.error('Failed to start application:', error);
    const errorMessage = error.message || 'Unknown error';
    
    if (errorMessage.includes('database') || errorMessage.includes('ECONNREFUSED')) {
      showSplashError('database', 'Unable to connect to the database. Please ensure PostgreSQL is running and try again.');
    } else {
      showSplashError('server', `Failed to start server: ${errorMessage}`);
    }
  }
}

// IPC handlers for splash screen
const { ipcMain } = require('electron');

ipcMain.on('app-retry', () => {
  console.log('Retry requested from splash screen');
  // Reset and try again
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    mainWindow = null;
  }
  startApplication();
});

ipcMain.on('app-quit', () => {
  console.log('Quit requested from splash screen');
  app.quit();
});

// App lifecycle
app.whenReady().then(async () => {
  try {
    // Show splash screen immediately
    createSplashWindow();
    
    // Start the application
    startApplication();
    
  } catch (error) {
    console.error('Error in app.whenReady:', error);
    showSplashError('server', `Application failed to start: ${error.message}`);
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createSplashWindow();
    startApplication();
  }
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});

