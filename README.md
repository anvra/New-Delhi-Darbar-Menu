# New Delhi Darbar — Digital Menu

Trilingual (English / हिन्दी / ગુજરાતી) digital menu with a built-in admin panel.
Static site, no backend, hosted on GitHub Pages.

**Live site:** https://anvra.github.io/New-Delhi-Darbar-Menu/
**Admin panel:** https://anvra.github.io/New-Delhi-Darbar-Menu/admin.html

---

## One source of truth for all three languages

The admin enters every dish **in English only**. Hindi and Gujarati are derived
automatically from a shared glossary, so changing a name or adding a dish updates
all three language views at once — nothing is ever typed three times.

| Status in the admin panel | Meaning |
| --- | --- |
| **Auto** | Derived from the glossary; stays in sync with the English text automatically. |
| **Manual** | An admin deliberately overrode this one language. Kept until cleared. |
| **Needs translation** | The glossary doesn't know some word yet, so customers see the English text. |

A translation is only used when *every* word is known — the site never renders a
half-Hindi, half-English name. Missing translations fall back to English, so the
menu is always readable.

To teach the system a new word, add it to `TERMS` (or a whole dish to `PHRASES`)
in [`src/core/glossary.js`](src/core/glossary.js).

---

## Project structure

```
index.html                  Customer-facing menu
admin.html                  Admin panel

src/core/                   Shared logic (used by both pages)
  glossary.js                 English -> Hindi/Gujarati translation engine
  store.js                    Load / save / publish data; CSV <-> objects
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
4. To publish for *all* customers, open the **Publish** tab, download the three
   files, put them where it says, then commit and push:

   | File | Goes in |
   | --- | --- |
   | `menu.csv` | `assets/data/` |
   | `menu-fallback.js` | `src/core/` |
   | `config.js` | `src/core/` |

GitHub Pages republishes within about a minute.

> **Why the download step?** GitHub Pages serves static files and has no database,
> so a browser cannot write to the repository. Saving keeps changes on the device
> that made them; committing the exported files makes them public.

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
