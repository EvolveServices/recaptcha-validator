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

app.use(express.json());
app.use(cors({ origin: '*' }));

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

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server listening on port', PORT);
});
