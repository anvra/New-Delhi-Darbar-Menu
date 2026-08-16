/*
  New Delhi Darbar — admin auth client (browser side).

  This file holds NO credential of any kind. It only:
    - redirects to the Worker's /auth/login (which redirects to GitHub)
    - asks the Worker "am I signed in?" via /auth/me, relying on the
      HttpOnly session cookie the Worker set (this script cannot read that
      cookie — HttpOnly means page JS has no access to it, by design)
    - calls /auth/logout to clear the session

  The actual authorization decision (which GitHub account may act as admin)
  is made server-side by the Worker. See worker/ARCHITECTURE.md.

  WORKER_BASE_URL must be set to your deployed Worker's URL before this is
  usable — see worker/DEPLOY.md for the one-time setup.
*/
(function (root) {
  'use strict';

  // Set this after deploying the Worker (see worker/DEPLOY.md).
  // Left blank by default so a checkout with no Worker configured fails
  // closed with a clear message, rather than silently pointing at nothing.
  const WORKER_BASE_URL = ''; // e.g. 'https://ndd-admin-auth.YOUR-SUBDOMAIN.workers.dev'

  function isConfigured() { return !!WORKER_BASE_URL; }

  function loginUrl() {
    return WORKER_BASE_URL + '/auth/login';
  }

  /* Returns { signedIn, login } — never throws; a network failure reads as signed-out. */
  async function checkSession() {
    if (!isConfigured()) return { signedIn: false, unconfigured: true };
    try {
      const res = await fetch(WORKER_BASE_URL + '/auth/me', { credentials: 'include' });
      if (!res.ok) return { signedIn: false };
      return await res.json();
    } catch (e) {
      return { signedIn: false, networkError: true };
    }
  }

  async function signOut() {
    if (!isConfigured()) return;
    try {
      await fetch(WORKER_BASE_URL + '/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) { /* proceed regardless — the client-side redirect still signs the user out visually */ }
  }

  /*
    The only privileged network call this page ever makes. The session
    cookie (HttpOnly, sent automatically by the browser via `credentials:
    'include'`) is what authorizes this — no token is attached by this code
    because this code never holds one.
  */
  async function publish(files, message) {
    if (!isConfigured()) {
      throw new Error('The admin auth service is not configured. See worker/DEPLOY.md.');
    }
    const res = await fetch(WORKER_BASE_URL + '/api/publish', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, message })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || `Publish failed (${res.status}).`);
    }
    return body;
  }

  root.NDDAuthClient = { isConfigured, loginUrl, checkSession, signOut, publish };

})(typeof window !== 'undefined' ? window : globalThis);
