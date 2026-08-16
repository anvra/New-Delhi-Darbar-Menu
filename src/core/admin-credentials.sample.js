/*
  Template for admin sign-in credentials.

  Copy to `admin-credentials.js` (git-ignored) and fill in your own hash:

    node -e "console.log(require('crypto').createHash('sha256')\
      .update('ndd-admin-v1:USERNAME:PASSWORD').digest('hex'))"

  The real file must never be committed or included in a public build.
  Without it the admin panel refuses every sign-in, which is intentional:
  the public site ships no way to authenticate.
*/
window.NDD_CREDENTIALS = [
  // { username: 'your-username', hash: 'paste-the-sha256-hash-here' }
];
