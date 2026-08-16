/*
  New Delhi Darbar — static UI strings.

  These are fixed interface labels (not admin-managed content). Menu content is
  translated via glossary.js from the admin's English source; this file only
  covers chrome such as "Address" or the language-picker header.
*/
(function (root) {
  'use strict';

  const UI = {
    en: {
      restaurant: 'Restaurant',
      addressLabel: 'Address',
      languageLabel: 'Language',
      adminPanel: 'Admin Panel',
      themeToLight: 'Switch to light theme',
      themeToDark: 'Switch to dark theme',
      menuCategories: 'Menu categories',
      highlights: 'Restaurant highlights',
      notes: 'Restaurant notes'
    },
    hi: {
      restaurant: 'रेस्टोरेंट',
      addressLabel: 'पता',
      languageLabel: 'भाषा',
      adminPanel: 'एडमिन पैनल',
      themeToLight: 'लाइट थीम पर जाएँ',
      themeToDark: 'डार्क थीम पर जाएँ',
      menuCategories: 'मेनू श्रेणियाँ',
      highlights: 'रेस्टोरेंट की विशेषताएँ',
      notes: 'रेस्टोरेंट सूचनाएँ'
    },
    gu: {
      restaurant: 'રેસ્ટોરન્ટ',
      addressLabel: 'સરનામું',
      languageLabel: 'ભાષા',
      adminPanel: 'એડમિન પેનલ',
      themeToLight: 'લાઇટ થીમ પર જાઓ',
      themeToDark: 'ડાર્ક થીમ પર જાઓ',
      menuCategories: 'મેનૂ શ્રેણીઓ',
      highlights: 'રેસ્ટોરન્ટની વિશેષતાઓ',
      notes: 'રેસ્ટોરન્ટ સૂચનાઓ'
    }
  };

  const LANG_NAMES = { en: 'English', hi: 'हिन्दी', gu: 'ગુજરાતી' };
  const LANG_CODES = { en: 'EN', hi: 'हि', gu: 'ગુ' };

  function t(lang, key) {
    return (UI[lang] && UI[lang][key]) || UI.en[key] || key;
  }

  root.NDDi18n = { UI, LANG_NAMES, LANG_CODES, t };

})(typeof window !== 'undefined' ? window : globalThis);
