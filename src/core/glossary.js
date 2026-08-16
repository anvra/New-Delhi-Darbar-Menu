/*
  New Delhi Darbar — translation glossary.

  English is the single source of truth for all content. This glossary lets the
  app derive Hindi and Gujarati automatically, so an admin types an item name
  once and all three language views stay in sync.

  How it works:
    - PHRASES  : whole-name matches, checked first (highest quality).
    - TERMS    : individual words, used to build a translation term-by-term.
  A derived translation is only offered when EVERY significant word is known;
  otherwise the item is reported as "needs translation" rather than emitting a
  half-Hindi/half-English string.

  To improve coverage, add entries here — both the customer menu and the admin
  panel read from this one file.
*/
(function (root) {
  'use strict';

  // Full-phrase translations. Keyed by lowercased English.
  const PHRASES = {
    // Categories
    'chicken item':    { hi: 'चिकन आइटम',       gu: 'ચિકન આઇટમ' },
    'mutton item':     { hi: 'मटन आइटम',        gu: 'મટન આઇટમ' },
    'fish item':       { hi: 'फिश आइटम',        gu: 'ફિશ આઈટમ' },
    'rice':            { hi: 'चावल',            gu: 'રાઇસ' },
    'roti':            { hi: 'रोटी',            gu: 'રોટી' },
    'cold beverages':  { hi: 'कोल्ड बेवरेजेज',   gu: 'કોલ્ડ બેવરેજિસ' },

    // Chicken
    'chicken masala':        { hi: 'चिकन मसाला',           gu: 'ચિકન મસાલા' },
    'chicken kadai':         { hi: 'चिकन कड़ाई',            gu: 'ચિકન કડાઈ' },
    'chicken tikka(fry)':    { hi: 'चिकन टिक्का (फ्राई)',   gu: 'ચિકન ટિક્કા (ફ્રાય)' },
    'chicken tikka(gravy)':  { hi: 'चिकन टिक्का (ग्रेवी)',  gu: 'ચિકન ટિક્કા (ગ્રેવી)' },
    'dry chicken':           { hi: 'सूखी चिकन',            gu: 'સૂકી ચિકન' },
    'hyderabadi chicken':    { hi: 'हैदराबादी चिकन',        gu: 'હૈદરાબાદી ચિકન' },
    'chicken biryani':       { hi: 'चिकन बिरयानी',          gu: 'ચિકન બિરયાની' },

    // Mutton
    'mutton masala': { hi: 'मटन मसाला',      gu: 'મટન મસાલા' },
    'mutton kadai':  { hi: 'मटन कड़ाई',       gu: 'મટન કડાઈ' },
    'kheema masala': { hi: 'कीमा मसाला',     gu: 'ખીમા મસાલા' },
    'kebab (gravy)': { hi: 'कबाब (ग्रेवी)',  gu: 'કબાબ (ગ્રેવી)' },
    'kebab (fry)':   { hi: 'कबाब (फ्राई)',   gu: 'કબાબ (ફ્રાય)' },

    // Fish
    'paplet fry':    { hi: 'पापलेट फ्राई',   gu: 'પેપલેટ ફ્રાય' },
    'jinga(gravy)':  { hi: 'झींगा (ग्रेवी)', gu: 'જીંગા (ગ્રેવી)' },
    'fish fry':      { hi: 'मछली फ्राई',     gu: 'મચ્છી ફ્રાય' },

    // Rice
    'biryani rice': { hi: 'बिरयानी चावल', gu: 'બિરયાની રાઇસ' },
    'plane rice':   { hi: 'सादा चावल',    gu: 'સાદા રાઇસ' },
    'plain rice':   { hi: 'सादा चावल',    gu: 'સાદા રાઇસ' },

    // Roti
    'plain roti':      { hi: 'सादी रोटी',      gu: 'ઘઉં ની રોટલી' },
    'chokha na rotla': { hi: 'चावल के रोटला',  gu: 'ચોખા ના રોટલા' },
    'chokha na pudaa': { hi: 'चावल के पुड़ा',   gu: 'ચોખા ના પુડા' },

    // Beverages
    'mineral water': { hi: 'मिनरल वाटर',      gu: 'મિનરલ વોટર' },
    'jeera':         { hi: 'जीरा',            gu: 'જીરા' },
    'soft drinks':   { hi: 'सॉफ्ट ड्रिंक्स',  gu: 'સોફ્ટ ડ્રિંક્સ' }
  };

  // Word-level translations, used to compose names not covered by PHRASES.
  const TERMS = {
    // Proteins & mains
    chicken:    { hi: 'चिकन',      gu: 'ચિકન' },
    mutton:     { hi: 'मटन',       gu: 'મટન' },
    fish:       { hi: 'मछली',      gu: 'મચ્છી' },
    paplet:     { hi: 'पापलेट',    gu: 'પેપલેટ' },
    jinga:      { hi: 'झींगा',     gu: 'જીંગા' },
    prawn:      { hi: 'झींगा',     gu: 'જીંગા' },
    prawns:     { hi: 'झींगा',     gu: 'જીંગા' },
    egg:        { hi: 'अंडा',      gu: 'ઇંડા' },
    paneer:     { hi: 'पनीर',      gu: 'પનીર' },
    veg:        { hi: 'वेज',       gu: 'વેજ' },
    kheema:     { hi: 'कीमा',      gu: 'ખીમા' },
    kebab:      { hi: 'कबाब',      gu: 'કબાબ' },
    tikka:      { hi: 'टिक्का',    gu: 'ટિક્કા' },
    biryani:    { hi: 'बिरयानी',   gu: 'બિરયાની' },

    // Preparations
    masala:     { hi: 'मसाला',     gu: 'મસાલા' },
    kadai:      { hi: 'कड़ाई',      gu: 'કડાઈ' },
    fry:        { hi: 'फ्राई',     gu: 'ફ્રાય' },
    fried:      { hi: 'फ्राइड',    gu: 'ફ્રાઇડ' },
    gravy:      { hi: 'ग्रेवी',    gu: 'ગ્રેવી' },
    dry:        { hi: 'सूखी',      gu: 'સૂકી' },
    grilled:    { hi: 'ग्रिल्ड',   gu: 'ગ્રિલ્ડ' },
    roasted:    { hi: 'रोस्टेड',   gu: 'રોસ્ટેડ' },
    tandoori:   { hi: 'तंदूरी',    gu: 'તંદૂરી' },
    hyderabadi: { hi: 'हैदराबादी', gu: 'હૈદરાબાદી' },
    special:    { hi: 'स्पेशल',    gu: 'સ્પેશિયલ' },
    plain:      { hi: 'सादा',      gu: 'સાદા' },
    plane:      { hi: 'सादा',      gu: 'સાદા' },

    // Breads, rice & sides
    rice:       { hi: 'चावल',      gu: 'રાઇસ' },
    roti:       { hi: 'रोटी',      gu: 'રોટલી' },
    rotla:      { hi: 'रोटला',     gu: 'રોટલા' },
    pudaa:      { hi: 'पुड़ा',      gu: 'પુડા' },
    chokha:     { hi: 'चावल',      gu: 'ચોખા' },
    naan:       { hi: 'नान',       gu: 'નાન' },
    paratha:    { hi: 'पराठा',     gu: 'પરાઠા' },
    salad:      { hi: 'सलाद',      gu: 'સલાડ' },
    papad:      { hi: 'पापड़',      gu: 'પાપડ' },
    dal:        { hi: 'दाल',       gu: 'દાળ' },
    curry:      { hi: 'करी',       gu: 'કરી' },
    soup:       { hi: 'सूप',       gu: 'સૂપ' },

    // Beverages
    water:      { hi: 'वाटर',      gu: 'વોટર' },
    mineral:    { hi: 'मिनरल',     gu: 'મિનરલ' },
    jeera:      { hi: 'जीरा',      gu: 'જીરા' },
    soft:       { hi: 'सॉफ्ट',     gu: 'સોફ્ટ' },
    drink:      { hi: 'ड्रिंक',    gu: 'ડ્રિંક' },
    drinks:     { hi: 'ड्रिंक्स',  gu: 'ડ્રિંક્સ' },
    cold:       { hi: 'कोल्ड',     gu: 'કોલ્ડ' },
    hot:        { hi: 'गरम',       gu: 'ગરમ' },
    tea:        { hi: 'चाय',       gu: 'ચા' },
    coffee:     { hi: 'कॉफी',      gu: 'કોફી' },
    lassi:      { hi: 'लस्सी',     gu: 'લસ્સી' },
    juice:      { hi: 'जूस',       gu: 'જ્યુસ' },
    beverages:  { hi: 'बेवरेजेज',  gu: 'બેવરેજિસ' },
    beverage:   { hi: 'बेवरेज',    gu: 'બેવરેજ' },

    // Structural words
    item:       { hi: 'आइटम',      gu: 'આઇટમ' },
    items:      { hi: 'आइटम',      gu: 'આઇટમ' },
    na:         { hi: 'के',        gu: 'ના' },
    and:        { hi: 'और',        gu: 'અને' },
    with:       { hi: 'के साथ',    gu: 'સાથે' }
  };

  const LANGS = ['en', 'hi', 'gu'];

  function normalize(s) {
    return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /*
    Translate an English string into `lang`.
    Returns { text, complete }:
      complete === true  -> every significant word was translatable
      complete === false -> `text` falls back to English (do not treat as a translation)
  */
  function translate(english, lang) {
    const source = String(english == null ? '' : english).trim();
    if (!source) return { text: '', complete: true };
    if (lang === 'en') return { text: source, complete: true };

    const phrase = PHRASES[normalize(source)];
    if (phrase && phrase[lang]) return { text: phrase[lang], complete: true };

    // Split into words while preserving separators such as spaces and brackets.
    const tokens = source.split(/([^A-Za-z]+)/);
    let translatedAny = false;
    let missing = false;

    const out = tokens.map(token => {
      if (!/^[A-Za-z]+$/.test(token)) return token; // separator, keep as-is
      const term = TERMS[token.toLowerCase()];
      if (term && term[lang]) { translatedAny = true; return term[lang]; }
      missing = true;
      return token;
    }).join('');

    if (!translatedAny || missing) return { text: source, complete: false };
    return { text: out.replace(/\s+/g, ' ').trim(), complete: true };
  }

  /*
    Resolve the text to display for a content field.

    `field` is { en, hi, gu } where hi/gu may be empty. Precedence:
      1. A manual override the admin explicitly typed for that language.
      2. An auto-derived translation from the glossary.
      3. The English source (graceful fallback — never shows an empty menu row).
  */
  function resolve(field, lang) {
    if (!field) return '';
    const manual = field[lang];
    if (lang !== 'en' && manual && String(manual).trim()) return String(manual).trim();
    const en = field.en || '';
    if (lang === 'en') return en;
    return translate(en, lang).text;
  }

  /*
    Describe how a field's translation for `lang` was produced.
    Returns 'manual' | 'auto' | 'missing' | 'source'.
    The admin panel uses this to show translation status per field.
  */
  function status(field, lang) {
    if (lang === 'en') return 'source';
    if (!field) return 'missing';
    const manual = field[lang];
    if (manual && String(manual).trim()) return 'manual';
    if (!field.en || !String(field.en).trim()) return 'missing';
    return translate(field.en, lang).complete ? 'auto' : 'missing';
  }

  root.NDDGlossary = { PHRASES, TERMS, LANGS, translate, resolve, status, normalize };

})(typeof window !== 'undefined' ? window : globalThis);
