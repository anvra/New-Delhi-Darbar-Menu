/*
  Verify that the public GitHub Pages build leaks nothing.

  Builds the same allow-listed directory the deploy workflow builds, then
  asserts hard security properties about it. Run before every deploy:

      node scripts/verify-public-build.cjs

  This is the local mirror of the check that runs in CI, so a leak is caught
  on a laptop rather than after it is already on the internet.
*/
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');

/* The single source of truth for what the public site may contain. */
const ALLOWED = [
  'index.html',
  'src/pages/menu.css',
  'src/pages/menu.js',
  'src/core/store.js',
  'src/core/glossary.js',
  'src/core/i18n.js',
  'src/core/config.js',
  'src/core/menu-fallback.js',
  'assets/data/menu.csv',
  'assets/img/logo-light.png',
  'assets/img/logo-dark.png',
  'assets/img/favicon-light.png',
  'assets/img/favicon-dark.png'
];

/* Anything matching these must never appear in the published output. */
const FORBIDDEN_FILES = [
  'admin.html',
  'src/pages/admin.js',
  'src/pages/admin.css',
  'src/core/admin-auth.js',
  'src/core/github-publish.js',
  'src/core/admin-credentials.js',
  'src/core/admin-credentials.sample.js',
  'package.json',
  'package-lock.json',
  'README.md',
  '.gitignore'
];

const FORBIDDEN_DIRS = ['scripts', '.github', 'worker', 'node_modules', '.git'];

/*
  Substrings that would indicate a secret or an admin-only capability leaked
  into the public build. There is no backend in this architecture: the
  phone/password check and the GitHub-publish logic both run in admin.js/
  admin-auth.js/github-publish.js, which are themselves forbidden files above
  — but this list is a second, content-based line of defense in case any of
  that logic or its identifiers ever got copy-pasted into a file that IS
  allow-listed for publishing.
*/
const FORBIDDEN_STRINGS = [
  { pattern: /github_pat_[A-Za-z0-9_]{20,}/, label: 'a GitHub fine-grained token' },
  { pattern: /ghp_[A-Za-z0-9]{20,}/, label: 'a GitHub classic token' },
  { pattern: /BEGIN [A-Z ]*PRIVATE KEY/, label: 'a private key' },
  { pattern: /NDDAdminAuth/, label: 'the admin login module' },
  { pattern: /NDDGitHubPublish/, label: 'the GitHub publish module' },
  { pattern: /NDD_CREDENTIALS/, label: 'the admin credentials hook' },
  { pattern: /ndd-admin-session/, label: 'the admin session storage key' },
  { pattern: /api\.github\.com/, label: 'a direct GitHub API call' }
];

let failures = [];
let checks = 0;

function assert(condition, message) {
  checks++;
  if (!condition) failures.push(message);
}

function buildPublic(dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  for (const rel of ALLOWED) {
    const from = path.join(ROOT, rel);
    if (!fs.existsSync(from)) {
      failures.push(`allow-listed file is missing from the repo: ${rel}`);
      continue;
    }
    const to = path.join(dest, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
  fs.writeFileSync(path.join(dest, '.nojekyll'), '');
}

function walk(dir, base) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.posix.join(base || '', entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, rel));
    else out.push(rel);
  }
  return out;
}

function main() {
  // `--out <dir>` builds the real publishing directory (used by CI) instead of
  // a throwaway copy, so the thing verified is exactly the thing deployed.
  const outFlag = process.argv.indexOf('--out');
  const explicitOut = outFlag !== -1 ? process.argv[outFlag + 1] : null;
  const dest = explicitOut
    ? path.resolve(ROOT, explicitOut)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'ndd-public-'));

  buildPublic(dest);
  const files = walk(dest);

  // 1. Only allow-listed files exist.
  const unexpected = files.filter(f => f !== '.nojekyll' && !ALLOWED.includes(f));
  assert(unexpected.length === 0,
    `unexpected files in the public build: ${unexpected.join(', ')}`);

  // 2. No forbidden file or directory is present.
  for (const f of FORBIDDEN_FILES) {
    assert(!fs.existsSync(path.join(dest, f)), `forbidden file was published: ${f}`);
  }
  for (const d of FORBIDDEN_DIRS) {
    assert(!fs.existsSync(path.join(dest, d)), `forbidden directory was published: ${d}`);
  }

  // 3. No secret-shaped or capability-granting strings in any text file.
  const textFiles = files.filter(f => /\.(html|js|css|csv|json|txt|md)$/i.test(f));
  for (const rel of textFiles) {
    const body = fs.readFileSync(path.join(dest, rel), 'utf8');
    for (const { pattern, label } of FORBIDDEN_STRINGS) {
      assert(!pattern.test(body), `${label} appears in published file ${rel}`);
    }
  }

  // 4. Every local reference in the HTML resolves inside the build. A dangling
  //    reference means either a broken page or a link to something private.
  const html = fs.readFileSync(path.join(dest, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(m => m[1])
    .filter(r => !/^https?:/.test(r) && !r.startsWith('#') && !r.startsWith('data:'));
  for (const ref of refs) {
    assert(fs.existsSync(path.join(dest, ref)),
      `index.html references "${ref}", which is not in the public build`);
  }

  // 5. Nothing links to the admin panel.
  assert(!/admin\.html/.test(html), 'index.html still links to admin.html');
  for (const rel of textFiles) {
    const body = fs.readFileSync(path.join(dest, rel), 'utf8');
    assert(!/admin\.html/.test(body), `${rel} references admin.html`);
  }

  // 6. The menu data itself must actually be present and non-empty.
  const csv = fs.readFileSync(path.join(dest, 'assets/data/menu.csv'), 'utf8');
  assert(csv.trim().split('\n').length > 5, 'menu.csv looks empty in the public build');

  // 7. Sanity: the customer page is genuinely complete.
  for (const required of ['index.html', 'src/pages/menu.js', 'src/core/store.js']) {
    assert(fs.existsSync(path.join(dest, required)), `public build is missing ${required}`);
  }

  // Keep the directory when CI asked for it; otherwise clean up.
  if (!explicitOut) fs.rmSync(dest, { recursive: true, force: true });

  console.log(`\n  ${checks - failures.length}/${checks} public-build checks passed\n`);
  if (failures.length) {
    failures.forEach(f => console.log('  ✗ ' + f));
    console.log('\n  Refusing to publish.\n');
    process.exit(1);
  }
  console.log('  Public build contains only the customer menu. Safe to publish.');
  if (explicitOut) {
    console.log('  Verified output written to: ' + path.relative(ROOT, dest));
    console.log('  Files:');
    [...new Set(files)].sort().forEach(f => console.log('    ' + f));
  }
  console.log('');
}

main();
