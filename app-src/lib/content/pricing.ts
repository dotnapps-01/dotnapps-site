// Copy and sample data from design/Pricing.dc.html. Placeholders such as [₹ PRICE] and [00]% are intentional.

export const plans = [
  {
    "n": "FREE",
    "p": "₹0",
    "per": "forever",
    "d": "For trying Skanor at one location.",
    "cta": "Start free",
    "pop": false,
    "f": [
      "3 dynamic + unlimited static QR",
      "All basic QR types",
      "Logo & colour designer",
      "30-day scan analytics"
    ],
    "primary": false,
    "href": "/signup",
    "highlight": false
  },
  {
    "n": "STARTER",
    "p": "[₹ PRICE]",
    "per": "/location/mo",
    "d": "For shops that want reviews and leads.",
    "cta": "Start 14-day trial",
    "pop": false,
    "f": [
      "25 dynamic QR",
      "Review Assistant + private feedback",
      "Digital cards & link-in-bio",
      "Menu & lead forms",
      "1 team member"
    ],
    "primary": false,
    "href": "/signup",
    "highlight": false
  },
  {
    "n": "GROWTH",
    "p": "[₹ PRICE]",
    "per": "/location/mo",
    "d": "For businesses building repeat customers.",
    "cta": "Start 14-day trial",
    "pop": true,
    "f": [
      "100 dynamic QR",
      "Everything in Starter",
      "Loyalty, coupons, digital bills",
      "Tickets & bulk QR",
      "5 team members & roles"
    ],
    "primary": true,
    "href": "/signup",
    "highlight": true
  },
  {
    "n": "BUSINESS",
    "p": "[₹ PRICE]",
    "per": "/location/mo",
    "d": "For multi-branch operations.",
    "cta": "Start 14-day trial",
    "pop": false,
    "f": [
      "Unlimited dynamic QR",
      "Assets, attendance, bookings, plots",
      "AI insights & replies",
      "Integrations & smart redirects",
      "Unlimited team"
    ],
    "primary": false,
    "href": "/signup",
    "highlight": false
  },
  {
    "n": "ENTERPRISE",
    "p": "Custom",
    "per": "",
    "d": "For brands, manufacturers and agencies.",
    "cta": "Talk to sales",
    "pop": false,
    "f": [
      "Serialized product QR",
      "Warranty & authenticity",
      "API, webhooks, SSO",
      "White-label & custom domain",
      "Dedicated success manager"
    ],
    "primary": false,
    "href": "/contact",
    "highlight": false
  }
];

export const planColumns = [
  "Free",
  "Starter",
  "Growth",
  "Business",
  "Enterprise"
];

export const compareRows = [
  {
    "group": "BASIC"
  },
  {
    "label": "Dynamic QR codes",
    "values": [
      {
        "kind": "text",
        "text": "3"
      },
      {
        "kind": "text",
        "text": "25"
      },
      {
        "kind": "text",
        "text": "100"
      },
      {
        "kind": "text",
        "text": "Unlimited"
      },
      {
        "kind": "text",
        "text": "Unlimited"
      }
    ]
  },
  {
    "label": "QR types, designer & downloads",
    "values": [
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "label": "Scan analytics history",
    "values": [
      {
        "kind": "text",
        "text": "30 days"
      },
      {
        "kind": "text",
        "text": "1 year"
      },
      {
        "kind": "text",
        "text": "2 years"
      },
      {
        "kind": "text",
        "text": "Unlimited"
      },
      {
        "kind": "text",
        "text": "Unlimited"
      }
    ]
  },
  {
    "group": "GROWTH"
  },
  {
    "label": "Review Assistant & private feedback",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "label": "Digital cards, link-in-bio, menu",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "label": "Lead forms",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "label": "Coupons, loyalty & digital bills",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "group": "PRO"
  },
  {
    "label": "Tickets with SLA",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "label": "Bulk QR from CSV",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "label": "Asset service logs",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "label": "Attendance & visitor passes",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "label": "Bookings & event check-in",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "label": "Real estate plots",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "group": "ADVANCED"
  },
  {
    "label": "AI insights & reply drafts",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "label": "Smart redirects & A/B",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "label": "Integrations",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "text",
        "text": "Basic"
      },
      {
        "kind": "yes",
        "text": "✓"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "label": "Serialized product QR & warranty",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "text",
        "text": "Add-on"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "label": "API, webhooks & SSO",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "label": "White-label & custom domain",
    "values": [
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "no",
        "text": "—"
      },
      {
        "kind": "yes",
        "text": "✓"
      }
    ]
  },
  {
    "group": "TEAM & SUPPORT"
  },
  {
    "label": "Team members",
    "values": [
      {
        "kind": "text",
        "text": "1"
      },
      {
        "kind": "text",
        "text": "1"
      },
      {
        "kind": "text",
        "text": "5"
      },
      {
        "kind": "text",
        "text": "Unlimited"
      },
      {
        "kind": "text",
        "text": "Unlimited"
      }
    ]
  },
  {
    "label": "Support",
    "values": [
      {
        "kind": "text",
        "text": "Help centre"
      },
      {
        "kind": "text",
        "text": "Email"
      },
      {
        "kind": "text",
        "text": "Email + chat"
      },
      {
        "kind": "text",
        "text": "Priority"
      },
      {
        "kind": "text",
        "text": "Dedicated"
      }
    ]
  }
];

export const addons = [
  {
    "t": "Product QR codes",
    "p": "[₹ PRICE] / 1,000 codes",
    "d": "Serialized codes with warranty and authenticity pages."
  },
  {
    "t": "Extra location",
    "p": "[₹ PRICE] / mo",
    "d": "Add a branch to any paid plan."
  },
  {
    "t": "WhatsApp messages",
    "p": "[₹ PRICE] / 1,000",
    "d": "Bills, offers and alerts sent from your number."
  },
  {
    "t": "Print shop",
    "p": "From [₹ PRICE]",
    "d": "Stickers, table tents and standees delivered."
  }
];

export const billingFaqs = [
  {
    "q": "What happens to my QR codes if I downgrade?",
    "a": "Static codes keep working forever. Dynamic codes above your new limit are paused, never deleted — upgrade again to resume them."
  },
  {
    "q": "Do you charge per scan?",
    "a": "No. Scans are unlimited on every plan."
  },
  {
    "q": "Can I pay yearly?",
    "a": "Yes — yearly billing gives you two months free."
  },
  {
    "q": "Which payment methods do you accept?",
    "a": "UPI, cards, net banking and bank transfer for annual plans."
  }
];
