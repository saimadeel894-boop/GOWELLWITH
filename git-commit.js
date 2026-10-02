const git = require('isomorphic-git');
const fs = require('fs');
const path = require('path');

async function commitProject() {
  const dir = __dirname;
  console.log('Initializing Git repository in:', dir);

  // 1. Git init
  await git.init({ fs, dir });
  console.log('✓ Git repository initialized');

  // 2. Collect all files except node_modules, .git, deploy.zip, scratch files
  function getAllFiles(currentDir, relativePath = '') {
    let results = [];
    const list = fs.readdirSync(currentDir);
    for (const file of list) {
      if (file === 'node_modules' || file === '.git' || file === 'deploy.zip') continue;
      const fullPath = path.join(currentDir, file);
      const rel = relativePath ? `${relativePath}/${file}` : file;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(getAllFiles(fullPath, rel));
      } else {
        results.push(rel);
      }
    }
    return results;
  }

  const files = getAllFiles(dir);
  console.log(`✓ Adding ${files.length} project files to git index...`);

  for (const f of files) {
    await git.add({ fs, dir, filepath: f });
  }

  // 3. Commit
  const sha = await git.commit({
    fs,
    dir,
    author: {
      name: 'GoWellWith Developer',
      email: 'dev@gowellwith.com'
    },
    message: 'feat: GoWellWith Social-Commerce Phase 1 MVP with Stripe Connect & 3-way split'
  });
  console.log('✓ Committed with SHA:', sha);

  // 4. Branch main
  await git.branch({ fs, dir, ref: 'main', object: sha, checkout: true });
  console.log('✓ Set branch to main');

  // 5. Add remote origin
  const remoteUrl = 'https://github.com/saimadeel894-boop/GOWELLWITH.git';
  try {
    await git.addRemote({ fs, dir, remote: 'origin', url: remoteUrl, force: true });
  } catch (e) {
    // If already exists
  }
  console.log('✓ Remote origin set to:', remoteUrl);
}

commitProject().catch(console.error);
