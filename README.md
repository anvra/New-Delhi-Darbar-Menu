# New Delhi Darbar — Digital Menu

Trilingual (English / हिन्दी / ગુજરાતી) digital menu with a built-in admin panel.
Static site, no backend, hosted on GitHub Pages.

**Live site:** <https://anvra.github.io/New-Delhi-Darbar-Menu/>

The live site serves the **customer menu only**. The admin panel is deliberately
not published — it is run locally from a checkout of this repository. See
[SECURITY.md](SECURITY.md) (local file, not published — see below).

---

## One source of truth for all three languages

The admin enters every dish **in English only**. Hindi and Gujarati are derived
automatically from a shared glossary, so changing a name or adding a dish updates
all three language views at once — nothing is ever typed three times.

| Status in the admin panel | Meaning |
| --- | --- |
| **Done** | Translated automatically; stays in sync with the English text. |
| **Yours** | You typed this wording yourself. Kept until you clear it. |
| **Not translated** | An unknown word, so customers see the English name. Press **Type Hindi** / **Type Gujarati** to add it. |

A translation is only used when *every* word is known — the site never renders a
half-Hindi, half-English name. Missing translations fall back to English, so the
menu is always readable.

The glossary ships with **198 words and 62 dish names** covering common Indian
restaurant vocabulary — proteins, vegetables, breads, rice, desserts, beverages,
preparations, portions and menu sections. To teach it a new word, add it to
`TERMS` (or a whole dish name to `PHRASES`) in
[`src/core/glossary.js`](src/core/glossary.js).

---

## Project structure

```text
index.html                  Customer-facing menu
admin.html                  Admin panel                       (not published)

src/core/                   Shared logic (used by both pages)
  glossary.js                 English -> Hindi/Gujarati translation engine
  store.js                    Load / save / build data; CSV <-> objects
  admin-auth.js                Local phone+password login gate  (not published)
  admin-credentials.js          Your login hash — git-ignored   (not published)
  admin-credentials.sample.js   Template for the file above     (not published)
  github-publish.js            Session-only GitHub PAT publish  (not published)
  i18n.js                     Static UI labels
  config.js                   Brand details + notices          (editable data)
  menu-fallback.js            Embedded copy of menu.csv        (generated)

src/pages/
  menu.css / menu.js          Customer menu
  admin.css / admin.js        Admin panel

assets/
  data/menu.csv               All categories, items and prices (editable data)
  img/                        Logos, favicons, QR code

scripts/
  test-e2e.cjs                End-to-end test suite
  verify-public-build.cjs     Builds + audits the public site
  generate_qr.py              Regenerate the table QR code

.github/workflows/
  deploy-pages.yml            Publishes ONLY the customer menu
```

`config.js` and `menu.csv` hold the content. Everything else is code.

---

## Running the admin panel

The admin panel is **not on the public site**. Run it locally:

```bash
npm start                       # http://localhost:8080/admin.html
```

### Signing in (local phone number + password)

Copy the credentials template and set your own login:

```bash
cp src/core/admin-credentials.sample.js src/core/admin-credentials.js

# Generate a hash for your phone number + password
node -e "console.log(require('crypto').createHash('sha256').update('ndd-admin-v1:PHONE:PASSWORD').digest('hex'))"
```

Paste the phone number and hash into `admin-credentials.js`. That file is
**git-ignored** — it never enters the repository or the public site. Without
it, the admin panel refuses every sign-in.

> **What this protects, honestly.** This is a static site with no server, so
> the phone+password check runs in the browser and is not a real security
> boundary — it stops a customer who finds the page from touching the editor,
> nothing more. The actual protection for the live website is described below:
> publishing needs a GitHub token that is never stored anywhere.

---

## Editing the menu

The flow is:

**Admin Login → Edit / Add / Delete Menu → Preview → Commit & Push (GitHub token) → GitHub Pages Publish**

1. Open **admin.html** and sign in with your phone number and password.
2. Edit categories, items, prices, brand details and notices. Type English only.
3. Click **Save & Publish** — updates the menu in your browser immediately, so
   you can keep working across sessions.
4. Open the **Preview** tab to see exactly what customers will see, built from
   your current unsaved draft, before anything goes live.
5. Open the **Publish** tab and click **Commit & Push**. You'll be asked for a
   GitHub Personal Access Token.

### About the GitHub token

There is no backend, so the browser itself has to authenticate with GitHub's
API to publish. This project minimizes what that means in practice:

- The token is typed in **fresh, every time** — there is no "remember me" for it.
- It is held **only in memory** (a JavaScript variable) for the duration of the
  publish. It is never written to localStorage, sessionStorage, a cookie, or
  any file.
- It is **cleared immediately** after each publish attempt, success or failure.
- It is sent only to `api.github.com`, over HTTPS, and nowhere else.

Use a **fine-grained** token scoped to just this repository with just
**Contents: Read and write** (the token-entry dialog links to the exact
GitHub settings page). Scoped this way, even a misused token can only edit
this one project's files.

Publishing writes `menu.csv`, `menu-fallback.js` and `config.js` in a **single
commit**, so GitHub Pages rebuilds once. The live site updates in about a minute.

### Backup, restore, and manual publishing

The Publish tab also offers:

- **Download Backup** — one JSON file with the whole menu, brand details and notices.
- **Choose Backup File…** — restore from a backup, or from a bare `menu.csv`.
  You get a confirmation showing what the file contains before anything changes.
- **Manual publish** — download the three files and commit them with your own
  git credentials instead of entering a token here.

`menu.csv` can also be edited directly in Excel or Google Sheets if preferred.

---

## Development

```bash
npm install            # test tooling only; the site itself has no build step
npm start              # serve at http://localhost:8080
npm test               # end-to-end suite + public-build audit
npm run verify:public  # audit what would be published
```

`npm test` boots both real pages in a headless browser against the real data and
checks rendering, navigation, language switching, theming, admin editing,
persistence, CSV round-tripping, the login gate, the session-only token
handling, and the preview renderer. It then audits the public build to confirm
no admin code, credential or secret can reach the published site.

`SECURITY.md` documents the full security posture but is kept out of the
public repository (git-ignored) since it's written for this specific
deployment's threat model.

Serve the site over HTTP rather than opening the files directly — browsers block
`fetch` on `file://` URLs. The pages do fall back to the embedded menu copy in
that case, but HTTP is the accurate way to test.
