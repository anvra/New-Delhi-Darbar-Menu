/*
  New Delhi Darbar — shared menu data.
  This file is the single source of truth for index.html and admin.html.
  Edit it via admin.html (Admin Panel) — changes there update this object
  and both pages reflect it automatically.
*/
window.NDD_DATA = {
  brand: {
    name: "New Delhi Darbar",
    tagline: "Restaurant",
    since: "Serving Since 2001",
    specialty: "Chokha na Rotla & Chokha na Pudaa Specialists",
    meta: "Bulk Orders Welcome • Authentic Taste • Consistent Quality",
    phones: ["+91 75675 87816", "+91 97120 52249"],
    address: "Opp. Masjid, Nana Taiwad, Valsad. 396001",
    mapUrl: "https://maps.app.goo.gl/PcJ4x3PgARtX2wjEA",
    stockNote: {
      en: "Note: Whatever is in the stock will be served.",
      hi: "नोट: स्टॉक में जो उपलब्ध होगा, वही परोसा जाएगा।",
      gu: "નોંધ: સ્ટોકમાં જે ઉપલબ્ધ હશે તે જ પીરસવામાં આવશે."
    },
    sourceNote: {
      en: "Prices and menu wording are preserved from the supplied menu. No tax or service-charge information is stated in the source.",
      hi: "कीमतें और मेनू की मूल जानकारी दिए गए मेनू के अनुसार रखी गई हैं। स्रोत में टैक्स या सर्विस चार्ज की जानकारी नहीं दी गई है।",
      gu: "કિંમતો અને મેનૂની મૂળ માહિતી આપેલા મેનૂ મુજબ જ રાખવામાં આવી છે. સ્રોતમાં ટેક્સ અથવા સર્વિસ ચાર્જની માહિતી દર્શાવેલી નથી."
    }
  },

  // Order here defines both the nav toolbar order and the menu section order.
  categories: [
    {
      id: "chicken",
      name: { en: "Chicken Item", hi: "चिकन आइटम", gu: "ચિકન આઇટમ" },
      items: [
        { en: "Chicken Masala", hi: "चिकन मसाला", gu: "ચિકન મસાલા", price: "80 Rs / plate" },
        { en: "Chicken Kadai", hi: "चिकन कड़ाई", gu: "ચિકન કડાઈ", price: "80 Rs / plate" },
        { en: "Chicken Tikka(Fry)", hi: "चिकन टिक्का (फ्राई)", gu: "ચિકન ટિક્કા (ફ્રાય)", price: "80 Rs / plate" },
        { en: "Chicken Tikka(Gravy)", hi: "चिकन टिक्का (ग्रेवी)", gu: "ચિકન ટિક્કા (ગ્રેવી)", price: "90 Rs / plate" },
        { en: "Dry Chicken", hi: "सूखी चिकन", gu: "સૂકી ચિકન", price: "100 Rs / plate" },
        { en: "Hyderabadi Chicken", hi: "हैदराबादी चिकन", gu: "હૈદરાબાદી ચિકન", price: "100 Rs / plate" },
        { en: "Chicken Biryani", hi: "चिकन बिरयानी", gu: "ચિકન બિરયાની", price: "90 Rs / plate" }
      ]
    },
    {
      id: "mutton",
      name: { en: "Mutton Item", hi: "मटन आइटम", gu: "મટન આઇટમ" },
      items: [
        { en: "Mutton Masala", hi: "मटन मसाला", gu: "મટન મસાલા", price: "130 Rs / plate" },
        { en: "Mutton Kadai", hi: "मटन कड़ाई", gu: "મટન કડાઈ", price: "130 Rs / plate" },
        { en: "Kheema Masala", hi: "कीमा मसाला", gu: "ખીમા મસાલા", price: "100 Rs / plate" },
        { en: "Kebab (Gravy)", hi: "कबाब (ग्रेवी)", gu: "કબાબ (ગ્રેવી)", price: "130 Rs / plate" },
        { en: "Kebab (Fry)", hi: "कबाब (फ्राई)", gu: "કબાબ (ફ્રાય)", price: "100 Rs / plate" }
      ]
    },
    {
      id: "fish",
      name: { en: "Fish Item", hi: "फिश आइटम", gu: "ફિશ આઈટમ" },
      items: [
        { en: "Paplet Fry", hi: "पापलेट फ्राई", gu: "પેપલેટ ફ્રાય", price: "100 Rs / plate" },
        { en: "Jinga(Gravy)", hi: "झींगा (ग्रेवी)", gu: "જીંગા (ગ્રેવી)", price: "100 Rs / plate" },
        { en: "Fish Fry", hi: "मछली फ्राई", gu: "મચ્છી ફ્રાય", price: "100 Rs / plate" }
      ]
    },
    {
      id: "rice",
      name: { en: "Rice", hi: "चावल", gu: "રાઇસ" },
      items: [
        { en: "Biryani Rice", hi: "बिरयानी चावल", gu: "બિરયાની રાઇસ", price: "30 Rs / plate" },
        { en: "Plane Rice", hi: "सादा चावल", gu: "સાદા રાઇસ", price: "30 Rs / plate" }
      ]
    },
    {
      id: "roti",
      name: { en: "Roti", hi: "रोटी", gu: "રોટી" },
      items: [
        { en: "Plain Roti", hi: "सादी रोटी", gu: "ઘઉં ની રોટલી", price: "5 Rs / pc" },
        { en: "Chokha na Rotla", hi: "चावल के रोटला", gu: "ચોખા ના રોટલા", price: "7 Rs / pc" },
        { en: "Chokha na Pudaa", hi: "चावल के पुड़ा", gu: "ચોખા ના પુડા", price: "6 Rs / pc" }
      ]
    },
    {
      id: "beverages",
      name: { en: "Cold Beverages", hi: "कोल्ड बेवरेजेज", gu: "કોલ્ડ બેવરેજિસ" },
      items: [
        { en: "Mineral Water", hi: "मिनरल वाटर", gu: "મિનરલ વોટર", price: "10/20 Rs" },
        { en: "Jeera", hi: "जीरा", gu: "જીરા", price: "10 Rs" },
        { en: "Soft Drinks", hi: "सॉफ्ट ड्रिंक्स", gu: "સોફ્ટ ડ્રિંક્સ", price: "20/40 Rs" }
      ]
    }
  ],

  notices: [
    {
      title: { en: "Fresh preparation", hi: "ताज़ा तैयारी", gu: "તાજી તૈયારી" },
      html: {
        en: "<strong>Chicken, Mutton &amp; Fish</strong> are prepared fresh as per your order and preference. Quantities and preparation can be customized according to your requirements. Prices may vary based on the quality, quantity, and preparation of the food.",
        hi: "<strong>चिकन, मटन और मछली</strong> आपके ऑर्डर और पसंद के अनुसार ताज़ा तैयार किए जाते हैं। मात्रा और तैयारी आपकी आवश्यकता के अनुसार बदली जा सकती है। भोजन की गुणवत्ता, मात्रा और तैयारी के अनुसार कीमत अलग हो सकती है।",
        gu: "<strong>ચિકન, મટન અને ફિશ</strong> તમારા ઓર્ડર અને પસંદગી મુજબ તાજા તૈયાર કરવામાં આવે છે. માત્રા અને તૈયારી તમારી જરૂરિયાત મુજબ કસ્ટમાઇઝ કરી શકાય છે. ખોરાકની ગુણવત્તા, માત્રા અને તૈયારી મુજબ કિંમત અલગ હોઈ શકે છે."
      }
    },
    {
      title: { en: "Special Note", hi: "विशेष सूचना", gu: "ખાસ નોંધ" },
      html: {
        en: "We also accept <strong>bulk quantity orders</strong> for:",
        hi: "हम <strong>बड़ी मात्रा के ऑर्डर</strong> भी स्वीकार करते हैं:",
        gu: "અમે <strong>મોટી માત્રાના ઓર્ડર</strong> પણ સ્વીકારીએ છીએ:"
      },
      bulkList: [
        { en: "Plain Roti", hi: "सादी रोटी", gu: "ઘઉં ની રોટલી" },
        { en: "Chokha na Rotla", hi: "चावल के रोटला", gu: "ચોખા ના રોટલા" },
        { en: "Chokha na Pudaa", hi: "चावल के पुड़ा", gu: "ચોખા ના પુડા" }
      ],
      bulkPricing: {
        en: "<strong>Special bulk-order pricing:</strong> The price remains <strong>the same even for large quantities</strong>. Please place your order in advance for bulk quantities.",
        hi: "<strong>विशेष बल्क-ऑर्डर मूल्य:</strong> बड़ी मात्रा में भी <strong>कीमत समान रहती है</strong>। बड़ी मात्रा के लिए कृपया पहले से ऑर्डर करें।",
        gu: "<strong>ખાસ બલ્ક-ઓર્ડર કિંમત:</strong> મોટી માત્રા માટે પણ <strong>કિંમત સમાન રહેશે</strong>. મોટી માત્રા માટે કૃપા કરીને અગાઉથી ઓર્ડર આપો."
      }
    }
  ]
};
