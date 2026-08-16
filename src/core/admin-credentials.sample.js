/*
  Template for the local admin login (phone number + password).

  Copy this file to `admin-credentials.js` (git-ignored — never committed,
  never published) and fill in your own phone number and password hash:

    node -e "console.log(require('crypto').createHash('sha256')\
      .update('ndd-admin-v1:PHONE_NUMBER:PASSWORD').digest('hex'))"

  Use the phone number exactly as you'll type it at login (digits only is
  simplest, e.g. 7567587816). Without this file present, the admin panel
  refuses every sign-in — that is intentional: a copy of this project with
  no credentials file configured has no way to log in at all.
*/
window.NDD_CREDENTIALS = [
  // { phone: '7567587816', hash: 'paste-the-sha256-hash-here' }
];
