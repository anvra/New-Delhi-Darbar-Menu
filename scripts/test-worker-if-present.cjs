/*
  Runs worker/test-worker.mjs if the (git-ignored, local-only) worker/
  directory exists on this machine, and skips it cleanly otherwise.

  worker/ is intentionally excluded from the public repository — it is the
  admin-auth Cloudflare Worker's source, kept out of public scrutiny even
  though it holds no secret values itself (see worker/ARCHITECTURE.md). That
  means a fresh clone of this public repo will not have worker/ at all, and
  `npm test` must not fail just because that local-only piece is absent.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const workerTest = path.join(__dirname, '..', 'worker', 'test-worker.mjs');

if (!fs.existsSync(workerTest)) {
  console.log('\n  worker/ not present on this machine — skipping worker auth tests.');
  console.log('  (worker/ is git-ignored by design; see worker/ARCHITECTURE.md.)\n');
  process.exit(0);
}

const result = spawnSync(process.execPath, [workerTest], { stdio: 'inherit' });
process.exit(result.status == null ? 1 : result.status);
