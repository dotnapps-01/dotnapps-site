/* Dotnapps staff portal — CRM, modelled on the earlier Dotnapps CRM
   (github.com/dotnapps-01/dotnapps-crm): Leads, Contacts, Companies, Deals on a
   pipeline, Tasks, and an activity timeline on every record. Same fields, same
   statuses and stages, same lead-conversion behaviour. */
(function () {
  "use strict";
  var DN = window.DN, h = DN.h;
  var meId = function () { var m = DN.me(); return m ? m.id : ""; };
  var sum = function (a, f) { return a.reduce(function (s, x) { return s + (+f(x) || 0); }, 0); };
  var go = function (id) { location.href = "/staff/" + id + "/"; };

  var SOURCES = ["Website", "WhatsApp", "Instagram", "Facebook", "Google", "Referral", "Cold call", "Email", "Manual", "Other"];
  var LEAD_STATUS = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost", "Unqualified"];
  var OPEN_LEAD = ["New", "Contacted", "Qualified", "Proposal", "Negotiation"];
  // Default pipeline from the earlier CRM: name, win probability, kind
  var STAGES = [["Qualified", 10, "OPEN"], ["Discovery", 30, "OPEN"], ["Proposal", 60, "OPEN"], ["Negotiation", 80, "OPEN"], ["Won", 100, "WON"], ["Lost", 0, "LOST"]];
  var STAGE_NAMES = STAGES.map(function (s) { return s[0]; });
  var stageOf = function (n) { return STAGES.filter(function (s) { return s[0] === n; })[0] || STAGES[0]; };
  var ACT_TYPES = ["Note", "Call", "Meeting", "Email", "WhatsApp", "Follow-up", "Demo"];

  /* ---------- tags ---------- */
  function normTags(s) {
    var seen = {}, out = [];
    String(s || "").split(",").forEach(function (t) { t = t.trim().slice(0, 30); if (t && !seen[t.toLowerCase()]) { seen[t.toLowerCase()] = 1; out.push(t); } });
    return out.join(", ");
  }
  var hasTag = function (r, t) { return String(r.tags || "").toLowerCase().split(",").map(function (x) { return x.trim(); }).indexOf(t.toLowerCase()) > -1; };
  function allTags() {
    var seen = {};
    ["leads", "contacts", "companies", "deals"].forEach(function (c) { DN.live(c).forEach(function (r) { String(r.tags || "").split(",").forEach(function (t) { t = t.trim(); if (t) seen[t] = 1; }); }); });
    return Object.keys(seen).sort();
  }

  /* ---------- activity timeline ---------- */
  DN.logActivity = function (rel, type, subject, system) {
    return DN.insert("activities", { rel: rel, type: type, subject: subject, by: meId(), ts: Date.now(), system: !!system });
  };
  function timeline(rel) {
    var box = h("div", { class: "tl" });
    function draw() {
      DN.clear(box);
      var type = h("select", { "aria-label": "Activity type" }, ACT_TYPES.map(function (t) { return h("option", { value: t }, t); }));
      var text = h("input", { placeholder: "What happened? e.g. Called, asked for a proposal", maxlength: 300, "aria-label": "Activity" });
      var add = function () {
        var t = text.value.trim(); if (!t) return;
        DN.logActivity(rel, type.value, t, false);
        var pr = rel.split(":"); var rec = DN.get({ lead: "leads", contact: "contacts", company: "companies", deal: "deals" }[pr[0]], pr[1]);
        if (rec) rec.lastActivity = Date.now();
        draw();
      };
      text.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); add(); } });
      box.append(h("h4", null, "Activity"), h("div", { class: "add" }, type, text, h("button", { type: "button", class: "btn sm", onclick: add }, "Log")));
      var evs = DN.live("activities").filter(function (a) { return a.rel === rel; }).sort(function (a, b) { return b.ts - a.ts; });
      if (!evs.length) box.append(h("div", { class: "muted" }, "No activity yet."));
      evs.forEach(function (a) {
        box.append(h("div", { class: "ev" + (a.system ? " sys" : "") }, h("span", { class: "ty" }, a.system ? "System" : a.type),
          h("span", null, a.subject, h("small", null, new Date(a.ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) + (a.by ? " · " + DN.nm(a.by) : "")))));
      });
    }
    draw(); return box;
  }
  var withTimeline = function (rel) { return function (rec) { return timeline(rel + ":" + rec.id); }; };

  var pendingOpening = "";

  /* ---------- LEADS ---------- */
  var leadCfg = {
    id: "leads", col: "leads", noun: "Lead", csvName: "leads", wide: true,
    fields: [
      { k: "name", label: "Name", required: true, list: true },
      { k: "company", label: "Company", list: true },
      { k: "email", label: "Email", type: "email" },
      { k: "phone", label: "Phone", type: "tel" },
      { k: "whatsapp", label: "WhatsApp", type: "tel" },
      { k: "website", label: "Website", type: "url" },
      { k: "source", label: "Source", type: "select", options: SOURCES, required: true, list: true },
      { k: "status", label: "Status", type: "select", options: LEAD_STATUS, required: true, list: true, pill: true },
      { k: "industry", label: "Industry" },
      { k: "location", label: "Location" },
      { k: "value", label: "Estimated value (₹)", type: "money", list: true, hint: "Numbers only, e.g. 50000" },
      { k: "follow", label: "Next follow-up", type: "date", list: true },
      { k: "owner", label: "Owner", ref: "employees", list: true },
      { k: "tags", label: "Tags", list: true, hint: "Comma-separated, e.g. VIP, Hot lead" },
      { k: "opening", label: "Opening note", type: "textarea", createOnly: true, hideInList: true }
    ],
    defaults: function () { return { source: "Manual", status: "New", owner: meId() }; },
    presets: [{ label: "All" }, { label: "Open", test: function (r) { return OPEN_LEAD.indexOf(r.status) > -1; } }, { label: "Mine", test: function (r) { return r.owner === meId(); } },
      { label: "Follow-up due", test: function (r) { return r.follow && r.follow <= DN.today() && OPEN_LEAD.indexOf(r.status) > -1; } }],
    filters: [
      { label: "Status", options: LEAD_STATUS, test: function (r, v) { return r.status === v; } },
      { label: "Sources", options: SOURCES, test: function (r, v) { return r.source === v; } },
      { label: "Owners", options: function () { return DN.empOptions(); }, test: function (r, v) { return r.owner === v; } },
      { label: "Tags", options: allTags, test: function (r, v) { return hasTag(r, v); } }
    ],
    beforeSave: function (r, isNew) {
      r.tags = normTags(r.tags);
      if (r.website && !/^https?:\/\//i.test(r.website)) return "Website must start with http:// or https://";
      pendingOpening = isNew && r.opening ? r.opening : ""; delete r.opening;
    },
    afterSave: function (r, isNew) { if (isNew && pendingOpening) { DN.logActivity("lead:" + r.id, "Note", pendingOpening, false); pendingOpening = ""; } },
    sort: function (a, b) { return b.created - a.created; },
    stats: function (rs) {
      var cut = Date.now() - 30 * 864e5, conv = rs.filter(function (r) { return r.convertedAt; }).length;
      return [{ l: "New in 30 days", v: rs.filter(function (r) { return r.created >= cut; }).length },
        { l: "Open leads", v: rs.filter(function (r) { return OPEN_LEAD.indexOf(r.status) > -1; }).length },
        { l: "Won", v: rs.filter(function (r) { return r.status === "Won"; }).length, tone: "good" },
        { l: "Converted", v: conv },
        { l: "Conversion rate", v: rs.length ? Math.round(conv / rs.length * 100) + "%" : "–" }];
    },
    extra: function (r) {
      var box = h("div");
      if (r.convertedAt) {
        var bits = [r.contactId ? "Contact: " + DN.refName("contacts", r.contactId) : "", r.companyId ? "Company: " + DN.refName("companies", r.companyId) : "", r.dealId ? "Deal: " + DN.refName("deals", r.dealId) : ""].filter(Boolean);
        box.append(h("div", { class: "demo-bar", style: "margin:4px 20px" }, "Converted " + DN.date(DN.iso(new Date(r.convertedAt))) + (bits.length ? ". " + bits.join(" · ") : "")));
      }
      box.append(timeline("lead:" + r.id)); return box;
    },
    actions: [{ label: "Convert lead", when: function (r) { return !r.convertedAt; }, run: function (r, done) { convertDialog(r, done); return true; } }]
  };

  function convertDialog(lead, done) {
    DN.form({ title: "Convert lead: " + lead.name, saveLabel: "Convert", values: { contact: true, company: !!lead.company, deal: true },
      fields: [
        { k: "contact", label: "Create a contact", type: "bool", hint: "Name, email, phone and WhatsApp carry across." },
        { k: "company", label: "Create a company", type: "bool", hint: lead.company ? "A company with the same name is reused, not duplicated." : "This lead has no company name." },
        { k: "deal", label: "Open a deal in the pipeline", type: "bool", hint: "Starts at the first stage with the lead's estimated value." }
      ],
      onSave: function (o) {
        var companyId = "", contactId = "", dealId = "";
        if (o.company && lead.company) {
          var match = DN.live("companies").filter(function (c) { return c.name.toLowerCase() === lead.company.toLowerCase(); })[0];
          companyId = match ? match.id : DN.insert("companies", { name: lead.company, website: lead.website || "", industry: lead.industry || "", owner: lead.owner || "", tags: lead.tags || "", gstin: "", size: "", notes: "", addresses: [] }).id;
        }
        if (o.contact) {
          contactId = DN.insert("contacts", { name: lead.name, title: "", email: lead.email || "", phone: lead.phone || "", whatsapp: lead.whatsapp || "", company: companyId, source: lead.source, owner: lead.owner || "", tags: lead.tags || "", notes: "" }).id;
          DN.col("activities").forEach(function (a) { if (a.rel === "lead:" + lead.id) a.rel = "contact:" + contactId; });   // re-home history
        }
        if (o.deal) {
          var st = STAGES[0];
          var d = DN.insert("deals", { name: (lead.company || lead.name) + " deal", stage: st[0], status: "Open", probability: st[1], company: companyId, contact: contactId, owner: lead.owner || "", value: lead.value || "", currency: "INR", source: lead.source, close: "", tags: lead.tags || "", fromLead: lead.id });
          dealId = d.id; DN.logActivity("deal:" + d.id, "Note", "Deal created from lead", true);
        }
        DN.patch("leads", lead.id, { status: lead.status === "New" || lead.status === "Contacted" ? "Qualified" : lead.status, convertedAt: Date.now(), contactId: contactId, companyId: companyId, dealId: dealId });
        DN.logActivity((contactId ? "contact:" + contactId : "lead:" + lead.id), "Note", "Lead converted" + (dealId ? " and deal opened" : ""), true);
        DN.toast("Lead converted."); if (done) done();
      } });
  }

  /* ---------- CONTACTS ---------- */
  var contactCfg = {
    id: "contacts", col: "contacts", noun: "Contact", csvName: "contacts", wide: true,
    fields: [
      { k: "name", label: "Name", required: true, list: true },
      { k: "title", label: "Job title", list: true },
      { k: "company", label: "Company", ref: "companies", list: true },
      { k: "email", label: "Email", type: "email", list: true },
      { k: "phone", label: "Phone", type: "tel", list: true },
      { k: "whatsapp", label: "WhatsApp", type: "tel" },
      { k: "source", label: "Source", type: "select", options: SOURCES },
      { k: "owner", label: "Owner", ref: "employees", list: true },
      { k: "tags", label: "Tags", hint: "Comma-separated" },
      { k: "notes", label: "Notes", type: "textarea" }
    ],
    defaults: function () { return { owner: meId() }; },
    filters: [{ label: "Owners", options: function () { return DN.empOptions(); }, test: function (r, v) { return r.owner === v; } }, { label: "Tags", options: allTags, test: function (r, v) { return hasTag(r, v); } }],
    beforeSave: function (r) { r.tags = normTags(r.tags); },
    stats: function (rs) { return [{ l: "Contacts", v: rs.length }, { l: "With a company", v: rs.filter(function (r) { return r.company; }).length }, { l: "No owner", v: rs.filter(function (r) { return !r.owner; }).length }]; },
    extra: withTimeline("contact"),
    sort: function (a, b) { return (a.name || "").localeCompare(b.name || ""); }
  };

  /* ---------- COMPANIES ---------- */
  var GSTIN_RE = "[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]";
  var companyCfg = {
    id: "companies", col: "companies", noun: "Company", csvName: "companies", wide: true,
    fields: [
      { k: "name", label: "Company name", required: true, list: true },
      { k: "website", label: "Website", type: "url" },
      { k: "industry", label: "Industry", list: true },
      { k: "size", label: "Size", type: "select", options: ["1-10", "11-50", "51-200", "201-500", "500+"] },
      { k: "gstin", label: "GSTIN", pattern: GSTIN_RE, patternHelp: "15-character GSTIN, e.g. 29ABCDE1234F1Z5", list: true },
      { k: "owner", label: "Owner", ref: "employees", list: true },
      { k: "tags", label: "Tags", hint: "Comma-separated" },
      { k: "notes", label: "Notes", type: "textarea" },
      { k: "addresses", label: "Addresses (billing, shipping, other)", type: "addresses" }
    ],
    defaults: function () { return { owner: meId(), addresses: [] }; },
    filters: [{ label: "Owners", options: function () { return DN.empOptions(); }, test: function (r, v) { return r.owner === v; } }, { label: "Tags", options: allTags, test: function (r, v) { return hasTag(r, v); } }],
    beforeSave: function (r) {
      r.tags = normTags(r.tags); r.gstin = (r.gstin || "").toUpperCase();
      if (r.website && !/^https?:\/\//i.test(r.website)) return "Website must start with http:// or https://";
    },
    sort: function (a, b) { return (a.name || "").localeCompare(b.name || ""); },
    stats: function (rs) { return [{ l: "Companies", v: rs.length }, { l: "With GSTIN", v: rs.filter(function (r) { return r.gstin; }).length }, { l: "Open deals", v: DN.live("deals").filter(function (d) { return d.status === "Open"; }).length }]; },
    extra: function (r) {       // billed / collected / outstanding from Quotations & Invoices
      var docs = DN.live("salesdocs").filter(function (d) { return d.type === "Invoice" && d.status !== "Cancelled" && (d.client || "").toLowerCase() === (r.name || "").toLowerCase(); });
      var tot = function (d) { return DN.linesTotals(d).total; }, billed = sum(docs, tot), paid = sum(docs.filter(function (d) { return d.status === "Paid"; }), tot);
      var box = h("div");
      box.append(h("div", { class: "fin" }, h("div", null, h("b", null, DN.money(billed)), "Billed"), h("div", null, h("b", null, DN.money(paid)), "Collected"), h("div", null, h("b", null, DN.money(billed - paid)), "Outstanding")));
      var cs = DN.live("contacts").filter(function (c) { return c.company === r.id; });
      if (cs.length) box.append(h("div", { class: "tl" }, h("h4", null, "Contacts"), cs.map(function (c) { return h("div", { class: "ev", style: "grid-template-columns:1fr" }, h("span", null, c.name, h("small", null, [c.title, c.email, c.phone].filter(Boolean).join(" · ")))); })));
      box.append(timeline("company:" + r.id)); return box;
    }
  };

  /* ---------- DEALS ---------- */
  function applyStage(d) {
    var st = stageOf(d.stage);
    d.status = st[2] === "WON" ? "Won" : st[2] === "LOST" ? "Lost" : "Open";
    d.closedAt = st[2] === "OPEN" ? "" : (d.closedAt || Date.now());
    if (st[2] === "OPEN") { d.winReason = d.winReason || ""; }
  }
  function quoteFromDeal(d) {
    var party = DN.refName("companies", d.company) || DN.refName("contacts", d.contact) || d.name;
    var gstin = (DN.get("companies", d.company) || {}).gstin || "";
    var doc = { type: "Quotation", client: party, gstin: gstin, date: DN.today(), due: DN.addDays(DN.today(), 15), gst: "18", supply: DN.SAME_STATE,
      lines: [{ d: d.name, q: 1, r: +d.value || 0 }], status: "Draft", notes: "", dealId: d.id };
    doc.no = DN.nextNo("QT-", "salesdocs", "no"); DN.insert("salesdocs", doc);
    DN.logActivity("deal:" + d.id, "Note", "Quotation " + doc.no + " drafted", true);
    DN.toast("Quotation " + doc.no + " created from this deal."); go("sales");
  }
  function closeDeal(d, won, done) {
    DN.form({ title: won ? "Mark won: " + d.name : "Mark lost: " + d.name, saveLabel: won ? "Mark won" : "Mark lost", values: {},
      fields: [{ k: "reason", label: won ? "Why did we win? (optional)" : "Why was it lost? (optional)", type: "textarea", full: true }],
      onSave: function (v) {
        var next = Object.assign({}, d, { stage: won ? "Won" : "Lost" }); applyStage(next); next.probability = stageOf(next.stage)[1];
        next[won ? "winReason" : "lossReason"] = v.reason;
        DN.patch("deals", d.id, next); DN.logActivity("deal:" + d.id, "Note", "Marked " + (won ? "won" : "lost") + (v.reason ? ": " + v.reason : ""), true);
        if (done) done();
      } });
  }
  var dealCfg = {
    id: "deals", col: "deals", noun: "Deal", csvName: "deals", board: "stage", wide: true,
    fields: [
      { k: "name", label: "Deal name", required: true, list: true },
      { k: "stage", label: "Stage", type: "select", options: STAGE_NAMES, required: true, list: true, pill: true },
      { k: "company", label: "Company", ref: "companies", list: true },
      { k: "contact", label: "Contact", ref: "contacts" },
      { k: "owner", label: "Owner", ref: "employees", list: true },
      { k: "value", label: "Value", type: "money", list: true },
      { k: "currency", label: "Currency", type: "select", options: ["INR", "USD"], required: true },
      { k: "probability", label: "Win probability %", type: "number", max: 100, hint: "Set from the stage when the stage changes." },
      { k: "source", label: "Source", type: "select", options: SOURCES },
      { k: "close", label: "Expected close", type: "date", list: true },
      { k: "tags", label: "Tags", hint: "Comma-separated" },
      { k: "winReason", label: "Win reason", hideInList: true },
      { k: "lossReason", label: "Loss reason", hideInList: true }
    ],
    defaults: function () { return { stage: STAGES[0][0], currency: "INR", owner: meId() }; },
    cardTitle: function (r) { return r.name; },
    cardSub: function (r) { return [DN.refName("companies", r.company), r.value ? (r.currency === "USD" ? "$" + Number(r.value).toLocaleString("en-US") : DN.money(r.value)) + (r.probability !== "" && r.probability != null ? " · " + r.probability + "%" : "") : "", r.close ? "Closes " + DN.date(r.close) : "", DN.nm(r.owner)]; },
    presets: [{ label: "All" }, { label: "Open", test: function (r) { return r.status === "Open"; } }, { label: "Mine", test: function (r) { return r.owner === meId(); } }],
    filters: [{ label: "Owners", options: function () { return DN.empOptions(); }, test: function (r, v) { return r.owner === v; } }, { label: "Tags", options: allTags, test: function (r, v) { return hasTag(r, v); } }],
    beforeSave: function (d, isNew, old) {
      d.tags = normTags(d.tags);
      var changed = isNew || !old || old.stage !== d.stage;
      applyStage(d);
      if (changed) d.probability = stageOf(d.stage)[1];
      if (d.status === "Open") d.closedAt = "";
      if (old && old.stage !== d.stage) DN.logActivity("deal:" + d.id, "Note", "Stage changed from " + old.stage + " to " + d.stage, true);
    },
    afterSave: function (d, isNew) { if (isNew) DN.logActivity("deal:" + d.id, "Note", "Deal created in stage “" + d.stage + "”", true); },
    stats: function (rs) {
      var open = rs.filter(function (r) { return r.status === "Open"; }), won = rs.filter(function (r) { return r.status === "Won"; }), t = DN.today();
      return [{ l: "Open pipeline", v: DN.money(sum(open, function (r) { return r.value; })) },
        { l: "Weighted", v: DN.money(sum(open, function (r) { return (+r.value || 0) * (+r.probability || 0) / 100; })) },
        { l: "Won", v: won.length + " · " + DN.money(sum(won, function (r) { return r.value; })), tone: "good" },
        { l: "Closing in 14 days", v: open.filter(function (r) { return r.close && r.close >= t && r.close <= DN.addDays(t, 14); }).length }];
    },
    extra: withTimeline("deal"),
    actions: [
      { label: "Mark won", when: function (r) { return r.status === "Open"; }, run: function (r, done) { closeDeal(r, true, done); return true; } },
      { label: "Mark lost", when: function (r) { return r.status === "Open"; }, run: function (r, done) { closeDeal(r, false, done); return true; } },
      { label: "Create quotation", when: function (r) { return r.status !== "Lost"; }, run: function (r) { quoteFromDeal(r); } },
      { label: "Create contract", when: function (r) { return r.status === "Won" && !r.contractId && DN.isMgr(); }, run: function (r) {
        var c = DN.makeContract(DN.refName("companies", r.company) || r.name, r.value, "From deal “" + r.name + "”."); DN.patch("deals", r.id, { contractId: c.id }); go("contracts");
      } }
    ]
  };

  /* ---------- TASKS ---------- */
  function relOptions() {
    var out = [];
    [["lead", "leads", "Lead"], ["contact", "contacts", "Contact"], ["company", "companies", "Company"], ["deal", "deals", "Deal"]].forEach(function (g) {
      DN.live(g[1]).forEach(function (r) { out.push({ v: g[0] + ":" + r.id, l: g[2] + " — " + (r.name || "") }); });
    });
    return out;
  }
  var taskCfg = {
    id: "tasks", col: "crmtasks", noun: "Task", csvName: "crm-tasks", wide: true,
    fields: [
      { k: "title", label: "Task", required: true, list: true, full: true },
      { k: "desc", label: "Description", type: "textarea" },
      { k: "status", label: "Status", type: "select", options: ["To do", "In progress", "Completed", "Cancelled"], required: true, list: true, pill: true },
      { k: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High", "Urgent"], required: true, list: true },
      { k: "due", label: "Due", type: "date", list: true },
      { k: "assignee", label: "Assignee", ref: "employees", list: true },
      { k: "related", label: "Related to", type: "select", options: relOptions, list: true }
    ],
    defaults: function () { return { status: "To do", priority: "Medium", assignee: meId() }; },
    presets: [{ label: "All" }, { label: "My tasks", test: function (r) { return r.assignee === meId() && r.status !== "Completed" && r.status !== "Cancelled"; } },
      { label: "Overdue", test: function (r) { return r.due && r.due < DN.today() && r.status !== "Completed" && r.status !== "Cancelled"; } }],
    filters: [{ label: "Statuses", options: ["To do", "In progress", "Completed", "Cancelled"], test: function (r, v) { return r.status === v; } },
      { label: "Priorities", options: ["Low", "Medium", "High", "Urgent"], test: function (r, v) { return r.priority === v; } },
      { label: "Assignees", options: function () { return DN.empOptions(); }, test: function (r, v) { return r.assignee === v; } }],
    beforeSave: function (r, isNew, old) {
      r.completedAt = r.status === "Completed" ? (r.completedAt || Date.now()) : "";
      if (old && old.status !== "Completed" && r.status === "Completed" && /^deal:/.test(r.related || "")) DN.logActivity(r.related, "Note", "Task completed: " + r.title, true);
    },
    sort: function (a, b) { return (a.due || "9999").localeCompare(b.due || "9999"); },
    stats: function (rs) {
      var open = rs.filter(function (r) { return r.status !== "Completed" && r.status !== "Cancelled"; }), t = DN.today();
      return [{ l: "Open", v: open.length }, { l: "Mine", v: open.filter(function (r) { return r.assignee === meId(); }).length },
        { l: "Overdue", v: open.filter(function (r) { return r.due && r.due < t; }).length, tone: "bad" }, { l: "Completed", v: rs.filter(function (r) { return r.status === "Completed"; }).length, tone: "good" }];
    },
    actions: [{ label: "Complete", quick: true, when: function (r) { return r.status !== "Completed" && r.status !== "Cancelled"; }, run: function (r, done) {
      DN.patch("crmtasks", r.id, { status: "Completed", completedAt: Date.now() });
      if (/^deal:/.test(r.related || "")) DN.logActivity(r.related, "Note", "Task completed: " + r.title, true);
      if (done) done();
    } }]
  };

  /* ---------- seed (called from DN.seed) ---------- */
  DN.seedCrm = function (db, I, d, mk) {
    var id = function (o) { return o.id; };
    db.companies = [
      mk({ name: "Rao Textiles", website: "", industry: "Textiles", size: "51-200", gstin: "", owner: I.karan, tags: "Manufacturing", notes: "", addresses: [{ kind: "Billing", line1: "12 Ring Road", line2: "", city: "Surat", state: "Gujarat", postal: "395002", country: "India" }] }),
      mk({ name: "Menon Logistics", website: "", industry: "Logistics", size: "201-500", gstin: "", owner: I.karan, tags: "High value", notes: "", addresses: [] }),
      mk({ name: "Das Clinics", website: "", industry: "Healthcare", size: "11-50", gstin: "", owner: I.karan, tags: "", notes: "", addresses: [] }),
      mk({ name: "Kapoor Foods", website: "", industry: "FMCG", size: "51-200", gstin: "27ABCDE1234F1Z5", owner: I.aarav, tags: "Customer", notes: "", addresses: [{ kind: "Billing", line1: "5 MIDC Road", line2: "", city: "Pune", state: "Maharashtra", postal: "411019", country: "India" }] })];
    var C = db.companies;
    db.contacts = [
      mk({ name: "Vikram Rao", title: "Managing Director", company: id(C[0]), email: "", phone: "", whatsapp: "", source: "Referral", owner: I.karan, tags: "", notes: "" }),
      mk({ name: "Priya Menon", title: "COO", company: id(C[1]), email: "", phone: "", whatsapp: "", source: "Website", owner: I.karan, tags: "", notes: "" }),
      mk({ name: "Arjun Das", title: "Founder", company: id(C[2]), email: "", phone: "", whatsapp: "", source: "Manual", owner: I.karan, tags: "", notes: "" }),
      mk({ name: "Neha Kapoor", title: "Director", company: id(C[3]), email: "", phone: "", whatsapp: "", source: "Referral", owner: I.aarav, tags: "Customer", notes: "" })];
    var K = db.contacts;
    db.leads = [
      mk({ name: "Ritu Sharma", company: "Sharma Interiors", email: "", phone: "", whatsapp: "", website: "", source: "Instagram", status: "New", industry: "Interiors", location: "Mumbai", value: 120000, follow: d(1), owner: I.karan, tags: "Hot lead" }),
      mk({ name: "Sameer Gupta", company: "Gupta Traders", email: "", phone: "", whatsapp: "", website: "", source: "WhatsApp", status: "Contacted", industry: "Trading", location: "Delhi", value: 300000, follow: d(-1), owner: I.karan, tags: "" }),
      mk({ name: "Lakshmi Iyer", company: "Iyer Academy", email: "", phone: "", whatsapp: "", website: "", source: "Referral", status: "Proposal", industry: "Education", location: "Chennai", value: 520000, follow: d(3), owner: I.aarav, tags: "VIP" }),
      mk({ name: "Faisal Ahmed", company: "", email: "", phone: "", whatsapp: "", website: "", source: "Cold call", status: "Unqualified", industry: "", location: "", value: "", follow: "", owner: I.karan, tags: "" })];
    db.deals = [
      mk({ name: "Menon Logistics — Business OS rollout", stage: "Proposal", status: "Open", probability: 60, company: id(C[1]), contact: id(K[1]), owner: I.karan, value: 900000, currency: "INR", source: "Website", close: d(10), tags: "High value" }),
      mk({ name: "Rao Textiles — HRM + payroll", stage: "Discovery", status: "Open", probability: 30, company: id(C[0]), contact: id(K[0]), owner: I.karan, value: 450000, currency: "INR", source: "Referral", close: d(25), tags: "" }),
      mk({ name: "Das Clinics — CRM pilot", stage: "Qualified", status: "Open", probability: 10, company: id(C[2]), contact: id(K[2]), owner: I.karan, value: 250000, currency: "INR", source: "Manual", close: d(40), tags: "" }),
      mk({ name: "Kapoor Foods — implementation", stage: "Won", status: "Won", probability: 100, company: id(C[3]), contact: id(K[3]), owner: I.aarav, value: 600000, currency: "INR", source: "Referral", close: d(-40), closedAt: Date.now() - 40 * 864e5, tags: "Customer", winReason: "Strong referral and fast demo" }),
      mk({ name: "Gupta Traders — starter", stage: "Lost", status: "Lost", probability: 0, company: "", contact: "", owner: I.karan, value: 150000, currency: "INR", source: "WhatsApp", close: d(-12), closedAt: Date.now() - 12 * 864e5, tags: "", lossReason: "Budget" })];
    var D = db.deals;
    db.crmtasks = [
      mk({ title: "Send Menon Logistics proposal", desc: "", status: "In progress", priority: "High", due: d(1), assignee: I.karan, related: "deal:" + id(D[0]) }),
      mk({ title: "Discovery call with Rao Textiles", desc: "", status: "To do", priority: "Medium", due: d(4), assignee: I.karan, related: "deal:" + id(D[1]) }),
      mk({ title: "Call Sameer Gupta back", desc: "", status: "To do", priority: "Urgent", due: d(-1), assignee: I.karan, related: "lead:" + id(db.leads[1]) })];
    var act = function (rel, type, subj, sys, hoursAgo) { var a = mk({ rel: rel, type: type, subject: subj, by: I.karan, ts: Date.now() - hoursAgo * 36e5, system: sys }); return a; };
    db.activities = [
      act("deal:" + id(D[0]), "Note", "Deal created in stage “Qualified”", true, 240), act("deal:" + id(D[0]), "Meeting", "Demo with Priya and the ops team. Interested in invoices and HR.", false, 120),
      act("deal:" + id(D[0]), "Note", "Stage changed from Qualified to Proposal", true, 48), act("lead:" + id(db.leads[1]), "Call", "Spoke briefly. Asked to call back tomorrow.", false, 30),
      act("lead:" + id(db.leads[2]), "Email", "Sent the Business OS overview.", false, 20)];
  };

  /* ---------- CRM app: tabs over the five lists ---------- */
  var TABS = [["leads", "Leads", leadCfg], ["contacts", "Contacts", contactCfg], ["companies", "Companies", companyCfg], ["deals", "Deals", dealCfg], ["tasks", "Tasks", taskCfg]];
  DN.register({ id: "crm", name: "CRM", group: "Sales & Finance", mono: "CR", desc: "Leads, contacts, companies, deals and tasks.",
    mount: function (root) {
      var cur = (location.hash || "").replace("#", ""); if (!TABS.some(function (t) { return t[0] === cur; })) cur = "leads";
      var bar = h("div", { class: "tabs", role: "tablist" }), body = h("div");
      function show() {
        DN.clear(bar);
        TABS.forEach(function (t) { bar.append(h("button", { role: "tab", "aria-selected": t[0] === cur, onclick: function () { cur = t[0]; history.replaceState(null, "", "#" + cur); show(); } }, t[1])); });
        DN.clear(body);
        var cfg = TABS.filter(function (t) { return t[0] === cur; })[0][2];
        // task list uses the same engine; lists with many columns scroll sideways inside their own box
        DN.engine(cfg, body);
      }
      root.append(bar, body); show();
    } });
})();
