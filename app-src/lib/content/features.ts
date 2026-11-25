// Copy and sample data from design/Features.dc.html. Placeholders such as [₹ PRICE] and [00]% are intentional.

export const qrTypes = [
  "Website URL",
  "WhatsApp chat",
  "UPI payment",
  "Wi-Fi login",
  "Google Maps",
  "PDF",
  "Image gallery",
  "Video",
  "Contact (vCard)",
  "Email",
  "SMS",
  "Phone call",
  "App download",
  "Social links",
  "Plain text",
  "Event (calendar)"
];

export const featureLevels = [
  {
    "id": "basic",
    "n": "01",
    "name": "Basic",
    "plan": "FREE",
    "tag": "Make, design and track QR codes.",
    "showTypes": true,
    "mods": [
      {
        "ic": "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z",
        "t": "Dynamic QR codes",
        "d": "Change where a printed code points, any time.",
        "b": [
          "Edit, pause or expire",
          "Schedule start and end dates",
          "Short link for every code"
        ]
      },
      {
        "ic": "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
        "t": "QR designer",
        "d": "Make codes that look like your brand.",
        "b": [
          "Logo, colours, dot & eye styles",
          "Frames with “Scan me” labels",
          "Saved brand kit"
        ]
      },
      {
        "ic": "M12 3v12M6 9l6 6 6-6M4 21h16",
        "t": "Downloads",
        "d": "Files ready for any printer.",
        "b": [
          "PNG, SVG, EPS, print PDF",
          "Sticker, table-tent & standee sizes",
          "Scan-test before you print"
        ]
      },
      {
        "ic": "M4 20V10M10 20V4M16 20v-7M22 20H2",
        "t": "Scan analytics",
        "d": "See how every code performs.",
        "b": [
          "Scans by day, city and device",
          "Unique vs repeat scans",
          "Weekly email report"
        ]
      }
    ],
    "highlight": false
  },
  {
    "id": "growth",
    "n": "02",
    "name": "Growth",
    "plan": "STARTER",
    "tag": "Turn scans into customers who come back.",
    "showTypes": false,
    "mods": [
      {
        "ic": "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
        "t": "Review Assistant",
        "d": "More Google reviews from happy customers.",
        "b": [
          "One-tap rating page",
          "AI review suggestions in 8 languages",
          "QR per table, counter or staff"
        ]
      },
      {
        "ic": "M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.2A8 8 0 1121 12z",
        "t": "Private feedback",
        "d": "A direct line to the manager, alongside Google.",
        "b": [
          "Instant WhatsApp alert",
          "Turns into a ticket on Pro",
          "Customer gets a reply"
        ]
      },
      {
        "ic": "M3 5h18v14H3zM7 9h4M7 13h6M15 9h2v4h-2z",
        "t": "Digital business card",
        "d": "Tap-to-save contact pages for every staff member.",
        "b": [
          "Save to contacts in one tap",
          "WhatsApp, call, email, map",
          "Team cards managed centrally"
        ]
      },
      {
        "ic": "M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1",
        "t": "Link-in-bio page",
        "d": "One page with all your links, offers and socials.",
        "b": [
          "Drag-and-drop blocks",
          "Your colours and logo",
          "Click tracking"
        ]
      },
      {
        "ic": "M4 5h16M4 12h16M4 19h10",
        "t": "Menu & catalogue",
        "d": "A menu or price list you can update in seconds.",
        "b": [
          "Categories, photos, veg tags",
          "Mark items sold out",
          "Order on WhatsApp"
        ]
      },
      {
        "ic": "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
        "t": "Lead capture forms",
        "d": "Collect enquiries straight from a scan.",
        "b": [
          "Custom fields & consent",
          "Leads to WhatsApp and inbox",
          "Export to CRM"
        ]
      },
      {
        "ic": "M3 12V4h8l10 10-8 8zM7.5 7.5h.01",
        "t": "Coupons & offers",
        "d": "Scan-to-claim offers with redemption control.",
        "b": [
          "Limits per customer",
          "Staff redeem by code",
          "Expiry & schedule"
        ]
      },
      {
        "ic": "M12 21a9 9 0 100-18 9 9 0 000 18zM8 12l3 3 5-6",
        "t": "Loyalty stamp card",
        "d": "Digital stamp cards — no app, no paper.",
        "b": [
          "Scan per visit, reward at N",
          "Anti-fraud staff PIN",
          "Win-back messages"
        ]
      },
      {
        "ic": "M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4",
        "t": "Digital bills",
        "d": "Send the bill on WhatsApp and build your customer list.",
        "b": [
          "Scan at counter to receive bill",
          "Opt-in for offers",
          "Links to loyalty"
        ]
      }
    ],
    "highlight": false
  },
  {
    "id": "pro",
    "n": "03",
    "name": "Pro",
    "plan": "GROWTH",
    "tag": "Run daily operations from a scan.",
    "showTypes": false,
    "mods": [
      {
        "ic": "M4 7h16v4a2 2 0 000 4v4H4v-4a2 2 0 000-4z",
        "t": "Tickets with SLA",
        "d": "Complaints become tracked tasks.",
        "b": [
          "Auto-assign by location & type",
          "SLA timers and escalation",
          "Customer updates on WhatsApp"
        ]
      },
      {
        "ic": "M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z",
        "t": "Asset service logs",
        "d": "A QR on every AC, lift, genset or RO unit.",
        "b": [
          "Scan to raise a complaint",
          "Technician logs each visit",
          "AMC due-date reminders"
        ]
      },
      {
        "ic": "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
        "t": "Attendance",
        "d": "Staff and labour check-in at the site QR.",
        "b": [
          "Selfie + location check",
          "Shifts, overtime, leave",
          "Payroll export"
        ]
      },
      {
        "ic": "M4 4h16v16H4zM9 9a3 3 0 106 0 3 3 0 00-6 0M7 18a5 5 0 0110 0",
        "t": "Visitor passes",
        "d": "Visitors register at the gate in seconds.",
        "b": [
          "Host approval on WhatsApp",
          "Digital pass with QR",
          "Visitor log & export"
        ]
      },
      {
        "ic": "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
        "t": "Bookings & events",
        "d": "Appointments, site visits and event entry.",
        "b": [
          "Slots, staff & reminders",
          "QR tickets & gate scanning",
          "No-show tracking"
        ]
      },
      {
        "ic": "M3 11l9-7 9 7v9H3zM9 20v-6h6v6",
        "t": "Real estate plots",
        "d": "A QR on every plot stone in your layout.",
        "b": [
          "Live availability & price",
          "Brochure and plan PDF",
          "Site-visit booking"
        ]
      },
      {
        "ic": "M12 21V9M6 15l6-6 6 6M4 3h16",
        "t": "Bulk QR from CSV",
        "d": "Generate hundreds of unique codes at once.",
        "b": [
          "Upload rows, get codes",
          "Variable data per code",
          "ZIP or print sheet"
        ]
      },
      {
        "ic": "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M16 3.5a4 4 0 010 7.5M22 21a7 7 0 00-4-6.3",
        "t": "Multi-location & roles",
        "d": "One account for every branch and team.",
        "b": [
          "Branch-wise dashboards",
          "Owner, manager, staff roles",
          "Activity log"
        ]
      },
      {
        "ic": "M6 9V3h12v6M6 18H3v-8h18v8h-3M6 14h12v7H6z",
        "t": "Print shop",
        "d": "Order stickers, table tents and standees.",
        "b": [
          "Print-ready templates",
          "Delivered to your door",
          "Reorder in one click"
        ]
      }
    ],
    "highlight": false
  },
  {
    "id": "advanced",
    "n": "04",
    "name": "Advanced",
    "plan": "BUSINESS",
    "tag": "Scale across products, brands and systems.",
    "showTypes": false,
    "mods": [
      {
        "ic": "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10",
        "t": "Serialized product QR",
        "d": "A unique code on every unit you make.",
        "b": [
          "Batch & serial management",
          "Print files for packaging lines",
          "Product hub page"
        ]
      },
      {
        "ic": "M3 5h18v14H3zM7 9h4M7 13h6M15 9h2v4h-2z",
        "t": "Warranty registration",
        "d": "Replace paper warranty cards.",
        "b": [
          "Invoice photo upload",
          "Auto warranty end date",
          "Service history per unit"
        ]
      },
      {
        "ic": "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
        "t": "Authenticity checks",
        "d": "Customers verify it’s genuine.",
        "b": [
          "First-scan verification",
          "Duplicate-scan alerts",
          "Counterfeit map"
        ]
      },
      {
        "ic": "M6 3v6a6 6 0 006 6h6M18 15l-3-3M18 15l-3 3M6 21v-6",
        "t": "Smart redirects",
        "d": "One code, different content by context.",
        "b": [
          "By time, city, language, device",
          "A/B test destinations",
          "Scan limits"
        ]
      },
      {
        "ic": "M13 2L4 14h7l-1 8 9-12h-7z",
        "t": "AI insights & replies",
        "d": "Understand feedback without reading it all.",
        "b": [
          "Sentiment & topic summaries",
          "AI-drafted review replies",
          "Rating-drop alerts"
        ]
      },
      {
        "ic": "M8 6l-6 6 6 6M16 6l6 6-6 6",
        "t": "API & webhooks",
        "d": "Create codes and receive scan events in your systems.",
        "b": [
          "REST API & keys",
          "Webhooks for every event",
          "Sandbox"
        ]
      },
      {
        "ic": "M9 2v6M15 2v6M6 8h12v4a6 6 0 01-12 0zM12 18v4",
        "t": "Integrations",
        "d": "Connect the tools you already use.",
        "b": [
          "Google Business, WhatsApp",
          "Shopify, Zoho, Tally",
          "Orkha by Dotnapps"
        ]
      },
      {
        "ic": "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18",
        "t": "White-label & domain",
        "d": "Agencies resell Skanor as their own.",
        "b": [
          "Your logo and colours",
          "scan.yourbrand.com",
          "Client workspaces"
        ]
      },
      {
        "ic": "M5 11h14v10H5zM8 11V7a4 4 0 018 0v4",
        "t": "Security & compliance",
        "d": "Controls for larger teams.",
        "b": [
          "Password & expiring QR",
          "SSO and audit log",
          "Data export & deletion"
        ]
      }
    ],
    "highlight": true
  }
];
