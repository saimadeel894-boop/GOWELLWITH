const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs');

const token = process.env.GITHUB_TOKEN || process.argv[2];

if (!token) {
  console.log('Usage: node git-push.js <GITHUB_TOKEN>');
  process.exit(1);
}

async function push() {
  console.log('Pushing to https://github.com/saimadeel894-boop/GOWELLWITH.git...');
  const pushResult = await git.push({
    fs,
    http,
    dir: __dirname,
    remote: 'origin',
    ref: 'main',
    onAuth: () => ({ username: token })
  });
  console.log('✓ Push result:', pushResult);
}

push().catch(err => {
  console.error('Push failed:', err.message);
  process.exit(1);
});
