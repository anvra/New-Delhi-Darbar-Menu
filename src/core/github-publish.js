/*
  New Delhi Darbar — GitHub publishing (session-only Personal Access Token).

  There is no backend in this project, so there is no way to keep a GitHub
  write credential secret from the browser that HOLDS it while publishing —
  the browser has to have something to authenticate with GitHub's API. The
  design here minimizes that exposure as much as a pure static site allows:

    - The PAT is typed in by the admin immediately before each publish,
      held ONLY in a variable in memory (this module's closure).
    - It is NEVER written to localStorage, sessionStorage, a cookie, or any
      file. Nothing this app writes to disk (backups, exported files, the
      committed menu.csv/config.js) can ever contain it.
    - It is cleared from memory immediately after each publish attempt,
      success or failure — the admin must re-enter it for the next publish.
    - It is sent only to api.github.com over HTTPS, in the Authorization
      header of the commit-related requests, and nowhere else.

  This is honestly a session-scoped secret, not a stored one: convenient
  enough to use repeatedly in one sitting, gone the moment the tab closes or
  the publish finishes. The admin should use a fine-grained PAT scoped to
  ONLY this repository, ONLY Contents: Read and write, so a leaked token (if
  ever intercepted in transit despite HTTPS, or misused by whoever holds it)
  can do nothing beyond editing this one repo's files.
*/
(function (root) {
  'use strict';

  const DEFAULT_REPO = { owner: 'anvra', repo: 'New-Delhi-Darbar-Menu', branch: 'main' };
  const API = 'https://api.github.com';

  let memoryToken = ''; // the ENTIRE persistence footprint of the PAT — a JS variable, nothing else

  function setToken(token) { memoryToken = token ? String(token).trim() : ''; }
  function clearToken() { memoryToken = ''; }
  function hasToken() { return !!memoryToken; }

  function getRepo() { return Object.assign({}, DEFAULT_REPO); }

  async function api(pathname, options) {
    if (!memoryToken) throw new Error('No GitHub token entered for this session.');

    let res;
    try {
      res = await fetch(API + pathname, Object.assign({}, options, {
        headers: Object.assign({
          'Authorization': 'Bearer ' + memoryToken,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        }, (options || {}).headers)
      }));
    } catch (err) {
      throw new Error('Could not reach GitHub. Check your internet connection, then try again. ('
        + (err && err.message ? err.message : 'network error') + ')');
    }

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).message || ''; } catch (e) { /* no body */ }
      throw new Error(friendlyError(res.status, detail));
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function friendlyError(status, detail) {
    const because = detail ? ' GitHub said: "' + detail + '"' : '';
    if (status === 401) return 'That token was rejected — it may be wrong, expired, or revoked.' + because;
    if (status === 403) {
      if (/rate limit/i.test(detail)) return 'Too many requests to GitHub for now. Wait a few minutes and try again.';
      return 'GitHub refused the request. Check the token has "Contents: Read and write" on this repository, '
        + 'and that the repository is selected under "Repository access".' + because;
    }
    if (status === 404) return 'Repository not found, or the token was not given access to it.' + because;
    if (status === 409) return 'The repository changed while publishing. Please try again.';
    if (status === 422) return 'GitHub rejected the content.' + because;
    return 'GitHub error ' + status + '.' + because;
  }

  /* UTF-8 safe base64 (plain btoa() corrupts Devanagari/Gujarati text). */
  function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  /* Verify the token works and can write, without publishing anything yet. */
  async function verify() {
    const { owner, repo, branch } = getRepo();
    const user = await api('/user');
    let contentsReadable = false, contentsError = '';
    try {
      await api(`/repos/${owner}/${repo}/contents/assets/data/menu.csv?ref=${branch}`);
      contentsReadable = true;
    } catch (err) {
      contentsError = err.message;
    }
    return { login: user.login, canWrite: contentsReadable, contentsError };
  }

  /*
    Commit several files in one commit. `files` is [{ path, content }].
    The token is used for exactly the duration of this call; the caller is
    responsible for calling clearToken() afterward (the admin UI does this
    unconditionally, success or failure).
  */
  async function publishFiles(files, message) {
    const { owner, repo, branch } = getRepo();
    const base = `/repos/${owner}/${repo}`;

    const ref = await api(`${base}/git/ref/heads/${branch}`);
    const headSha = ref.object.sha;
    const headCommit = await api(`${base}/git/commits/${headSha}`);

    const blobs = [];
    for (const file of files) {
      const blob = await api(`${base}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: toBase64(file.content), encoding: 'base64' })
      });
      blobs.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    const tree = await api(`${base}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: blobs })
    });
    const commit = await api(`${base}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({ message: message || 'Update menu from Admin Panel', tree: tree.sha, parents: [headSha] })
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

  /*
    Check whether GitHub Pages has finished deploying the just-published
    content, by fetching the LIVE public menu.csv (no token needed — it's a
    public file) and comparing it to what was just pushed. This is what lets
    Commit & Push report a real "it's live" instead of guessing "about a
    minute" and hoping.

    Cache-busted with a query param, since GitHub Pages/its CDN cache
    unauthenticated GETs — without busting, a poll could keep reading a
    stale cached copy even after the new version is actually live.
  */
  async function isLiveContentUpdated(expectedCsvContent) {
    const { owner, repo } = getRepo();
    const url = `https://${owner}.github.io/${repo}/assets/data/menu.csv?_=${Date.now()}`;
    let res;
    try {
      res = await fetch(url, { cache: 'no-store' });
    } catch (e) {
      return false; // network hiccup — caller just retries on the next poll tick
    }
    if (!res.ok) return false;
    const liveText = await res.text();
    return liveText.trim() === expectedCsvContent.trim();
  }

  /*
    Poll isLiveContentUpdated until it matches, or until timeoutMs elapses.
    Calls onTick(elapsedMs) before each check so the caller can update a
    status message. Returns true if it went live within the timeout.
  */
  async function waitForLive(expectedCsvContent, opts) {
    const intervalMs = (opts && opts.intervalMs) || 4000;
    const timeoutMs = (opts && opts.timeoutMs) || 120000;
    const onTick = (opts && opts.onTick) || (() => {});
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      onTick(Date.now() - start);
      if (await isLiveContentUpdated(expectedCsvContent)) return true;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  }

  root.NDDGitHubPublish = {
    setToken, clearToken, hasToken, getRepo, verify, publishFiles, toBase64,
    isLiveContentUpdated, waitForLive
  };

})(typeof window !== 'undefined' ? window : globalThis);
