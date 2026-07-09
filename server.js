const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { parse } = require('querystring');

const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'dashboard-data.json');

const validUsers = {
  's.admin@gmail.com': 'sk12345',
  'you@gmail.com': 'your-own-password'
};

const initialData = {
  active: [
    { id: 'sk-1', name: 'Mia Chen', role: 'Lead SK', status: 'On shift' },
    { id: 'sk-2', name: 'Jamal Reed', role: 'Floor SK', status: 'Available' },
    { id: 'sk-3', name: 'Sofia Patel', role: 'Studio SK', status: 'On break' }
  ],
  sick: [
    { id: 'sick-1', name: 'Noah Brooks', date: '2026-07-08', days: 2, notes: 'Flu symptoms' },
    { id: 'sick-2', name: 'Ava Torres', date: '2026-07-09', days: 1, notes: 'Migraine' }
  ]
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(initialData, null, 2));
  }
}

function loadDashboardData() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      active: Array.isArray(parsed.active) ? parsed.active : initialData.active,
      sick: Array.isArray(parsed.sick) ? parsed.sick : initialData.sick
    };
  } catch (error) {
    return JSON.parse(JSON.stringify(initialData));
  }
}

function saveDashboardData(data) {
  ensureStorage();
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function serveStatic(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let requestedPath = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;

  if (requestedPath === '/dashboard') {
    requestedPath = '/dashboard.html';
  }

  const safePath = path.normalize(requestedPath).replace(/^\.+/, '');
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

let dashboardData = loadDashboardData();

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'POST' && pathname === '/login') {
    try {
      const body = await readBody(req);
      let data = {};

      if (req.headers['content-type']?.includes('application/json')) {
        data = JSON.parse(body);
      } else {
        data = parse(body);
      }

      const email = (data.email || '').trim().toLowerCase();
      const password = (data.password || '').trim();

      if (validUsers[email] && validUsers[email] === password) {
        sendJson(res, 200, {
          success: true,
          redirect: '/dashboard.html',
          message: `Welcome back, ${email.split('@')[0]}!`
        });
      } else {
        sendJson(res, 401, {
          success: false,
          message: 'Invalid email or password. Try s.Admin@gmail.com / sk12345.'
        });
      }
    } catch (error) {
      sendJson(res, 400, {
        success: false,
        message: 'Invalid request payload.'
      });
    }
    return;
  }

  if (req.method === 'GET' && pathname === '/api/dashboard') {
    sendJson(res, 200, dashboardData);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/sick') {
    try {
      const body = await readBody(req);
      const data = JSON.parse(body);
      const entry = {
        id: `sick-${Date.now()}`,
        name: (data.name || '').trim(),
        date: (data.date || '').trim(),
        days: Number(data.days) || 1,
        notes: (data.notes || '').trim()
      };

      if (!entry.name || !entry.date) {
        sendJson(res, 400, { success: false, message: 'Name and date are required.' });
        return;
      }

      dashboardData.sick.unshift(entry);
      saveDashboardData(dashboardData);
      sendJson(res, 201, { success: true, data: dashboardData });
    } catch (error) {
      sendJson(res, 400, { success: false, message: 'Unable to add sick leave entry.' });
    }
    return;
  }

  if (req.method === 'PUT' && pathname.startsWith('/api/sick/')) {
    try {
      const id = pathname.split('/').pop();
      const body = await readBody(req);
      const data = JSON.parse(body);
      const entryIndex = dashboardData.sick.findIndex((entry) => entry.id === id);

      if (entryIndex === -1) {
        sendJson(res, 404, { success: false, message: 'Entry not found.' });
        return;
      }

      dashboardData.sick[entryIndex] = {
        ...dashboardData.sick[entryIndex],
        name: (data.name || '').trim(),
        date: (data.date || '').trim(),
        days: Number(data.days) || 1,
        notes: (data.notes || '').trim()
      };

      saveDashboardData(dashboardData);
      sendJson(res, 200, { success: true, data: dashboardData });
    } catch (error) {
      sendJson(res, 400, { success: false, message: 'Unable to update sick leave entry.' });
    }
    return;
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/sick/')) {
    try {
      const id = pathname.split('/').pop();
      dashboardData.sick = dashboardData.sick.filter((entry) => entry.id !== id);
      saveDashboardData(dashboardData);
      sendJson(res, 200, { success: true, data: dashboardData });
    } catch (error) {
      sendJson(res, 400, { success: false, message: 'Unable to delete sick leave entry.' });
    }
    return;
  }

  if (req.method === 'POST' && pathname.startsWith('/api/active/')) {
    try {
      const id = pathname.split('/').pop();
      const entry = dashboardData.active.find((person) => person.id === id);

      if (!entry) {
        sendJson(res, 404, { success: false, message: 'SK not found.' });
        return;
      }

      entry.status = entry.status === 'Available' ? 'On shift' : 'Available';
      saveDashboardData(dashboardData);
      sendJson(res, 200, { success: true, data: dashboardData });
    } catch (error) {
      sendJson(res, 400, { success: false, message: 'Unable to update SK status.' });
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Dashboard running at http://localhost:${port}`);
});
