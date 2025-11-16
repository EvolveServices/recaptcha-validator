const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors({ origin: '*' }));

const sites = new Map();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', sites: sites.size });
});

app.post('/api/admin/register', (req, res) => {
  const { domain, siteKey, secretKey } = req.body;
  const adminToken = req.headers['x-admin-token'];
  
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  sites.set(siteKey, { domain, secretKey, createdAt: new Date().toISOString() });
  console.log(`✅ Registered: ${domain}`);
  res.json({ success: true, domain, siteKey });
});

app.get('/api/admin/sites', (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const siteList = Array.from(sites.entries()).map(([siteKey, data]) => ({
    siteKey, domain: data.domain, createdAt: data.createdAt
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
    console.log(`Verify ${site.domain}: score=${score}`);
    
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

Push these to your repo.

## Step 2: Deploy in Coolify UI

### Add New Resource
1. Go to your Coolify dashboard
2. Click **"+ Add"** or **"New Resource"**
3. Select **"Application"**

### Configure Source
1. **Source**: Choose your Git provider (GitHub/GitLab/Gitea)
2. **Repository**: Select the repo you just created
3. **Branch**: `main` or `master`
4. **Build Pack**: Coolify should auto-detect **Nixpacks** (Node.js)

### Configure Application
1. **Name**: `recaptcha-validator`
2. **Port**: `3000`
3. **Start Command**: Leave empty (uses npm start)

### Environment Variables
Click **"Environment Variables"** tab and add:
```
ADMIN_TOKEN=your-super-secret-token-change-this-now
PORT=3000
NODE_ENV=production
