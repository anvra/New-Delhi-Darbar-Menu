/*
  New Delhi Darbar — admin sign-in.

  Gates the admin panel so the public menu can link to it without exposing the
  editing tools to customers.

  Scope and honesty about what this protects:
  This is a static site with no server, so the check necessarily runs in the
  browser. It stops a customer who follows the Admin Panel link from editing the
  menu — which is the actual risk here. It is NOT a defence against someone
  determined and technical, who can read the page source. The real protection
  for the live website is the GitHub token: without it nobody can publish, and
  that token is never stored in this repository.

  The password is stored as a SHA-256 hash rather than plain text, so the
  literal password does not appear in the source.
*/
(function (root) {
  'use strict';

  const STORAGE_SESSION = 'ndd-admin-session';
  const SALT = 'ndd-admin-v1';

  /*
    Credentials live in admin-credentials.js, which is git-ignored and never
    published. It defines window.NDD_CREDENTIALS as:
      [{ username: '…', hash: '<sha256 of "ndd-admin-v1:USER:PASS">' }]

    If that file is absent — which is the case for anything built for the public
    site — there are no credentials at all and sign-in always fails. That is the
    intended fail-closed behaviour: the public build ships no way in.
  */
  let CREDENTIALS = Array.isArray(root.NDD_CREDENTIALS) ? root.NDD_CREDENTIALS : [];

  /* Test-only seam so the suite never needs the production password. */
  function _setCredentialsForTesting(list) { CREDENTIALS = list || []; }

  // How long a sign-in lasts before it must be repeated.
  const SESSION_HOURS = 12;

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* Constant-time-ish comparison so timing does not reveal the hash. */
  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function readSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_SESSION) || localStorage.getItem(STORAGE_SESSION);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.username || !session.expires) return null;
      if (Date.now() > session.expires) { signOut(); return null; }
      return session;
    } catch (e) {
      return null;
    }
  }

  function writeSession(username, remember) {
    const session = { username, expires: Date.now() + SESSION_HOURS * 3600 * 1000 };
    const value = JSON.stringify(session);
    try {
      // "Remember me" survives closing the browser; otherwise the tab only.
      if (remember) localStorage.setItem(STORAGE_SESSION, value);
      else sessionStorage.setItem(STORAGE_SESSION, value);
    } catch (e) {
      // Storage blocked (file:// or private mode) — the session lives in memory
      // for this page view only, which is still usable.
    }
    return session;
  }

  function signOut() {
    try { sessionStorage.removeItem(STORAGE_SESSION); } catch (e) { /* ignore */ }
    try { localStorage.removeItem(STORAGE_SESSION); } catch (e) { /* ignore */ }
  }

  function isSignedIn() { return !!readSession(); }

  function currentUser() {
    const session = readSession();
    return session ? session.username : '';
  }

  /* Returns { ok:true, username } or { ok:false, error }. */
  async function signIn(username, password, remember) {
    const user = String(username || '').trim();
    const pass = String(password || '');

    if (!user || !pass) {
      return { ok: false, error: 'Please enter both your username and password.' };
    }
    if (!root.crypto || !root.crypto.subtle) {
      return {
        ok: false,
        error: 'This browser cannot sign you in securely. Open the panel over https:// or http://localhost '
             + 'rather than directly from a folder.'
      };
    }

    if (!CREDENTIALS.length) {
      return {
        ok: false,
        error: 'This copy of the admin panel has no sign-in configured, so it cannot be used to edit the menu. '
             + 'Use the private admin environment instead.'
      };
    }

    const attempt = await sha256Hex(SALT + ':' + user + ':' + pass);
    const match = CREDENTIALS.find(c => c.username === user && safeEqual(c.hash, attempt));
    if (!match) {
      return { ok: false, error: 'Wrong username or password. Please try again.' };
    }

    writeSession(user, remember);
    return { ok: true, username: user };
  }

  function isConfigured() { return CREDENTIALS.length > 0; }

  root.NDDAuth = {
    STORAGE_SESSION, SESSION_HOURS,
    signIn, signOut, isSignedIn, currentUser, sha256Hex, isConfigured,
    _setCredentialsForTesting
  };

})(typeof window !== 'undefined' ? window : globalThis);
