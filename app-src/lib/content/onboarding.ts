// Options from design/Onboarding.dc.html (steps 2 and 3).

export const industryOptions = [
  {
    "key": "retail",
    "label": "Retail shop",
    "icon": "M3 9l2-5h14l2 5M3 9h18v2a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-6 0zM5 13v8h14v-8"
  },
  {
    "key": "food",
    "label": "Restaurant / café",
    "icon": "M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 3c-2 0-3 3-3 6s1 3 3 3v9"
  },
  {
    "key": "salon",
    "label": "Salon / spa",
    "icon": "M6 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM8.5 7.5L20 19M8.5 16.5L20 5"
  },
  {
    "key": "clinic",
    "label": "Clinic / hospital",
    "icon": "M4 21V5h16v16M9 21v-5h6v5M12 8v5M9.5 10.5h5"
  },
  {
    "key": "hotel",
    "label": "Hotel",
    "icon": "M3 20V8h18v12M3 14h18M12 4v4"
  },
  {
    "key": "re",
    "label": "Real estate",
    "icon": "M3 11l9-7 9 7v9H3zM9 20v-6h6v6"
  },
  {
    "key": "mfg",
    "label": "Manufacturer / D2C",
    "icon": "M3 21V10l6 4V10l6 4V6l6 3v12z"
  },
  {
    "key": "fac",
    "label": "Facility / apartment",
    "icon": "M5 21V3h10v18M15 9h4v12M8 7h4M8 11h4M8 15h4"
  },
  {
    "key": "con",
    "label": "Construction",
    "icon": "M3 18h18M5 18v-3a7 7 0 0114 0v3M10 8V5h4v3"
  },
  {
    "key": "evt",
    "label": "Events / education",
    "icon": "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"
  }
] as const;

export const goalOptions = [
  {
    "key": "reviews",
    "label": "Get more Google reviews",
    "level": "GROWTH"
  },
  {
    "key": "menu",
    "label": "Digital menu / catalogue",
    "level": "GROWTH"
  },
  {
    "key": "leads",
    "label": "Collect leads",
    "level": "GROWTH"
  },
  {
    "key": "loyalty",
    "label": "Loyalty stamp card",
    "level": "GROWTH"
  },
  {
    "key": "offers",
    "label": "Coupons & offers",
    "level": "GROWTH"
  },
  {
    "key": "bills",
    "label": "Digital bills on WhatsApp",
    "level": "GROWTH"
  },
  {
    "key": "tickets",
    "label": "Complaints → tickets",
    "level": "PRO"
  },
  {
    "key": "attendance",
    "label": "Staff attendance",
    "level": "PRO"
  },
  {
    "key": "bookings",
    "label": "Bookings & appointments",
    "level": "PRO"
  },
  {
    "key": "wifi",
    "label": "Wi-Fi & payments QR",
    "level": "BASIC"
  }
] as const;

export type IndustryKey = (typeof industryOptions)[number]["key"];
export type GoalKey = (typeof goalOptions)[number]["key"];

/** Goals pre-selected after the business type is chosen (from the "modules switched on" lists on /industries). */
export const recommendedGoals: Record<IndustryKey, GoalKey[]> = {
  retail: ["reviews", "loyalty", "bills"],
  food: ["reviews", "menu"],
  salon: ["reviews", "bookings", "loyalty"],
  clinic: ["reviews", "tickets", "bookings"],
  hotel: ["reviews", "tickets", "wifi"],
  re: ["leads", "bookings"],
  mfg: ["leads", "tickets"],
  fac: ["tickets"],
  con: ["attendance"],
  evt: ["bookings", "leads"],
};

export const onboardingSteps = ["Verify", "Business", "Goals", "Location", "Live"] as const;
