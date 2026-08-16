/*
  New Delhi Darbar — local admin login gate (phone number + password).

  Honest scope: this is a static site with no server, so this check runs in
  the browser and cannot be a real security boundary — anyone reading the
  page source can see how it works. What it actually does: stop a customer
  who stumbles onto the admin panel from seeing or touching the editor.

  The REAL protection for the live website is that publishing requires a
  GitHub Personal Access Token, which:
    - is never stored anywhere by this app (not localStorage, not
      sessionStorage, not a cookie, not written to any file) — see
      src/core/github-publish.js
    - must be typed in by hand, each session, by whoever is actually
      authorized to push to the repository
  Without that token in hand, nobody can change the live site — regardless
  of whether they can get past this login screen.

  The password is stored as a SHA-256 hash in a git-ignored file
  (admin-credentials.js), so the literal password is never in the source
  and never reaches the public repository or GitHub Pages.
*/
(function (root) {
  'use strict';

  const STORAGE_SESSION = 'ndd-admin-session';
  const SALT = 'ndd-admin-v1';
  const SESSION_HOURS = 12;

  // Populated by admin-credentials.js (git-ignored), if present.
  let CREDENTIALS = Array.isArray(root.NDD_CREDENTIALS) ? root.NDD_CREDENTIALS : [];

  /* Test-only seam so the automated suite never needs the production password. */
  function _setCredentialsForTesting(list) { CREDENTIALS = list || []; }

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function normalizePhone(phone) {
    return String(phone || '').trim().replace(/[\s\-()]/g, '');
  }

  function readSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_SESSION) || localStorage.getItem(STORAGE_SESSION);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.phone || !session.expires) return null;
      if (Date.now() > session.expires) { signOut(); return null; }
      return session;
    } catch (e) {
      return null;
    }
  }

  function writeSession(phone, remember) {
    const session = { phone, expires: Date.now() + SESSION_HOURS * 3600 * 1000 };
    const value = JSON.stringify(session);
    try {
      if (remember) localStorage.setItem(STORAGE_SESSION, value);
      else sessionStorage.setItem(STORAGE_SESSION, value);
    } catch (e) {
      // Storage blocked (file:// or private mode) — session lives only for
      // this page view, which is still usable.
    }
  }

  function signOut() {
    try { sessionStorage.removeItem(STORAGE_SESSION); } catch (e) { /* ignore */ }
    try { localStorage.removeItem(STORAGE_SESSION); } catch (e) { /* ignore */ }
  }

  function isSignedIn() { return !!readSession(); }
  function currentPhone() { const s = readSession(); return s ? s.phone : ''; }
  function isConfigured() { return CREDENTIALS.length > 0; }

  /* Returns { ok:true } or { ok:false, error }. */
  async function signIn(phone, password, remember) {
    const normalizedPhone = normalizePhone(phone);
    const pass = String(password || '');

    if (!normalizedPhone || !pass) {
      return { ok: false, error: 'Please enter both your phone number and password.' };
    }
    if (!root.crypto || !root.crypto.subtle) {
      return {
        ok: false,
        error: 'This browser cannot sign you in securely. Open the panel over https:// or http://localhost '
             + 'rather than directly from a folder.'
      };
    }
    if (!isConfigured()) {
      return {
        ok: false,
        error: 'No admin login is configured on this copy of the panel. See src/core/admin-credentials.sample.js.'
      };
    }

    const attempt = await sha256Hex(SALT + ':' + normalizedPhone + ':' + pass);
    const match = CREDENTIALS.find(c => normalizePhone(c.phone) === normalizedPhone && safeEqual(c.hash, attempt));
    if (!match) {
      return { ok: false, error: 'Wrong phone number or password. Please try again.' };
    }

    writeSession(normalizedPhone, remember);
    return { ok: true, phone: normalizedPhone };
  }

  root.NDDAdminAuth = {
    STORAGE_SESSION, SESSION_HOURS,
    signIn, signOut, isSignedIn, currentPhone, isConfigured, sha256Hex,
    _setCredentialsForTesting
  };

})(typeof window !== 'undefined' ? window : globalThis);
