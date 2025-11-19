const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

console.log('=================================');
console.log('Starting reCAPTCHA Validator');
console.log('Port:', PORT);
console.log('Admin Token:', ADMIN_TOKEN ? 'SET' : 'MISSING');
console.log('=================================');

if (!ADMIN_TOKEN) {
  console.error('FATAL: ADMIN_TOKEN not set');
  process.exit(1);
}

// CORS configuration - MUST be before routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-admin-token'],
  credentials: false
}));

app.use(express.json());

// Explicit OPTIONS handler for preflight
app.options('*', cors());

// Request logging middleware - MUST be after body parsers but before routes
app.use((req, res, next) => {
  console.log('----------------------------');
  console.log('Incoming Request:');
  console.log('  Method:', req.method);
  console.log('  Path:', req.path);
  console.log('  URL:', req.url);
  console.log('  Original URL:', req.originalUrl);
  console.log('  Headers:', JSON.stringify(req.headers, null, 2));
  console.log('  Body:', JSON.stringify(req.body, null, 2));
  console.log('----------------------------');
  next();
});

const sites = new Map();

app.get('/', (req, res) => {
  res.json({ service: 'reCAPTCHA Validator', status: 'running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', sites: sites.size });
});

app.post('/api/admin/register', (req, res) => {
  const { domain, siteKey, secretKey } = req.body;
  const adminToken = req.headers['x-admin-token'];
  
  if (adminToken !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  sites.set(siteKey, { domain, secretKey, createdAt: new Date().toISOString() });
  console.log('Registered:', domain);
  res.json({ success: true, domain, siteKey });
});

app.get('/api/admin/sites', (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  
  if (adminToken !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const siteList = Array.from(sites.entries()).map(([siteKey, data]) => ({
    siteKey,
    domain: data.domain,
    createdAt: data.createdAt
  }));
  
  res.json({ sites: siteList, count: siteList.length });
});

app.post('/api/verify', async (req, res) => {
  try {
    const { token, siteKey } = req.body;
    
    if (!token || !siteKey) {
      return res.status(400).json({ success: false, error: 'Missing token or siteKey' });
    }
    
    const site = sites.get(siteKey);
    if (!site) {
      return res.status(400).json({ success: false, error: 'Invalid siteKey' });
    }
    
    const verifyResponse = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      { params: { secret: site.secretKey, response: token } }
    );
    
    const { success, score, action } = verifyResponse.data;
    console.log('Verify', site.domain, 'score:', score);
    
    res.json({
      success,
      score,
      action,
      isHuman: success && score >= 0.5
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// 404 handler - MUST be after all routes
app.use((req, res) => {
  console.error('404 NOT FOUND:');
  console.error('  Method:', req.method);
  console.error('  Path:', req.path);
  console.error('  URL:', req.url);
  console.error('  Original URL:', req.originalUrl);
  console.error('Available routes:');
  console.error('  GET /');
  console.error('  GET /health');
  console.error('  POST /api/admin/register');
  console.error('  GET /api/admin/sites');
  console.error('  POST /api/verify');
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    message: 'The requested endpoint does not exist'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server listening on port', PORT);
});
