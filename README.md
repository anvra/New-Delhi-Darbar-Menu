# New Delhi Darbar — Digital Menu

Trilingual (English / हिन्दी / ગુજરાતી) digital menu with a built-in admin panel.
Static site, no backend, hosted on GitHub Pages.

**Live site:** <https://anvra.github.io/New-Delhi-Darbar-Menu/>

The live site serves the **customer menu only**. The admin panel is deliberately
not published — it is run locally from a checkout of this repository. See
[SECURITY.md](SECURITY.md).

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
admin.html                  Admin panel

src/core/                   Shared logic (used by both pages)
  glossary.js                 English -> Hindi/Gujarati translation engine
  store.js                    Load / save / publish data; CSV <-> objects
  auth-client.js              Talks to the admin-auth Worker            (not published)
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
  test-e2e.cjs                     End-to-end test suite
  verify-public-build.cjs          Builds + audits the public site
  test-worker-if-present.cjs       Runs worker tests if worker/ exists locally
  generate_qr.py                   Regenerate the table QR code

.github/workflows/
  deploy-pages.yml            Publishes ONLY the customer menu

worker/                      Admin-auth Cloudflare Worker — git-ignored, local only
  (see worker/ARCHITECTURE.md and worker/DEPLOY.md)
```

`config.js` and `menu.csv` hold the content. Everything else is code.

---

## Running the admin panel

The admin panel is **not on the public site**. Run it locally:

```bash
npm start                       # http://localhost:8080/admin.html
```

### Signing in (GitHub OAuth — one-time setup)

There is no password. Sign-in is **"Sign in with GitHub"**, authorized
server-side by a small Cloudflare Worker (`worker/`) that checks your GitHub
account against a single allow-listed username. Full flow and threat model in
[`worker/ARCHITECTURE.md`](worker/ARCHITECTURE.md).

One-time setup (a few minutes, needs a free Cloudflare account):
see [`worker/DEPLOY.md`](worker/DEPLOY.md).

Until that's done, the admin panel correctly shows "not configured" and
refuses all access — it fails closed, not open.

> **What this protects.** Authorization is decided by the Worker, server-side
> — not by anything this page's JavaScript can be tricked into skipping. No
> password, GitHub token, or OAuth secret is ever sent to, or readable by, the
> browser. Full analysis in [SECURITY.md](SECURITY.md) (local file, not
> published — see below).

---

## Editing the menu

1. Open **admin.html** and click **Sign in with GitHub**.
2. Edit categories, items, prices, brand details and notices. Type English only.
3. Click **Save & Publish** — the menu updates immediately in your browser.
4. To publish for *all* customers, open the **Publish** tab and press
   **Publish to Website Now**. This calls the Worker, which re-verifies your
   session before writing anything.

Publishing writes `menu.csv`, `menu-fallback.js` and `config.js` in a **single
commit**, so GitHub Pages rebuilds once. The live site updates in about a minute.

### Backup, restore, and manual publishing

The Publish tab also offers:

- **Download Backup** — one JSON file with the whole menu, brand details and notices.
- **Choose Backup File…** — restore from a backup, or from a bare `menu.csv`.
  You get a confirmation showing what the file contains before anything changes.
- **Manual publish** — if the Worker is ever unreachable, download the three
  files and commit them with your own git credentials instead.

`menu.csv` can also be edited directly in Excel or Google Sheets if preferred.

---

## Development

```bash
npm install            # test tooling only; the site itself has no build step
npm start              # serve at http://localhost:8080
npm test               # end-to-end suite + public-build audit + worker auth tests
npm run verify:public  # audit what would be published
npm run test:worker    # admin-auth authorization logic (skips cleanly if worker/ is absent)
```

`npm test` boots both real pages in a headless browser against the real data and
checks rendering, navigation, language switching, theming, admin editing,
persistence, CSV round-tripping and recovery from corrupt storage. It then
audits the public build to confirm no admin code, credential or secret can
reach the published site, and — if the (git-ignored, local-only) `worker/`
directory is present — verifies the OAuth/session/CSRF authorization logic
against the real Worker handler code.

`SECURITY.md` documents the full security posture but is kept out of the
public repository (git-ignored) since it's written for this specific
deployment's threat model.

Serve the site over HTTP rather than opening the files directly — browsers block
`fetch` on `file://` URLs. The pages do fall back to the embedded menu copy in
that case, but HTTP is the accurate way to test.
