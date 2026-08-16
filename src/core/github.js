/*
  New Delhi Darbar — GitHub publishing.

  Lets the admin push changes straight to the repository from the browser, so
  the public site updates without anyone touching Git or downloading files.

  Uses the GitHub REST API with a Personal Access Token supplied by the admin.
  The token is stored only in this browser's localStorage and is sent solely to
  api.github.com over HTTPS. It never goes anywhere else and is never committed.

  Publishing writes three files in a single commit (via the Git data API, so the
  files land together and GitHub Pages rebuilds once):
    assets/data/menu.csv
    src/core/menu-fallback.js
    src/core/config.js
*/
(function (root) {
  'use strict';

  const STORAGE_TOKEN = 'ndd-github-token';
  const STORAGE_REPO = 'ndd-github-repo';
  const API = 'https://api.github.com';

  const DEFAULT_REPO = { owner: 'anvra', repo: 'New-Delhi-Darbar-Menu', branch: 'main' };

  /* ---------------- credentials ---------------- */

  function getToken() {
    try { return localStorage.getItem(STORAGE_TOKEN) || ''; } catch (e) { return ''; }
  }
  function setToken(token) {
    if (token) localStorage.setItem(STORAGE_TOKEN, token.trim());
    else localStorage.removeItem(STORAGE_TOKEN);
  }
  function hasToken() { return !!getToken(); }

  function getRepo() {
    try {
      const raw = localStorage.getItem(STORAGE_REPO);
      if (raw) return Object.assign({}, DEFAULT_REPO, JSON.parse(raw));
    } catch (e) { /* use defaults */ }
    return Object.assign({}, DEFAULT_REPO);
  }
  function setRepo(cfg) {
    localStorage.setItem(STORAGE_REPO, JSON.stringify(cfg));
  }

  /* ---------------- low-level API ---------------- */

  async function api(pathname, options) {
    const token = getToken();
    if (!token) throw new Error('No GitHub token saved. Add one in the Publish tab.');

    const res = await fetch(API + pathname, Object.assign({}, options, {
      headers: Object.assign({
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      }, (options || {}).headers)
    }));

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).message || ''; } catch (e) { /* no body */ }
      throw new Error(friendlyError(res.status, detail));
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function friendlyError(status, detail) {
    if (status === 401) return 'That token was rejected. It may be wrong or expired — create a new one and save it again.';
    if (status === 403) return 'GitHub refused the request. The token may lack "Contents: Read and write" permission for this repository.';
    if (status === 404) return 'Repository not found. Check the owner/repository name, and that the token can access it.';
    if (status === 409) return 'The repository changed while publishing. Try again.';
    if (status === 422) return 'GitHub rejected the content' + (detail ? ': ' + detail : '.');
    return 'GitHub error ' + status + (detail ? ': ' + detail : '');
  }

  /* UTF-8 safe base64 (btoa alone breaks on Devanagari/Gujarati text). */
  function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  function fromBase64(b64) {
    const binary = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* ---------------- public operations ---------------- */

  /* Verify the token works and has write access. Returns { login, repo, canWrite }. */
  async function verify() {
    const { owner, repo } = getRepo();
    const user = await api('/user');
    const repoInfo = await api(`/repos/${owner}/${repo}`);
    return {
      login: user.login,
      repo: repoInfo.full_name,
      canWrite: !!(repoInfo.permissions && (repoInfo.permissions.push || repoInfo.permissions.admin))
    };
  }

  /*
    Commit several files at once.
    `files` is [{ path, content }]. Returns { commitUrl, sha, pagesUrl }.
  */
  async function publishFiles(files, message) {
    const { owner, repo, branch } = getRepo();
    const base = `/repos/${owner}/${repo}`;

    // 1. Current branch head + its tree.
    const ref = await api(`${base}/git/ref/heads/${branch}`);
    const headSha = ref.object.sha;
    const headCommit = await api(`${base}/git/commits/${headSha}`);

    // 2. Upload each file as a blob (base64 keeps non-Latin scripts intact).
    const blobs = [];
    for (const file of files) {
      const blob = await api(`${base}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: toBase64(file.content), encoding: 'base64' })
      });
      blobs.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    // 3. Tree -> commit -> move the branch. One commit, one Pages rebuild.
    const tree = await api(`${base}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: blobs })
    });
    const commit = await api(`${base}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: message || 'Update menu from Admin Panel',
        tree: tree.sha,
        parents: [headSha]
      })
    });
    await api(`${base}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha })
    });

    return {
      sha: commit.sha.slice(0, 7),
      commitUrl: `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
      pagesUrl: `https://${owner}.github.io/${repo}/`
    };
  }

  /* Read a file's current text from the repository. */
  async function readFile(filePath) {
    const { owner, repo, branch } = getRepo();
    const res = await api(`/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`);
    return fromBase64(res.content);
  }

  /* Most recent commits, for the activity list in the Publish tab. */
  async function recentCommits(limit) {
    const { owner, repo, branch } = getRepo();
    const list = await api(`/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${limit || 5}`);
    return list.map(c => ({
      sha: c.sha.slice(0, 7),
      message: (c.commit.message || '').split('\n')[0],
      author: (c.commit.author && c.commit.author.name) || 'unknown',
      date: c.commit.author && c.commit.author.date,
      url: c.html_url
    }));
  }

  root.NDDGitHub = {
    STORAGE_TOKEN, DEFAULT_REPO,
    getToken, setToken, hasToken, getRepo, setRepo,
    verify, publishFiles, readFile, recentCommits,
    toBase64, fromBase64
  };

})(typeof window !== 'undefined' ? window : globalThis);
