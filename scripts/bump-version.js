#!/usr/bin/env node

/**
 * Appu Release Channel & Version Management Script
 * Usage:
 *   node scripts/bump-version.js [patch|minor|major|beta|prerelease]
 *   node scripts/bump-version.js 1.2.0-beta.1
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const arg = process.argv[2] || 'patch';

let newVersion = '';
const currentVersion = pkg.version;
const [major, minor, patch] = currentVersion.split(/[-.]/).map((n) => parseInt(n, 10));

if (arg === 'patch') {
  newVersion = `${major}.${minor}.${patch + 1}`;
} else if (arg === 'minor') {
  newVersion = `${major}.${minor + 1}.0`;
} else if (arg === 'major') {
  newVersion = `${major + 1}.0.0`;
} else if (arg === 'beta') {
  if (currentVersion.includes('-beta.')) {
    const parts = currentVersion.split('-beta.');
    const betaNum = parseInt(parts[1], 10) + 1;
    newVersion = `${parts[0]}-beta.${betaNum}`;
  } else {
    newVersion = `${major}.${minor + 1}.0-beta.1`;
  }
} else if (/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(arg)) {
  newVersion = arg;
} else {
  console.error(`Invalid version argument: ${arg}`);
  console.log('Use: patch, minor, major, beta, or an explicit version like 1.2.0');
  process.exit(1);
}

const channel = newVersion.includes('-beta')
  ? 'beta'
  : newVersion.includes('-dev')
  ? 'development'
  : 'stable';

console.log(`=======================================`);
console.log(`Appu Version Bump`);
console.log(`Current: v${currentVersion}`);
console.log(`Target:  v${newVersion}`);
console.log(`Channel: ${channel}`);
console.log(`=======================================`);

pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// Update package-lock.json if present
const lockPath = path.join(__dirname, '..', 'package-lock.json');
if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lock.version = newVersion;
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = newVersion;
  }
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
}

console.log(`✓ Updated package.json and package-lock.json to v${newVersion}`);
console.log(`\nNext steps to publish:`);
console.log(`  git add package.json package-lock.json`);
console.log(`  git commit -m "chore(release): v${newVersion}"`);
console.log(`  git tag v${newVersion}`);
console.log(`  git push origin main --tags`);
