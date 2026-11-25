/**
 * Customer-facing copy for the rating page in English, Tamil and Hindi, plus the suggested-review
 * text builder. Pure TypeScript, shared by the page and the Reviews settings.
 *
 * NOTE: the Tamil and Hindi wording is a first translation and should be reviewed by a native
 * speaker before launch.
 */

export type Lang = "en" | "ta" | "hi";
export const LANGS: { key: Lang; native: string; english: string }[] = [
  { key: "en", native: "English", english: "English" },
  { key: "ta", native: "தமிழ்", english: "Tamil" },
  { key: "hi", native: "हिन्दी", english: "Hindi" },
];
export const isLang = (v: unknown): v is Lang => v === "en" || v === "ta" || v === "hi";

export const DEFAULT_QUESTION = "How was your visit today?";
export const DEFAULT_CHIPS = ["Food", "Service", "Ambience", "Price", "Staff"];

/** Reasons offered when someone rates 1–3. Keys are stored; labels are translated for display. */
export const ISSUE_KEYS = ["wait", "food", "clean", "staff", "price", "other"] as const;
export type IssueKey = (typeof ISSUE_KEYS)[number];

type Strings = {
  question: string;
  tapStar: string;
  stars: (n: number) => string;
  powered: string;
  language: string;
  lovedTitle: string;
  lovedSub: string;
  suggested: string;
  edit: string;
  done: string;
  another: string;
  copyPost: string;
  copyNote: string;
  copied: string;
  sorryTitle: string;
  sorrySub: string;
  issues: Record<IssueKey, string>;
  whatWrong: string;
  phone: string;
  phoneNote: string;
  sendManager: string;
  postGoogle: string;
  bothAvailable: string;
  thanksTitle: string;
  thanksSub: string;
  back: string;
  sending: string;
  error: string;
  unavailableTitle: string;
  unavailableBody: string;
  demoNote: string;
  chipLabels: Record<string, string>;
};

export const T: Record<Lang, Strings> = {
  en: {
    question: DEFAULT_QUESTION,
    tapStar: "Tap a star. It takes 10 seconds.",
    stars: (n) => `${n} of 5 stars`,
    powered: "Powered by Skanor",
    language: "Language",
    lovedTitle: "Glad you loved it!",
    lovedSub: "What did you like? We will help you write a review.",
    suggested: "Suggested text",
    edit: "Edit",
    done: "Done",
    another: "Another suggestion",
    copyPost: "Copy and post on Google",
    copyNote: "Text is copied. You post it on Google in your own words.",
    copied: "Copied to your clipboard",
    sorryTitle: "Sorry we missed the mark",
    sorrySub: "Tell the manager directly. They read every message.",
    issues: { wait: "Wait time", food: "Food", clean: "Cleanliness", staff: "Staff", price: "Price", other: "Something else" },
    whatWrong: "What went wrong?",
    phone: "Phone (optional, for a callback)",
    phoneNote: "We only use your number to call you back about this.",
    sendManager: "Send to the manager",
    postGoogle: "Post a review on Google",
    bothAvailable: "Both options are always available to you.",
    thanksTitle: "Thank you!",
    thanksSub: "We appreciate you taking the time.",
    back: "Back",
    sending: "Sending…",
    error: "Something went wrong. Please try again.",
    unavailableTitle: "This rating page isn't available",
    unavailableBody: "The business has paused it or it hasn't started yet.",
    demoNote: "Demo: nothing you do here is saved or sent.",
    chipLabels: {},
  },
  ta: {
    question: "இன்றைய உங்கள் வருகை எப்படி இருந்தது?",
    tapStar: "ஒரு நட்சத்திரத்தைத் தொடுங்கள். 10 விநாடிகள் போதும்.",
    stars: (n) => `5 இல் ${n} நட்சத்திரங்கள்`,
    powered: "Skanor வழங்குகிறது",
    language: "மொழி",
    lovedTitle: "உங்களுக்குப் பிடித்தது மகிழ்ச்சி!",
    lovedSub: "எது பிடித்தது? விமர்சனம் எழுத நாங்கள் உதவுகிறோம்.",
    suggested: "பரிந்துரைக்கப்பட்ட உரை",
    edit: "திருத்து",
    done: "முடிந்தது",
    another: "வேறு பரிந்துரை",
    copyPost: "நகலெடுத்து Google-ல் பதிவிடுங்கள்",
    copyNote: "உரை நகலெடுக்கப்பட்டது. உங்கள் சொந்த வார்த்தைகளில் Google-ல் பதிவிடுங்கள்.",
    copied: "நகலெடுக்கப்பட்டது",
    sorryTitle: "மன்னிக்கவும், குறை நேர்ந்துவிட்டது",
    sorrySub: "மேலாளரிடம் நேரடியாகச் சொல்லுங்கள். ஒவ்வொரு செய்தியையும் அவர் படிக்கிறார்.",
    issues: { wait: "காத்திருப்பு நேரம்", food: "உணவு", clean: "தூய்மை", staff: "ஊழியர்கள்", price: "விலை", other: "வேறு ஏதாவது" },
    whatWrong: "என்ன தவறு நடந்தது?",
    phone: "தொலைபேசி (விருப்பம், திரும்ப அழைக்க)",
    phoneNote: "இதைப் பற்றி உங்களை அழைக்க மட்டுமே உங்கள் எண்ணைப் பயன்படுத்துவோம்.",
    sendManager: "மேலாளருக்கு அனுப்பு",
    postGoogle: "Google-ல் விமர்சனம் பதிவிடுங்கள்",
    bothAvailable: "இரண்டு வழிகளும் எப்போதும் உங்களுக்குக் கிடைக்கும்.",
    thanksTitle: "நன்றி!",
    thanksSub: "நேரம் ஒதுக்கியதற்கு நன்றி.",
    back: "பின்செல்",
    sending: "அனுப்புகிறது…",
    error: "ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.",
    unavailableTitle: "இந்த மதிப்பீட்டுப் பக்கம் கிடைக்கவில்லை",
    unavailableBody: "வணிகம் இதை இடைநிறுத்தியுள்ளது அல்லது இன்னும் தொடங்கவில்லை.",
    demoNote: "டெமோ: இங்கே நீங்கள் செய்வது எதுவும் சேமிக்கப்படாது, அனுப்பப்படாது.",
    chipLabels: { Food: "உணவு", Service: "சேவை", Ambience: "சூழல்", Price: "விலை", Staff: "ஊழியர்கள்" },
  },
  hi: {
    question: "आज आपकी विज़िट कैसी रही?",
    tapStar: "एक स्टार दबाइए। बस 10 सेकंड लगेंगे।",
    stars: (n) => `5 में से ${n} स्टार`,
    powered: "Skanor द्वारा संचालित",
    language: "भाषा",
    lovedTitle: "खुशी हुई कि आपको पसंद आया!",
    lovedSub: "आपको क्या अच्छा लगा? हम रिव्यू लिखने में मदद करेंगे।",
    suggested: "सुझाया गया टेक्स्ट",
    edit: "बदलें",
    done: "हो गया",
    another: "दूसरा सुझाव",
    copyPost: "कॉपी करें और Google पर पोस्ट करें",
    copyNote: "टेक्स्ट कॉपी हो गया है। आप इसे अपने शब्दों में Google पर पोस्ट करें।",
    copied: "क्लिपबोर्ड पर कॉपी हो गया",
    sorryTitle: "माफ़ कीजिए, हम चूक गए",
    sorrySub: "मैनेजर को सीधे बताइए। वे हर संदेश पढ़ते हैं।",
    issues: { wait: "इंतज़ार का समय", food: "खाना", clean: "साफ़-सफ़ाई", staff: "स्टाफ", price: "कीमत", other: "कुछ और" },
    whatWrong: "क्या गड़बड़ हुई?",
    phone: "फ़ोन (वैकल्पिक, वापस कॉल के लिए)",
    phoneNote: "आपका नंबर सिर्फ़ इस बारे में कॉल करने के लिए इस्तेमाल होगा।",
    sendManager: "मैनेजर को भेजें",
    postGoogle: "Google पर रिव्यू पोस्ट करें",
    bothAvailable: "दोनों विकल्प हमेशा आपके पास हैं।",
    thanksTitle: "धन्यवाद!",
    thanksSub: "समय निकालने के लिए शुक्रिया।",
    back: "वापस",
    sending: "भेजा जा रहा है…",
    error: "कुछ गड़बड़ हो गई। कृपया दोबारा कोशिश करें।",
    unavailableTitle: "यह रेटिंग पेज उपलब्ध नहीं है",
    unavailableBody: "बिज़नेस ने इसे रोक दिया है या यह अभी शुरू नहीं हुआ है।",
    demoNote: "डेमो: यहाँ आप जो भी करेंगे वह सेव या भेजा नहीं जाएगा।",
    chipLabels: { Food: "खाना", Service: "सेवा", Ambience: "माहौल", Price: "कीमत", Staff: "स्टाफ" },
  },
};

/** The question to show: the translated default, or the business's own wording unchanged. */
export function questionFor(lang: Lang, custom: string): string {
  return !custom || custom.trim() === DEFAULT_QUESTION ? T[lang].question : custom;
}

/** Chip label: translated for the five default chips, otherwise as the business typed it. */
export const chipLabel = (lang: Lang, chip: string) => T[lang].chipLabels[chip] ?? chip;

/** Which language to open in, from the Accept-Language header, limited to the enabled ones. */
export function pickLang(accept: string | null, enabled: Lang[], requested?: string | null): Lang {
  if (isLang(requested) && enabled.includes(requested)) return requested;
  for (const part of (accept ?? "").split(",")) {
    const code = part.trim().toLowerCase().split(/[-;]/)[0];
    if (isLang(code) && enabled.includes(code)) return code;
  }
  return enabled.includes("en") ? "en" : (enabled[0] ?? "en");
}

/* ---------- suggested review text ---------- */

type Pack = {
  openers4: string[];
  openers5: string[];
  chip: Record<string, string>;
  custom: (label: string) => string;
  join: (parts: string[]) => string;
  staff: (name: string) => string;
  closers: string[];
};

const PACKS: Record<Lang, Pack> = {
  en: {
    openers4: ["Good experience at {biz}.", "Had a nice time at {biz}.", "A good visit to {biz}."],
    openers5: ["Loved our visit to {biz}!", "Had a great time at {biz}.", "Really enjoyed {biz}."],
    chip: {
      Food: "the food was great",
      Service: "the service was quick and friendly",
      Ambience: "lovely ambience",
      Price: "good value for money",
      Staff: "the staff were very helpful",
    },
    custom: (l) => `${l.toLowerCase()} was great`,
    join: (p) => (p.length > 1 ? `${p.slice(0, -1).join(", ")} and ${p[p.length - 1]}` : p[0]),
    staff: (n) => `Special thanks to ${n}.`,
    closers: ["Would happily come back.", "Highly recommended.", "Will visit again."],
  },
  hi: {
    openers4: ["{biz} में हमारा अनुभव अच्छा रहा।", "{biz} में अच्छा समय बीता।"],
    openers5: ["{biz} में हमारा अनुभव बहुत अच्छा रहा!", "{biz} में बहुत अच्छा समय बीता।", "हमें {biz} बहुत पसंद आया।"],
    chip: {
      Food: "खाना स्वादिष्ट था",
      Service: "सेवा तेज़ और मिलनसार थी",
      Ambience: "माहौल बहुत अच्छा था",
      Price: "कीमत उचित थी",
      Staff: "स्टाफ बहुत मददगार था",
    },
    custom: (l) => `${l} बहुत अच्छा था`,
    join: (p) => p.join(", "),
    staff: (n) => `${n} का विशेष धन्यवाद।`,
    closers: ["हम दोबारा ज़रूर आएंगे।", "सभी को सुझाव देंगे।", "फिर आना चाहेंगे।"],
  },
  ta: {
    openers4: ["{biz}-ல் எங்கள் அனுபவம் நன்றாக இருந்தது.", "{biz}-ல் நல்ல நேரம் கழிந்தது."],
    openers5: ["{biz}-ல் எங்கள் அனுபவம் மிகவும் நன்றாக இருந்தது!", "{biz}-ல் அருமையான நேரம் கழிந்தது.", "{biz} எங்களுக்கு மிகவும் பிடித்தது."],
    chip: {
      Food: "உணவு சுவையாக இருந்தது",
      Service: "சேவை விரைவாகவும் நட்புடனும் இருந்தது",
      Ambience: "சூழல் அருமையாக இருந்தது",
      Price: "விலை நியாயமாக இருந்தது",
      Staff: "ஊழியர்கள் மிகவும் உதவியாக இருந்தனர்",
    },
    custom: (l) => `${l} மிகவும் நன்றாக இருந்தது`,
    join: (p) => p.join(", "),
    staff: (n) => `${n}-க்குச் சிறப்பு நன்றி.`,
    closers: ["மீண்டும் நிச்சயம் வருவோம்.", "அனைவருக்கும் பரிந்துரைக்கிறோம்.", "மறுபடியும் வர விரும்புகிறோம்."],
  },
};

/**
 * Builds a draft review from what the customer tapped. This is template text, not AI: wording varies
 * with `seed` so many customers don't post identical sentences. The customer can edit freely.
 */
export function suggestReview(o: { lang: Lang; rating: number; chips: string[]; business: string; staff?: string; seed?: number }): string {
  const pack = PACKS[o.lang];
  const seed = o.seed ?? 0;
  const pick = <T,>(arr: T[], salt: number) => arr[(seed + salt) % arr.length];
  const openers = o.rating >= 5 ? pack.openers5 : pack.openers4;
  const opener = pick(openers, 0).replace("{biz}", o.business || "this place");
  const parts = o.chips.slice(0, 4).map((c) => pack.chip[c] ?? pack.custom(c));
  const body = parts.length ? pack.join(parts) : "";
  const sentence = body ? (o.lang === "en" ? `${body.charAt(0).toUpperCase()}${body.slice(1)}.` : o.lang === "hi" ? `${body}।` : `${body}.`) : "";
  const staff = o.staff ? ` ${pack.staff(o.staff)}` : "";
  return `${opener}${sentence ? ` ${sentence}` : ""}${staff} ${pick(pack.closers, 1)}`.trim();
}
