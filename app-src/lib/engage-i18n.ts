import { isLang, type Lang } from "./review-i18n";

/**
 * Chrome text for the customer pages of menus, business cards, lead forms, coupons and loyalty cards
 * in English, Tamil and Hindi. What a business writes (menu items, offer wording, form titles) is shown
 * exactly as typed. NOTE: Tamil and Hindi are first translations; have a native speaker review them.
 */

export type EStrings = {
  powered: string;
  language: string;
  unavailableTitle: string;
  unavailableBody: string;
  menu: { add: string; soldOut: string; orderWa: string; order: (n: number, total: string) => string; remove: string; nav: string; veg: string; nonveg: string; yourOrder: string };
  card: { saveContact: string; call: string; whatsapp: string; email: string; website: string; office: string };
  lead: { name: string; phone: string; email: string; interest: string; time: string; message: string; consent: string; optIn: string; thanksTitle: string; thanksBody: string; sending: string; error: string; required: string };
  coupon: {
    offer: string;
    yourCode: string;
    oneUse: (date: string) => string;
    phone: string;
    name: string;
    optIn: string;
    claim: string;
    claiming: string;
    copy: string;
    copied: string;
    sendWa: string;
    redeemNote: string;
    ended: string;
    paused: string;
    notStarted: string;
    soldOut: string;
    already: string;
    error: string;
    used: string;
  };
  loyalty: {
    joinTitle: string;
    joinSub: string;
    name: string;
    phone: string;
    optIn: string;
    join: string;
    joining: string;
    of: (n: number, m: number) => string;
    more: (n: number, reward: string) => string;
    howTitle: string;
    howBody: string;
    staffTitle: string;
    staffBody: string;
    pin: string;
    addStamp: string;
    adding: string;
    today: string;
    added: string;
    rewardNow: string;
    ready: string;
    badPin: (n: number) => string;
    locked: string;
    error: string;
    change: string;
    rewardsReady: string;
  };
};

export const E: Record<Lang, EStrings> = {
  en: {
    powered: "Powered by Skanor",
    language: "Language",
    unavailableTitle: "This page isn't available",
    unavailableBody: "The business has paused it or hasn't published it yet.",
    menu: { add: "Add", soldOut: "Sold out", orderWa: "Order on WhatsApp", order: (n, t) => `Order on WhatsApp · ${n} ${n === 1 ? "item" : "items"}${t ? ` · ${t}` : ""}`, remove: "Remove", nav: "Menu sections", veg: "Vegetarian", nonveg: "Non-vegetarian", yourOrder: "Your order" },
    card: { saveContact: "Save contact", call: "Call", whatsapp: "WhatsApp", email: "Email", website: "Website", office: "OFFICE" },
    lead: { name: "Name", phone: "WhatsApp number", email: "Email", interest: "I am interested in", time: "Preferred time", message: "Message", consent: "By submitting you agree to be contacted on WhatsApp.", optIn: "Also send me offers on WhatsApp", thanksTitle: "Thank you!", thanksBody: "We have your details and will be in touch soon.", sending: "Sending…", error: "Something went wrong. Please try again.", required: "Please fill in the highlighted fields." },
    coupon: {
      offer: "OFFER",
      yourCode: "Your code",
      oneUse: (d) => `One use · valid till ${d}`,
      phone: "WhatsApp number",
      name: "Name (optional)",
      optIn: "Send me more offers on WhatsApp",
      claim: "Claim this offer",
      claiming: "Claiming…",
      copy: "Copy code",
      copied: "Code copied",
      sendWa: "Send to my WhatsApp",
      redeemNote: "Show this code at the counter. Staff will enter it to redeem.",
      ended: "This offer has ended.",
      paused: "This offer is paused right now.",
      notStarted: "This offer hasn't started yet.",
      soldOut: "All of these offers have been claimed.",
      already: "You've already claimed this offer. Here is your code.",
      error: "Something went wrong. Please try again.",
      used: "This code has been used.",
    },
    loyalty: {
      joinTitle: "Join and collect stamps",
      joinSub: "Enter your number to start your card.",
      name: "Name (optional)",
      phone: "WhatsApp number",
      optIn: "Send me offers on WhatsApp",
      join: "Get my card",
      joining: "One moment…",
      of: (n, m) => `${n} / ${m}`,
      more: (n, r) => `${n} more ${n === 1 ? "visit" : "visits"} for ${r}`,
      howTitle: "How it works",
      howBody: "Show this card at billing. The cashier adds a stamp with their PIN.",
      staffTitle: "Staff: add a stamp",
      staffBody: "Only your team has the PIN.",
      pin: "4-digit staff PIN",
      addStamp: "Add stamp",
      adding: "Adding…",
      today: "A stamp was already added today. Come back on your next visit.",
      added: "Stamp added!",
      rewardNow: "You earned a reward!",
      ready: "Reward ready",
      badPin: (n) => `That PIN isn't right. ${n} ${n === 1 ? "try" : "tries"} left.`,
      locked: "Too many wrong PINs. Try again in 15 minutes.",
      error: "Something went wrong. Please try again.",
      change: "Use a different number",
      rewardsReady: "Show this code at the counter to claim your reward.",
    },
  },
  ta: {
    powered: "Skanor வழங்குகிறது",
    language: "மொழி",
    unavailableTitle: "இந்தப் பக்கம் கிடைக்கவில்லை",
    unavailableBody: "வணிகம் இதை இடைநிறுத்தியுள்ளது அல்லது இன்னும் வெளியிடவில்லை.",
    menu: { add: "சேர்", soldOut: "தீர்ந்துவிட்டது", orderWa: "WhatsApp-ல் ஆர்டர் செய்யுங்கள்", order: (n, t) => `WhatsApp-ல் ஆர்டர் · ${n} பொருட்கள்${t ? ` · ${t}` : ""}`, remove: "நீக்கு", nav: "மெனு பிரிவுகள்", veg: "சைவம்", nonveg: "அசைவம்", yourOrder: "உங்கள் ஆர்டர்" },
    card: { saveContact: "தொடர்பைச் சேமி", call: "அழை", whatsapp: "WhatsApp", email: "மின்னஞ்சல்", website: "இணையதளம்", office: "அலுவலகம்" },
    lead: { name: "பெயர்", phone: "WhatsApp எண்", email: "மின்னஞ்சல்", interest: "எனக்கு ஆர்வம்", time: "விருப்பமான நேரம்", message: "செய்தி", consent: "சமர்ப்பிப்பதன் மூலம் WhatsApp-ல் உங்களைத் தொடர்புகொள்ள ஒப்புக்கொள்கிறீர்கள்.", optIn: "சலுகைகளையும் WhatsApp-ல் அனுப்புங்கள்", thanksTitle: "நன்றி!", thanksBody: "உங்கள் விவரங்கள் கிடைத்தன. விரைவில் தொடர்புகொள்வோம்.", sending: "அனுப்புகிறது…", error: "ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.", required: "குறிக்கப்பட்ட புலங்களை நிரப்புங்கள்." },
    coupon: {
      offer: "சலுகை",
      yourCode: "உங்கள் குறியீடு",
      oneUse: (d) => `ஒருமுறை மட்டும் · ${d} வரை செல்லும்`,
      phone: "WhatsApp எண்",
      name: "பெயர் (விருப்பம்)",
      optIn: "மேலும் சலுகைகளை WhatsApp-ல் அனுப்புங்கள்",
      claim: "இந்தச் சலுகையைப் பெறுங்கள்",
      claiming: "பெறுகிறது…",
      copy: "குறியீட்டை நகலெடு",
      copied: "குறியீடு நகலெடுக்கப்பட்டது",
      sendWa: "என் WhatsApp-க்கு அனுப்பு",
      redeemNote: "கவுண்டரில் இந்தக் குறியீட்டைக் காட்டுங்கள். ஊழியர் இதை உள்ளிட்டு பயன்படுத்துவார்.",
      ended: "இந்தச் சலுகை முடிந்துவிட்டது.",
      paused: "இந்தச் சலுகை தற்போது இடைநிறுத்தப்பட்டுள்ளது.",
      notStarted: "இந்தச் சலுகை இன்னும் தொடங்கவில்லை.",
      soldOut: "இந்தச் சலுகைகள் அனைத்தும் பெறப்பட்டுவிட்டன.",
      already: "இந்தச் சலுகையை ஏற்கனவே பெற்றுவிட்டீர்கள். இதோ உங்கள் குறியீடு.",
      error: "ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.",
      used: "இந்தக் குறியீடு பயன்படுத்தப்பட்டுவிட்டது.",
    },
    loyalty: {
      joinTitle: "சேர்ந்து ஸ்டாம்புகளைச் சேகரியுங்கள்",
      joinSub: "உங்கள் எண்ணை உள்ளிட்டு அட்டையைத் தொடங்குங்கள்.",
      name: "பெயர் (விருப்பம்)",
      phone: "WhatsApp எண்",
      optIn: "சலுகைகளை WhatsApp-ல் அனுப்புங்கள்",
      join: "என் அட்டையைப் பெறு",
      joining: "ஒரு நிமிடம்…",
      of: (n, m) => `${n} / ${m}`,
      more: (n, r) => `${r} பெற இன்னும் ${n} வருகைகள்`,
      howTitle: "இது எப்படி வேலை செய்கிறது",
      howBody: "பில் செலுத்தும்போது இந்த அட்டையைக் காட்டுங்கள். காசாளர் PIN மூலம் ஸ்டாம்பு சேர்ப்பார்.",
      staffTitle: "ஊழியர்: ஸ்டாம்பு சேர்க்க",
      staffBody: "உங்கள் குழுவிடம் மட்டுமே PIN உள்ளது.",
      pin: "4 இலக்க ஊழியர் PIN",
      addStamp: "ஸ்டாம்பு சேர்",
      adding: "சேர்க்கிறது…",
      today: "இன்று ஏற்கனவே ஸ்டாம்பு சேர்க்கப்பட்டுள்ளது. அடுத்த வருகையில் வாருங்கள்.",
      added: "ஸ்டாம்பு சேர்க்கப்பட்டது!",
      rewardNow: "உங்களுக்கு ஒரு பரிசு கிடைத்துள்ளது!",
      ready: "பரிசு தயார்",
      badPin: (n) => `PIN சரியில்லை. இன்னும் ${n} முயற்சிகள் உள்ளன.`,
      locked: "தவறான PIN அதிகம். 15 நிமிடம் கழித்து முயற்சிக்கவும்.",
      error: "ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.",
      change: "வேறு எண்ணைப் பயன்படுத்து",
      rewardsReady: "பரிசைப் பெற இந்தக் குறியீட்டைக் கவுண்டரில் காட்டுங்கள்.",
    },
  },
  hi: {
    powered: "Skanor द्वारा संचालित",
    language: "भाषा",
    unavailableTitle: "यह पेज उपलब्ध नहीं है",
    unavailableBody: "बिज़नेस ने इसे रोक दिया है या अभी प्रकाशित नहीं किया है।",
    menu: { add: "जोड़ें", soldOut: "ख़त्म", orderWa: "WhatsApp पर ऑर्डर करें", order: (n, t) => `WhatsApp पर ऑर्डर · ${n} आइटम${t ? ` · ${t}` : ""}`, remove: "हटाएँ", nav: "मेन्यू के हिस्से", veg: "शाकाहारी", nonveg: "मांसाहारी", yourOrder: "आपका ऑर्डर" },
    card: { saveContact: "संपर्क सेव करें", call: "कॉल", whatsapp: "WhatsApp", email: "ईमेल", website: "वेबसाइट", office: "ऑफ़िस" },
    lead: { name: "नाम", phone: "WhatsApp नंबर", email: "ईमेल", interest: "मेरी रुचि है", time: "पसंदीदा समय", message: "संदेश", consent: "सबमिट करने पर आप WhatsApp पर संपर्क किए जाने के लिए सहमत हैं।", optIn: "मुझे ऑफ़र भी WhatsApp पर भेजें", thanksTitle: "धन्यवाद!", thanksBody: "आपकी जानकारी मिल गई है। हम जल्द संपर्क करेंगे।", sending: "भेजा जा रहा है…", error: "कुछ गड़बड़ हो गई। कृपया दोबारा कोशिश करें।", required: "कृपया चिह्नित फ़ील्ड भरें।" },
    coupon: {
      offer: "ऑफ़र",
      yourCode: "आपका कोड",
      oneUse: (d) => `एक बार उपयोग · ${d} तक मान्य`,
      phone: "WhatsApp नंबर",
      name: "नाम (वैकल्पिक)",
      optIn: "मुझे और ऑफ़र WhatsApp पर भेजें",
      claim: "यह ऑफ़र पाएँ",
      claiming: "पाया जा रहा है…",
      copy: "कोड कॉपी करें",
      copied: "कोड कॉपी हो गया",
      sendWa: "मेरे WhatsApp पर भेजें",
      redeemNote: "काउंटर पर यह कोड दिखाएँ। स्टाफ इसे दर्ज करके रिडीम करेगा।",
      ended: "यह ऑफ़र समाप्त हो गया है।",
      paused: "यह ऑफ़र अभी रुका हुआ है।",
      notStarted: "यह ऑफ़र अभी शुरू नहीं हुआ है।",
      soldOut: "ये सभी ऑफ़र ले लिए गए हैं।",
      already: "आप यह ऑफ़र पहले ही ले चुके हैं। यह रहा आपका कोड।",
      error: "कुछ गड़बड़ हो गई। कृपया दोबारा कोशिश करें।",
      used: "यह कोड इस्तेमाल हो चुका है।",
    },
    loyalty: {
      joinTitle: "जुड़ें और स्टैम्प जमा करें",
      joinSub: "अपना कार्ड शुरू करने के लिए नंबर डालें।",
      name: "नाम (वैकल्पिक)",
      phone: "WhatsApp नंबर",
      optIn: "मुझे ऑफ़र WhatsApp पर भेजें",
      join: "मेरा कार्ड पाएँ",
      joining: "एक पल…",
      of: (n, m) => `${n} / ${m}`,
      more: (n, r) => `${r} के लिए ${n} विज़िट और`,
      howTitle: "यह कैसे काम करता है",
      howBody: "बिलिंग पर यह कार्ड दिखाएँ। कैशियर अपने PIN से स्टैम्प जोड़ेगा।",
      staffTitle: "स्टाफ: स्टैम्प जोड़ें",
      staffBody: "PIN सिर्फ़ आपकी टीम के पास है।",
      pin: "4 अंकों का स्टाफ PIN",
      addStamp: "स्टैम्प जोड़ें",
      adding: "जोड़ा जा रहा है…",
      today: "आज स्टैम्प पहले ही जोड़ा जा चुका है। अगली विज़िट पर आइए।",
      added: "स्टैम्प जुड़ गया!",
      rewardNow: "आपने इनाम कमाया!",
      ready: "इनाम तैयार",
      badPin: (n) => `PIN सही नहीं है। ${n} कोशिशें बाकी हैं।`,
      locked: "बहुत ज़्यादा गलत PIN। 15 मिनट बाद कोशिश करें।",
      error: "कुछ गड़बड़ हो गई। कृपया दोबारा कोशिश करें।",
      change: "दूसरा नंबर इस्तेमाल करें",
      rewardsReady: "इनाम पाने के लिए काउंटर पर यह कोड दिखाएँ।",
    },
  },
};

export const LOCALE: Record<Lang, string> = { en: "en-IN", ta: "ta-IN", hi: "hi-IN" };
export const fmtDate = (lang: Lang, iso: string) => new Date(iso).toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short" });
export { isLang };
