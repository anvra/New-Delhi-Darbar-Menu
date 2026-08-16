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
    'soft drinks':   { hi: 'सॉफ्ट ड्रिंक्स',  gu: 'સોફ્ટ ડ્રિંક્સ' },

    /* --- Common dish names --- */
    'do pyaza':      { hi: 'दो प्याज़ा',     gu: 'દો પ્યાઝા' },
    'fried rice':    { hi: 'फ्राइड राइस',   gu: 'ફ્રાઇડ રાઇસ' },
    'spring roll':   { hi: 'स्प्रिंग रोल',  gu: 'સ્પ્રિંગ રોલ' },
    'spring rolls':  { hi: 'स्प्रिंग रोल',  gu: 'સ્પ્રિંગ રોલ' },

    /* --- Breads --- */
    'tandoori roti': { hi: 'तंदूरी रोटी',   gu: 'તંદૂરી રોટી' },
    'butter roti':   { hi: 'बटर रोटी',      gu: 'બટર રોટી' },
    'butter naan':   { hi: 'बटर नान',       gu: 'બટર નાન' },
    'garlic naan':   { hi: 'गार्लिक नान',   gu: 'ગાર્લિક નાન' },

    /* --- Rice --- */
    'steamed rice':  { hi: 'स्टीम्ड राइस',  gu: 'સ્ટીમ્ડ રાઇસ' },
    'jeera rice':    { hi: 'जीरा राइस',     gu: 'જીરા રાઇસ' },
    'curd rice':     { hi: 'दही चावल',      gu: 'દહીં ભાત' },

    /* --- Desserts --- */
    'gulab jamun':   { hi: 'गुलाब जामुन',   gu: 'ગુલાબ જાંબુ' },
    'ice cream':     { hi: 'आइसक्रीम',      gu: 'આઈસ્ક્રીમ' },

    /* --- Beverages --- */
    'sweet lassi':     { hi: 'मीठी लस्सी',    gu: 'મીઠી લસ્સી' },
    'salted lassi':    { hi: 'नमकीन लस्सी',   gu: 'નમકીન લસ્સી' },
    'lime soda':       { hi: 'लाइम सोडा',     gu: 'લાઇમ સોડા' },
    'fresh lime':      { hi: 'फ्रेश लाइम',    gu: 'ફ્રેશ લાઇમ' },
    'fresh lime soda': { hi: 'फ्रेश लाइम सोडा', gu: 'ફ્રેશ લાઇમ સોડા' },
    'sugarcane juice': { hi: 'गन्ने का रस',   gu: 'શેરડીનો રસ' },
    'coconut water':   { hi: 'नारियल पानी',   gu: 'નાળિયેર પાણી' },
    'iced tea':        { hi: 'आइस्ड टी',      gu: 'આઈસ્ડ ટી' },
    'green tea':       { hi: 'ग्रीन टी',      gu: 'ગ્રીન ટી' },
    'masala tea':      { hi: 'मसाला चाय',     gu: 'મસાલા ચા' },
    'masala chai':     { hi: 'मसाला चाय',     gu: 'મસાલા ચા' },

    /* --- Descriptors & menu sections --- */
    'with bone':       { hi: 'हड्डी के साथ',  gu: 'હાડકાં સાથે' },
    'chef special':    { hi: 'शेफ स्पेशल',    gu: 'શેફ સ્પેશિયલ' },
    "chef's special":  { hi: 'शेफ स्पेशल',    gu: 'શેફ સ્પેશિયલ' },
    "today's special": { hi: 'आज का स्पेशल',  gu: 'આજની સ્પેશિયલ' },
    'stir fried':      { hi: 'स्टर फ्राइड',   gu: 'સ્ટર ફ્રાઇડ' },
    'deep fried':      { hi: 'डीप फ्राइड',    gu: 'ડીપ ફ્રાઇડ' },
    'shallow fried':   { hi: 'शैलो फ्राइड',   gu: 'શેલો ફ્રાઇડ' },
    'main course':     { hi: 'मेन कोर्स',     gu: 'મેઇન કોર્સ' },
    'side dish':       { hi: 'साइड डिश',      gu: 'સાઇડ ડિશ' },
    'side dishes':     { hi: 'साइड डिश',      gu: 'સાઇડ ડિશ' },
    'non veg':         { hi: 'नॉन-वेज',       gu: 'નોન-વેજ' },
    'non-veg':         { hi: 'नॉन-वेज',       gu: 'નોન-વેજ' },
    'semi dry':        { hi: 'सेमी ड्राई',    gu: 'સેમી ડ્રાય' },
    'half plate':      { hi: 'हाफ प्लेट',     gu: 'હાફ પ્લેટ' },
    'full plate':      { hi: 'फुल प्लेट',     gu: 'ફુલ પ્લેટ' }
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
    with:       { hi: 'के साथ',    gu: 'સાથે' },

    /* --- Vegetables --- */
    onion:       { hi: 'प्याज',      gu: 'ડુંગળી' },
    tomato:      { hi: 'टमाटर',      gu: 'ટામેટા' },
    potato:      { hi: 'आलू',        gu: 'બટાકા' },
    aloo:        { hi: 'आलू',        gu: 'બટાકા' },
    spinach:     { hi: 'पालक',       gu: 'પાલક' },
    palak:       { hi: 'पालक',       gu: 'પાલક' },
    okra:        { hi: 'भिंडी',      gu: 'ભીંડા' },
    bhindi:      { hi: 'भिंडी',      gu: 'ભીંડા' },
    cauliflower: { hi: 'गोभी',       gu: 'ફ્લાવર' },
    gobi:        { hi: 'गोभी',       gu: 'ગોબી' },
    peas:        { hi: 'मटर',        gu: 'વટાણા' },
    matar:       { hi: 'मटर',        gu: 'મટર' },
    brinjal:     { hi: 'बैंगन',      gu: 'રીંગણ' },
    eggplant:    { hi: 'बैंगन',      gu: 'રીંગણ' },
    cabbage:     { hi: 'पत्ता गोभी', gu: 'કોબીજ' },
    carrot:      { hi: 'गाजर',       gu: 'ગાજર' },
    mushroom:    { hi: 'मशरूम',      gu: 'મશરૂમ' },
    corn:        { hi: 'मक्का',      gu: 'મકાઈ' },
    garlic:      { hi: 'लहसुन',      gu: 'લસણ' },
    ginger:      { hi: 'अदरक',       gu: 'આદુ' },
    chilli:      { hi: 'मिर्च',      gu: 'મરચાં' },
    chili:       { hi: 'मिर्च',      gu: 'મરચાં' },
    lemon:       { hi: 'नींबू',      gu: 'લીંબુ' },
    lime:        { hi: 'नींबू',      gu: 'લીંબુ' },
    coriander:   { hi: 'धनिया',      gu: 'કોથમીર' },
    mint:        { hi: 'पुदीना',     gu: 'ફુદીનો' },

    /* --- Dairy & proteins --- */
    butter:     { hi: 'बटर',      gu: 'બટર' },
    cheese:     { hi: 'चीज़',      gu: 'ચીઝ' },
    cream:      { hi: 'क्रीम',    gu: 'ક્રીમ' },
    curd:       { hi: 'दही',      gu: 'દહીં' },
    yogurt:     { hi: 'दही',      gu: 'દહીં' },
    milk:       { hi: 'दूध',      gu: 'દૂધ' },
    buttermilk: { hi: 'छाछ',      gu: 'છાશ' },
    chaas:      { hi: 'छाछ',      gu: 'છાશ' },
    ghee:       { hi: 'घी',       gu: 'ઘી' },
    omelette:   { hi: 'ऑमलेट',    gu: 'ઓમલેટ' },
    omlet:      { hi: 'ऑमलेट',    gu: 'ઓમલેટ' },

    /* --- Dishes & preparations --- */
    pulao:      { hi: 'पुलाव',     gu: 'પુલાવ' },
    korma:      { hi: 'कोरमा',     gu: 'કોરમા' },
    vindaloo:   { hi: 'विंदालू',   gu: 'વિંદાલૂ' },
    jalfrezi:   { hi: 'जालफ्रेजी', gu: 'જાલફ્રેજી' },
    handi:      { hi: 'हांडी',     gu: 'હાંડી' },
    tawa:       { hi: 'तवा',       gu: 'તવા' },
    sizzler:    { hi: 'सिजलर',     gu: 'સિઝલર' },
    lollipop:   { hi: 'लॉलीपॉप',   gu: 'લોલીપોપ' },
    manchurian: { hi: 'मंचूरियन',  gu: 'મંચૂરિયન' },
    schezwan:   { hi: 'शेजवान',    gu: 'શેજવાન' },
    chowmein:   { hi: 'चाउमीन',    gu: 'ચાઉમીન' },
    noodles:    { hi: 'नूडल्स',    gu: 'નૂડલ્સ' },
    // In Gujarat these are universally "bhajiya" on menus, not a transliteration.
    pakora:     { hi: 'पकोड़ा',     gu: 'ભજીયા' },
    bhajiya:    { hi: 'पकोड़ा',     gu: 'ભજીયા' },
    samosa:     { hi: 'समोसा',     gu: 'સમોસા' },
    cutlet:     { hi: 'कटलेट',     gu: 'કટલેટ' },
    roll:       { hi: 'रोल',       gu: 'રોલ' },
    wrap:       { hi: 'रैप',       gu: 'રેપ' },
    sandwich:   { hi: 'सैंडविच',   gu: 'સેન્ડવીચ' },
    burger:     { hi: 'बर्गर',     gu: 'બર્ગર' },
    pizza:      { hi: 'पिज़्ज़ा',   gu: 'પિઝ્ઝા' },
    momos:      { hi: 'मोमोज़',     gu: 'મોમોઝ' },
    thali:      { hi: 'थाली',      gu: 'થાળી' },
    combo:      { hi: 'कॉम्बो',    gu: 'કોમ્બો' },
    platter:    { hi: 'प्लेटर',    gu: 'પ્લેટર' },

    /* --- Breads --- */
    chapati: { hi: 'चपाती',  gu: 'ચપાતી' },
    phulka:  { hi: 'फुल्का', gu: 'ફુલકા' },
    kulcha:  { hi: 'कुलचा',  gu: 'કુલચા' },
    bhatura: { hi: 'भटूरा',  gu: 'ભટૂરા' },
    puri:    { hi: 'पूरी',   gu: 'પુરી' },
    bhakri:  { hi: 'भाखरी',  gu: 'ભાખરી' },
    thepla:  { hi: 'थेपला',  gu: 'થેપલા' },
    khakhra: { hi: 'खाखरा',  gu: 'ખાખરા' },

    /* --- Rice --- */
    khichdi: { hi: 'खिचड़ी', gu: 'ખીચડી' },

    /* --- Desserts --- */
    rasgulla:  { hi: 'रसगुल्ला', gu: 'રસગુલ્લા' },
    kulfi:     { hi: 'कुल्फी',   gu: 'કુલ્ફી' },
    halwa:     { hi: 'हलवा',     gu: 'હલવો' },
    shrikhand: { hi: 'श्रीखंड',  gu: 'શ્રીખંડ' },
    basundi:   { hi: 'बासुंदी',  gu: 'બાસુંદી' },
    jalebi:    { hi: 'जलेबी',    gu: 'જલેબી' },
    dessert:   { hi: 'मिठाई',    gu: 'મીઠાઈ' },

    /* --- Beverages --- */
    milkshake: { hi: 'मिल्कशेक',  gu: 'મિલ્કશેક' },
    falooda:   { hi: 'फालूदा',    gu: 'ફાલુદા' },
    soda:      { hi: 'सोडा',      gu: 'સોડા' },
    mocktail:  { hi: 'मॉकटेल',    gu: 'મોકટેલ' },

    /* --- Descriptors --- */
    spicy:     { hi: 'तीखा',       gu: 'તીખું' },
    mild:      { hi: 'कम तीखा',    gu: 'ઓછું તીખું' },
    sweet:     { hi: 'मीठा',       gu: 'મીઠું' },
    salted:    { hi: 'नमकीन',      gu: 'નમકીન' },
    sour:      { hi: 'खट्टा',      gu: 'ખાટું' },
    tangy:     { hi: 'चटपटा',      gu: 'ચટપટું' },
    crispy:    { hi: 'कुरकुरा',    gu: 'કરકરું' },
    stuffed:   { hi: 'भरवां',      gu: 'ભરેલું' },
    mixed:     { hi: 'मिक्स',      gu: 'મિક્સ' },
    assorted:  { hi: 'असॉर्टेड',   gu: 'એસોર્ટેડ' },
    half:      { hi: 'आधा',        gu: 'અડધું' },
    full:      { hi: 'फुल',        gu: 'ફુલ' },
    quarter:   { hi: 'क्वार्टर',   gu: 'ક્વાર્ટર' },
    small:     { hi: 'छोटा',       gu: 'નાનું' },
    large:     { hi: 'बड़ा',        gu: 'મોટું' },
    regular:   { hi: 'रेगुलर',     gu: 'રેગ્યુલર' },
    jumbo:     { hi: 'जंबो',       gu: 'જંબો' },
    family:    { hi: 'फैमिली',     gu: 'ફેમિલી' },
    single:    { hi: 'सिंगल',      gu: 'સિંગલ' },
    double:    { hi: 'डबल',        gu: 'ડબલ' },
    extra:     { hi: 'एक्स्ट्रा',  gu: 'એક્સ્ટ્રા' },
    without:   { hi: 'बिना',       gu: 'વગર' },
    boneless:  { hi: 'बोनलेस',     gu: 'બોનલેસ' },
    seasonal:  { hi: 'मौसमी',      gu: 'મોસમી' },
    boiled:    { hi: 'उबला',       gu: 'બાફેલું' },
    baked:     { hi: 'बेक्ड',      gu: 'બેક્ડ' },
    steamed:   { hi: 'स्टीम्ड',    gu: 'સ્ટીમ્ડ' },

    /* --- Menu sections --- */
    starter:    { hi: 'स्टार्टर',    gu: 'સ્ટાર્ટર' },
    starters:   { hi: 'स्टार्टर',    gu: 'સ્ટાર્ટર' },
    appetizer:  { hi: 'एपेटाइज़र',   gu: 'એપેટાઇઝર' },
    snack:      { hi: 'नाश्ता',      gu: 'નાસ્તો' },
    snacks:     { hi: 'नाश्ता',      gu: 'નાસ્તો' },
    breakfast:  { hi: 'नाश्ता',      gu: 'નાસ્તો' },
    lunch:      { hi: 'लंच',         gu: 'લંચ' },
    dinner:     { hi: 'डिनर',        gu: 'ડિનર' },
    jain:       { hi: 'जैन',         gu: 'જૈન' },
    vegan:      { hi: 'वीगन',        gu: 'વીગન' },
    roast:      { hi: 'रोस्ट',       gu: 'રોસ્ટ' },
    sides:      { hi: 'साइड डिश',    gu: 'સાઇડ ડિશ' },
    extras:     { hi: 'एक्स्ट्रा',   gu: 'એક્સ્ટ્રા' },

    /* --- Colours & misc modifiers --- */
    green:   { hi: 'हरा',      gu: 'લીલું' },
    red:     { hi: 'लाल',      gu: 'લાલ' },
    white:   { hi: 'सफेद',     gu: 'સફેદ' },
    black:   { hi: 'काला',     gu: 'કાળું' },
    yellow:  { hi: 'पीला',     gu: 'પીળું' },
    classic: { hi: 'क्लासिक',  gu: 'ક્લાસિક' },

    /* --- Units & serving --- */
    plate:   { hi: 'प्लेट',     gu: 'પ્લેટ' },
    bowl:    { hi: 'कटोरी',     gu: 'વાટકી' },
    glass:   { hi: 'गिलास',     gu: 'ગ્લાસ' },
    bottle:  { hi: 'बोतल',      gu: 'બોટલ' },
    cup:     { hi: 'कप',        gu: 'કપ' },
    kg:      { hi: 'किलो',      gu: 'કિલો' },
    gram:    { hi: 'ग्राम',     gu: 'ગ્રામ' },
    litre:   { hi: 'लीटर',      gu: 'લિટર' },
    per:     { hi: 'प्रति',     gu: 'દીઠ' },
    each:    { hi: 'प्रत्येक',  gu: 'દરેક' },
    portion: { hi: 'पोर्शन',    gu: 'પોર્શન' },
    serving: { hi: 'सर्विंग',   gu: 'સર્વિંગ' }
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
