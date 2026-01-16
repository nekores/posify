// Custom Next.js server that binds to a specific port on localhost only
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '127.0.0.1'; // Bind only to localhost
const port = parseInt(process.env.PORT || '0', 10); // 0 = random port

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  server.listen(port, hostname, (err) => {
    if (err) throw err;
    const actualPort = server.address().port;
    console.log(`> Ready on http://${hostname}:${actualPort}`);
    // Write port to a file so Electron can read it
    if (process.env.PORT_FILE) {
      require('fs').writeFileSync(process.env.PORT_FILE, String(actualPort));
    }
  });
});

