# New Delhi Darbar — Digital Menu

Trilingual (English / हिन्दी / ગુજરાતી) digital menu with a built-in admin panel.
Static site, no backend, hosted on GitHub Pages.

**Live site:** <https://anvra.github.io/New-Delhi-Darbar-Menu/>  
**Admin panel:** <https://anvra.github.io/New-Delhi-Darbar-Menu/admin.html>

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
  github.js                   Commit changes to GitHub from the browser
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
  test-e2e.js                 End-to-end test suite
  generate_qr.py              Regenerate the table QR code
```

`config.js` and `menu.csv` hold the content. Everything else is code.

---

## Editing the menu

1. Open **admin.html** (locally or on the live site).
2. Edit categories, items, prices, brand details and notices. Type English only.
3. Click **Save & Publish** — the menu updates immediately in your browser.
4. To publish for *all* customers, open the **Publish** tab and press
   **Publish to Website Now**.

### One-time GitHub connection

Publishing commits directly to this repository from the browser, so no files or
Git commands are needed. Connect once:

1. Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new).
2. Give it access to **only** the `New-Delhi-Darbar-Menu` repository.
3. Under **Permissions → Repository permissions**, set **Contents** to
   **Read and write**.
4. Paste the token into the Publish tab and press **Connect**.

The token is stored only in that browser's `localStorage` and is sent only to
`api.github.com`. It is never committed. Anyone with access to that browser
profile can publish, so connect on a personal device. Press **Disconnect** to
remove it.

Publishing writes `menu.csv`, `menu-fallback.js` and `config.js` in a **single
commit**, so GitHub Pages rebuilds once. The live site updates in about a minute.

### Backup, restore, and manual publishing

The Publish tab also offers:

- **Download Backup** — one JSON file with the whole menu, brand details and notices.
- **Choose Backup File…** — restore from a backup, or from a bare `menu.csv`.
  You get a confirmation showing what the file contains before anything changes.
- **Manual Files** — download the three files and commit them by hand if the
  GitHub connection is unavailable.

`menu.csv` can also be edited directly in Excel or Google Sheets if preferred.

---

## Development

```bash
npm install     # test tooling only; the site itself has no build step
npm start       # serve at http://localhost:8080
npm test        # run the end-to-end suite
```

`npm test` boots both real pages in a headless browser against the real data and
checks rendering, navigation, language switching, theming, admin editing,
persistence, CSV round-tripping and recovery from corrupt storage.

Serve the site over HTTP rather than opening the files directly — browsers block
`fetch` on `file://` URLs. The pages do fall back to the embedded menu copy in
that case, but HTTP is the accurate way to test.
