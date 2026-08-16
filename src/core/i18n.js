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
      notes: 'Restaurant notes',
      pricingDisclaimer: 'Prices are in Indian Rupees (₹). Applicable taxes and service charges are additional unless otherwise stated.'
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
      notes: 'रेस्टोरेंट सूचनाएँ',
      pricingDisclaimer: 'कीमतें भारतीय रुपये (₹) में हैं। लागू कर और सेवा शुल्क अतिरिक्त हैं जब तक कि अन्यथा न कहा गया हो।'
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
      notes: 'રેસ્ટોરન્ટ સૂચનાઓ',
      pricingDisclaimer: 'કિંમતો ભારતીય રૂપિયા (₹) માં છે. લાગુ કર અને સેવા શુલ્ક વધારાના છે સિવાય કે અન્યથા જણાવ્યું હોય.'
    }
  };

  const LANG_NAMES = { en: 'English', hi: 'हिन्दी', gu: 'ગુજરાતી' };
  const LANG_CODES = { en: 'EN', hi: 'हि', gu: 'ગુ' };

  function t(lang, key) {
    return (UI[lang] && UI[lang][key]) || UI.en[key] || key;
  }

  root.NDDi18n = { UI, LANG_NAMES, LANG_CODES, t };

})(typeof window !== 'undefined' ? window : globalThis);
