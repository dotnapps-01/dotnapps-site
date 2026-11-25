// Copy and sample data from design/ModuleReviews.dc.html. Placeholders such as [₹ PRICE] and [00]% are intentional.

export const reviewLikes = [
  {
    "t": "Food",
    "on": true
  },
  {
    "t": "Service",
    "on": true
  },
  {
    "t": "Ambience",
    "on": false
  },
  {
    "t": "Price",
    "on": false
  },
  {
    "t": "Staff",
    "on": true
  }
];

export const reviewProblems = [
  {
    "n": "01",
    "a": "Happy customers rarely leave reviews — they just leave.",
    "b": "A one-tap prompt with AI-suggested words makes posting effortless."
  },
  {
    "n": "02",
    "a": "Unhappy customers go straight to Google with 1 star.",
    "b": "They also get a direct line to the manager, who can fix it today."
  },
  {
    "n": "03",
    "a": "Reviews are spread across branches with no owner.",
    "b": "One inbox, per-location targets, and staff-wise QR codes."
  }
];

export const reviewFlow = [
  {
    "n": "STEP 1",
    "t": "Scan",
    "d": "Table, counter, bill or staff QR",
    "arrow": true
  },
  {
    "n": "STEP 2",
    "t": "Rate",
    "d": "One tap, 1–5 stars, pick what they liked",
    "arrow": true
  },
  {
    "n": "STEP 3",
    "t": "Post on Google",
    "d": "Shown to everyone, with AI suggestion",
    "arrow": true
  },
  {
    "n": "ALSO",
    "t": "Tell the manager",
    "d": "Private note → WhatsApp alert → ticket",
    "arrow": false
  }
];

export const reviewFeatures = [
  {
    "n": "01",
    "t": "Staff-wise QR codes",
    "d": "See which team member earns the best reviews."
  },
  {
    "n": "02",
    "t": "AI review suggestions",
    "d": "Drafted from tapped chips, in English, Tamil, Hindi, Telugu, Kannada, Malayalam and more."
  },
  {
    "n": "03",
    "t": "Google review inbox",
    "d": "Read and reply to all reviews across locations."
  },
  {
    "n": "04",
    "t": "AI reply drafts",
    "d": "Polite, on-brand replies you approve with one click."
  },
  {
    "n": "05",
    "t": "Private feedback alerts",
    "d": "Manager gets WhatsApp alerts with the customer’s number."
  },
  {
    "n": "06",
    "t": "Review targets & leaderboard",
    "d": "Monthly goals per branch and staff."
  },
  {
    "n": "07",
    "t": "Review widgets",
    "d": "Show your best reviews on your website."
  },
  {
    "n": "08",
    "t": "NFC tap cards",
    "d": "Pair the QR with an NFC card at the counter."
  }
];

export const reviewSteps = [
  {
    "n": "01",
    "t": "Connect Google Business Profile",
    "d": "Sign in with Google — we find your locations."
  },
  {
    "n": "02",
    "t": "Customise the rating page",
    "d": "Logo, questions, languages and chips."
  },
  {
    "n": "03",
    "t": "Generate codes",
    "d": "One per table, counter, staff member or invoice."
  },
  {
    "n": "04",
    "t": "Print or order stickers",
    "d": "Download files or order table tents from us."
  }
];

// Hero + closing copy for the module page (design/ModuleReviews.dc.html).
export const reviewModule = {
  slug: "review-assistant",
  breadcrumb: ["Features", "Growth", "Review Assistant"],
  title: "Get the reviews your service deserves.",
  lede: "A one-tap rating page on every table, counter and invoice. Happy customers post to Google in seconds; unhappy ones reach your manager before they reach the internet.",
  demoHref: "/r/demo",
  flowHeading: "Fair to customers. Fair to Google.",
  flowLede:
    "Every customer sees the Google option, whatever they rate. Private feedback is an extra channel, never a filter — so your reviews stay genuine and policy-safe.",
  featuresHeading: "Everything for reputation, in one module",
  setupHeading: "Live in 10 minutes",
  setupLede: "Connect your Google Business Profile, choose where codes go, print. That's it.",
  ctaTitle: "Your next 100 reviews start with one QR.",
};
