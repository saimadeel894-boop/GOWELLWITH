// Deploy Script for GoWellWith to Netlify using the official Netlify REST API
// Bypasses heavy CLI dependencies and executes directly via native Node.js HTTP/Zip.

const fs = require('fs');
const path = require('path');
const https = require('https');

const SITE_NAME = 'gowellwith';
const EXPECTED_TEAM = 'ellbies';
const TOKEN = process.env.NETLIFY_AUTH_TOKEN || process.argv[2];

if (!TOKEN) {
  console.error('ERROR: No Netlify Access Token provided.');
  console.error('Usage: node deploy-to-netlify.js <NETLIFY_AUTH_TOKEN>');
  console.error('Or set NETLIFY_AUTH_TOKEN in environment.');
  process.exit(1);
}

function apiRequest(endpoint, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint.startsWith('http') ? endpoint : `https://api.netlify.com/api/v1${endpoint}`);
    const reqHeaders = {
      'Authorization': `Bearer ${TOKEN}`,
      'User-Agent': 'GoWellWith-Deployer/1.0',
      ...headers
    };

    if (data && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const req = https.request(url, { method, headers: reqHeaders }, (res) => {
      let chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';
        let parsed = bodyBuffer.toString('utf8');
        if (contentType.includes('application/json')) {
          try { parsed = JSON.parse(parsed); } catch (e) {}
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(new Error(`Netlify API Error (${res.statusCode}): ${JSON.stringify(parsed)}`));
        }
      });
    });

    req.on('error', reject);
    if (data) {
      if (Buffer.isBuffer(data)) {
        req.write(data);
      } else if (typeof data === 'object') {
        req.write(JSON.stringify(data));
      } else {
        req.write(data);
      }
    }
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log(' GoWellWith -> Netlify Deployment Pipeline');
  console.log('====================================================');

  // 1. Inspect user / team
  console.log('\n[1/5] Inspecting Netlify Account & Teams...');
  const user = await apiRequest('/user');
  console.log(`✓ Authenticated as: ${user.email} (${user.full_name || 'Netlify User'})`);

  const accounts = await apiRequest('/accounts');
  console.log(`✓ Accessible teams (${accounts.length}):`);
  accounts.forEach(acc => {
    console.log(`  - Team: "${acc.name}" (Slug: ${acc.slug}, ID: ${acc.id})`);
  });

  const matchingTeam = accounts.find(a => a.slug === EXPECTED_TEAM || a.name.toLowerCase() === EXPECTED_TEAM.toLowerCase());
  if (matchingTeam) {
    console.log(`✓ Target team "${EXPECTED_TEAM}" confirmed (ID: ${matchingTeam.id})`);
  } else {
    console.warn(`! Note: Team slug "${EXPECTED_TEAM}" was not an exact match in accounts list, searching all sites...`);
  }

  // 2. Locate Site
  console.log(`\n[2/5] Locating site "${SITE_NAME}"...`);
  const sites = await apiRequest('/sites');
  const targetSite = sites.find(s => s.name === SITE_NAME || s.custom_domain === 'gowellwith.netlify.app' || (s.url && s.url.includes(SITE_NAME)));

  if (!targetSite) {
    console.error(`ERROR: Site "${SITE_NAME}" not found in your Netlify account.`);
    console.log('Available sites:');
    sites.forEach(s => console.log(`  - ${s.name} (${s.url})`));
    process.exit(1);
  }

  console.log(`✓ Site found: ${targetSite.name}`);
  console.log(`  Site ID: ${targetSite.site_id || targetSite.id}`);
  console.log(`  Live URL: ${targetSite.ssl_url || targetSite.url}`);
  console.log(`  Account/Team: ${targetSite.account_name} (${targetSite.account_slug})`);
  console.log(`  Deploy settings:`);
  console.log(`    Repo: ${targetSite.build_settings && targetSite.build_settings.repo_url ? targetSite.build_settings.repo_url : 'None (Direct Upload)'}`);
  console.log(`    Branch: ${targetSite.build_settings && targetSite.build_settings.repo_branch ? targetSite.build_settings.repo_branch : 'N/A'}`);
  console.log(`    Cmd: ${targetSite.build_settings && targetSite.build_settings.cmd ? targetSite.build_settings.cmd : 'N/A'}`);
  console.log(`    Dir: ${targetSite.build_settings && targetSite.build_settings.dir ? targetSite.build_settings.dir : 'public'}`);

  // 3. Inspect Site Environment Variables
  console.log('\n[3/5] Inspecting Site Environment Variables...');
  try {
    const envVars = await apiRequest(`/accounts/${targetSite.account_id}/env`);
    const varKeys = Array.isArray(envVars) ? envVars.map(v => v.key) : Object.keys(envVars || {});
    console.log(`✓ Team environment variables found: ${varKeys.length}`);
    const hasStripe = varKeys.some(k => k.includes('STRIPE'));
    if (hasStripe) {
      console.log(`  Stripe keys detected in Netlify environment!`);
    } else {
      console.log(`  No Stripe keys found in Netlify environment. Running in Demo Stripe Mode.`);
    }
  } catch (e) {
    console.log('  (Could not read team env vars via API: ' + e.message + ')');
  }

  // 4. Create and upload deploy package
  console.log('\n[4/5] Uploading deployment to Netlify...');
  const zipPath = path.join(__dirname, 'deploy.zip');
  if (!fs.existsSync(zipPath)) {
    throw new Error('deploy.zip not found! Generate it before running.');
  }

  const zipBuffer = fs.readFileSync(zipPath);
  console.log(`✓ Deploy package size: ${(zipBuffer.length / 1024).toFixed(1)} KB`);

  const deploy = await apiRequest(
    `/sites/${targetSite.site_id || targetSite.id}/deploys`,
    'POST',
    zipBuffer,
    { 'Content-Type': 'application/zip' }
  );

  console.log(`✓ Deploy initiated: ID ${deploy.id}`);
  console.log(`  State: ${deploy.state}`);
  console.log(`  Deploy URL: ${deploy.deploy_ssl_url || deploy.deploy_url}`);

  // 5. Poll for Ready
  console.log('\n[5/5] Waiting for deployment to finalize...');
  let deployState = deploy.state;
  let attempts = 0;
  while (deployState !== 'ready' && deployState !== 'error' && attempts < 20) {
    await new Promise(r => setTimeout(r, 2000));
    attempts++;
    const current = await apiRequest(`/deploys/${deploy.id}`);
    deployState = current.state;
    process.stdout.write(`  Status: ${deployState} (attempt ${attempts}/20)\r`);
  }
  console.log('');

  if (deployState === 'ready') {
    console.log('\n====================================================');
    console.log(' DEPLOYMENT SUCCESSFUL! ✓');
    console.log(` Live Production URL: https://gowellwith.netlify.app/`);
    console.log('====================================================\n');
  } else {
    console.error(`Deploy ended with state: ${deployState}`);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('\nDeployment Failed:', err.message);
  process.exit(1);
});
