/*
  New Delhi Darbar — brand info & notices.
  Menu categories/items live in menu.csv (open & edit in Excel).
  Edit this file's contents via admin.html (Admin Panel) — changes there
  update both this data and menu.csv, and both pages reflect it automatically.
*/
window.NDD_CONFIG = {
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
