/* Dotnapps staff portal — record-based apps (config-driven) + demo seed data. */
(function () {
  "use strict";
  var DN = window.DN, h = DN.h;

  var OPEN_STAGES_CRM = ["New", "Contacted", "Qualified", "Proposal"];
  var GSTIN_RE = "[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]";
  var meId = function () { var m = DN.me(); return m ? m.id : ""; };
  var mine = function (k) { return function (r) { return DN.isMgr() || r[k] === meId(); }; };
  var isoMonth = function (d) { return d.slice(0, 7); };
  var go = function (id) { location.href = "/staff/" + id + "/"; };
  var sum = function (a, f) { return a.reduce(function (s, x) { return s + (+f(x) || 0); }, 0); };

  DN.leaveDays = function (from, to) {      // inclusive, Sundays are not counted
    var n = 0;
    for (var d = from; d <= to; d = DN.addDays(d, 1)) if (DN.parse(d).getDay() !== 0) n++;
    return n;
  };

  function register(a) { DN.apps.push(a); DN.cfg[a.id] = a; }
  function engineApp(meta, A) {
    A.id = meta.id; meta.engine = A;
    meta.mount = function (root) { return DN.engine(A, root); };
    register(meta);
  }

  /* ================= SALES & FINANCE ================= */
  engineApp({ id: "crm", name: "CRM", group: "Sales & Finance", mono: "CR", desc: "Leads, deals and follow-ups." }, {
    col: "leads", noun: "Lead", csvName: "crm-leads", board: "stage", wide: true,
    fields: [
      { k: "name", label: "Contact", required: true, list: true },
      { k: "company", label: "Company", list: true },
      { k: "email", label: "Email", type: "email" },
      { k: "phone", label: "Phone", type: "tel" },
      { k: "value", label: "Deal value", type: "money", list: true },
      { k: "stage", label: "Stage", type: "select", options: ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"], required: true, list: true, pill: true },
      { k: "owner", label: "Owner", ref: "employees", list: true },
      { k: "follow", label: "Next follow-up", type: "date", list: true },
      { k: "source", label: "Source", type: "select", options: ["Website", "Referral", "Cold outreach", "Event", "Other"] },
      { k: "notes", label: "Notes", type: "textarea" }
    ],
    defaults: function () { return { stage: "New", owner: meId(), source: "Website" }; },
    cardTitle: function (r) { return r.company || r.name; },
    cardSub: function (r) { return [r.company ? r.name : "", r.value ? DN.money(r.value) : "", r.follow ? "Follow up " + DN.date(r.follow) : ""]; },
    stats: function (rs) {
      var open = rs.filter(function (r) { return OPEN_STAGES_CRM.indexOf(r.stage) > -1; }), t = DN.today();
      return [
        { l: "Open pipeline", v: DN.money(sum(open, function (r) { return r.value; })) },
        { l: "Open leads", v: open.length },
        { l: "Won", v: DN.money(sum(rs.filter(function (r) { return r.stage === "Won"; }), function (r) { return r.value; })), tone: "good" },
        { l: "Follow-ups due", v: open.filter(function (r) { return r.follow && r.follow <= t; }).length, tone: "bad" }
      ];
    },
    actions: [{ label: "Create quotation", when: function (r) { return r.stage !== "Lost"; }, run: function (r) {
      var doc = { type: "Quotation", client: r.company || r.name, date: DN.today(), due: DN.addDays(DN.today(), 15), gst: "18",
        lines: [{ d: "Services for " + (r.company || r.name), q: 1, r: +r.value || 0 }], status: "Draft", notes: "", leadId: r.id };
      doc.no = DN.nextNo("QT-", "salesdocs", "no");
      DN.insert("salesdocs", doc);
      if (r.stage === "New" || r.stage === "Contacted" || r.stage === "Qualified") DN.patch("leads", r.id, { stage: "Proposal" });
      DN.toast("Quotation " + doc.no + " created from this lead."); go("sales");
    } }]
  });

  function printDoc(r) {
    var s = DN.settings(), t = DN.linesTotals(r), box = h("div");
    box.append(h("div", { class: "pr-h" },
      h("div", null, h("h2", null, s.company || "Dotnapps"), h("div", null, s.address || ""), s.gstin ? h("div", null, "GSTIN: " + s.gstin) : null),
      h("div", { style: "text-align:right" }, h("h2", null, r.type.toUpperCase()), h("div", null, r.no), h("div", null, "Date: " + DN.date(r.date)), r.due ? h("div", null, (r.type === "Invoice" ? "Due: " : "Valid till: ") + DN.date(r.due)) : null)));
    box.append(h("p", null, h("b", null, "Bill to: "), r.client, r.gstin ? "  (GSTIN " + r.gstin + ")" : ""));
    var tb = h("tbody");
    (r.lines || []).forEach(function (l, i) {
      tb.append(h("tr", null, h("td", null, i + 1), h("td", null, l.d), h("td", { class: "num" }, l.q), h("td", { class: "num" }, DN.money(l.r)), h("td", { class: "num" }, DN.money(l.q * l.r))));
    });
    box.append(h("table", null, h("thead", null, h("tr", null, h("th", null, "#"), h("th", null, "Description"), h("th", { class: "num" }, "Qty"), h("th", { class: "num" }, "Rate"), h("th", { class: "num" }, "Amount"))), tb));
    box.append(h("div", { class: "pr-tot" }, h("div", null, h("span", null, "Subtotal"), h("span", null, DN.money(t.sub))),
      h("div", null, h("span", null, "GST @ " + (r.gst || 0) + "%"), h("span", null, DN.money(t.tax))),
      h("div", { class: "g" }, h("span", null, "Total"), h("span", null, DN.money(t.total)))));
    if (r.notes) box.append(h("p", null, h("b", null, "Notes: "), r.notes));
    DN.print(box);
  }

  engineApp({ id: "sales", name: "Quotations & Invoices", group: "Sales & Finance", mono: "QI", desc: "Quote, convert to invoice, print, track payment." }, {
    col: "salesdocs", noun: "Document", csvName: "quotes-invoices", wide: true,
    fields: [
      { k: "type", label: "Type", type: "select", options: ["Quotation", "Invoice"], required: true, list: true },
      { k: "no", label: "Number", list: true, hideInForm: true },
      { k: "client", label: "Client", required: true, list: true },
      { k: "gstin", label: "Client GSTIN", pattern: GSTIN_RE, patternHelp: "15-character GSTIN, e.g. 29ABCDE1234F1Z5", hint: "Optional. Validated for format only." },
      { k: "date", label: "Date", type: "date", required: true, list: true },
      { k: "due", label: "Due / valid till", type: "date", list: true },
      { k: "gst", label: "GST %", type: "select", options: ["0", "5", "12", "18", "28"], required: true },
      { k: "status", label: "Status", type: "select", options: ["Draft", "Sent", "Accepted", "Rejected", "Paid", "Cancelled"], required: true, list: true, pill: true },
      { k: "lines", label: "Line items", type: "lines" },
      { k: "notes", label: "Notes / terms", type: "textarea" }
    ],
    extraCols: [{ label: "Total", num: true, cell: function (r) { return DN.money(DN.linesTotals(r).total); }, csv: function (r) { return DN.linesTotals(r).total; } }],
    defaults: function () { return { type: "Quotation", date: DN.today(), due: DN.addDays(DN.today(), 15), gst: "18", status: "Draft" }; },
    beforeSave: function (r, isNew, old) {
      if (!r.lines || !r.lines.length) return "Add at least one line item.";
      if (isNew || (old && old.type !== r.type)) r.no = DN.nextNo(r.type === "Invoice" ? "INV-" : "QT-", "salesdocs", "no");
    },
    stats: function (rs) {
      var inv = rs.filter(function (r) { return r.type === "Invoice" && r.status !== "Cancelled"; }), t = DN.today();
      var out = inv.filter(function (r) { return r.status !== "Paid"; });
      var tot = function (r) { return DN.linesTotals(r).total; };
      return [
        { l: "Open quotations", v: DN.money(sum(rs.filter(function (r) { return r.type === "Quotation" && ["Draft", "Sent"].indexOf(r.status) > -1; }), tot)) },
        { l: "Invoiced", v: DN.money(sum(inv, tot)) },
        { l: "Outstanding", v: DN.money(sum(out, tot)) },
        { l: "Overdue", v: DN.money(sum(out.filter(function (r) { return r.due && r.due < t; }), tot)), tone: "bad" }
      ];
    },
    actions: [
      { label: "Mark paid", quick: true, when: function (r) { return r.type === "Invoice" && r.status !== "Paid" && r.status !== "Cancelled"; },
        run: function (r, done) { DN.patch("salesdocs", r.id, { status: "Paid", paidOn: DN.today() }); DN.toast(r.no + " marked paid."); if (done) done(); } },
      { label: "Convert to invoice", when: function (r) { return r.type === "Quotation" && ["Rejected", "Cancelled"].indexOf(r.status) < 0; },
        run: function (r) {
          var inv = { type: "Invoice", client: r.client, gstin: r.gstin, date: DN.today(), due: DN.addDays(DN.today(), 15), gst: r.gst,
            lines: JSON.parse(JSON.stringify(r.lines || [])), status: "Sent", notes: r.notes || "", fromQuote: r.no };
          inv.no = DN.nextNo("INV-", "salesdocs", "no"); DN.insert("salesdocs", inv);
          DN.patch("salesdocs", r.id, { status: "Accepted" });
          DN.toast("Invoice " + inv.no + " created from " + r.no + ".");
        } },
      { label: "Print / save PDF", run: function (r) { setTimeout(function () { printDoc(r); }, 50); } }
    ]
  });

  engineApp({ id: "contracts", name: "Contracts", group: "Sales & Finance", mono: "CT", desc: "Agreements, renewals and expiry alerts." }, {
    col: "contracts", noun: "Contract", csvName: "contracts", wide: true,
    fields: [
      { k: "title", label: "Title", required: true, list: true },
      { k: "party", label: "Counterparty", required: true, list: true },
      { k: "type", label: "Type", type: "select", options: ["Client", "Vendor", "Employment", "NDA", "Other"], required: true, list: true },
      { k: "value", label: "Value", type: "money", list: true },
      { k: "start", label: "Start", type: "date" },
      { k: "end", label: "End / renewal date", type: "date", list: true },
      { k: "status", label: "Status", type: "select", options: ["Draft", "Sent for signature", "Signed", "Expired", "Terminated"], required: true, list: true, pill: true },
      { k: "owner", label: "Owner", ref: "employees" },
      { k: "link", label: "Document link", type: "url", hint: "Link to the signed copy in your drive (http/https)." },
      { k: "notes", label: "Notes", type: "textarea" }
    ],
    extraCols: [{ label: "Ends in", cell: function (r) {
      if (!r.end) return ""; var d = DN.daysBetween(DN.today(), r.end);
      return d < 0 ? h("span", { class: "pill bad" }, -d + " days ago") : d <= 60 ? h("span", { class: "pill warn" }, d + " days") : d + " days";
    }, csv: function (r) { return r.end ? DN.daysBetween(DN.today(), r.end) : ""; } }],
    defaults: function () { return { status: "Draft", type: "Client", owner: meId() }; },
    beforeSave: function (r) {
      if (r.link && !/^https?:\/\//i.test(r.link)) return "Document link must start with http:// or https://";
      if (r.start && r.end && r.end < r.start) return "End date is before the start date.";
    },
    stats: function (rs) {
      var t = DN.today(), signed = rs.filter(function (r) { return r.status === "Signed"; });
      return [
        { l: "Signed", v: signed.length, tone: "good" },
        { l: "Signed value", v: DN.money(sum(signed, function (r) { return r.value; })) },
        { l: "Awaiting signature", v: rs.filter(function (r) { return r.status === "Sent for signature"; }).length },
        { l: "Expiring in 60 days", v: signed.filter(function (r) { return r.end && r.end >= t && r.end <= DN.addDays(t, 60); }).length, tone: "bad" }
      ];
    }
  });

  /* ================= PEOPLE ================= */
  var HR_ONLY = ["hr", "admin"];
  engineApp({ id: "hrm", name: "HRM", group: "People", mono: "HR", desc: "Employee directory, teams and reporting lines." }, {
    col: "employees", noun: "Employee", csvName: "employees", wide: true, canCreate: HR_ONLY, canEdit: function () { return DN.can(HR_ONLY); },
    fields: [
      { k: "name", label: "Full name", required: true, list: true },
      { k: "code", label: "Employee ID", list: true, hideInForm: true },
      { k: "dept", label: "Department", type: "select", options: ["Engineering", "Design", "Sales", "HR", "Finance", "Operations", "Management"], required: true, list: true },
      { k: "title", label: "Job title", list: true },
      { k: "email", label: "Work email", type: "email", list: true },
      { k: "phone", label: "Phone", type: "tel" },
      { k: "joined", label: "Date of joining", type: "date", list: true },
      { k: "manager", label: "Reports to", ref: "employees" },
      { k: "access", label: "Access role", type: "select", options: ["Staff", "Manager", "HR", "Admin"], required: true, hint: "Controls what this person sees in the portal." },
      { k: "ctc", label: "Annual CTC (₹)", type: "money", roles: HR_ONLY, hint: "Visible to HR and Admin only." },
      { k: "status", label: "Status", type: "select", options: ["Active", "On notice", "Exited"], required: true, list: true, pill: true }
    ],
    defaults: function () { return { status: "Active", access: "Staff", joined: DN.today(), dept: "Engineering" }; },
    beforeSave: function (r, isNew) { if (isNew && !r.code) r.code = DN.nextNo("EMP-", "employees", "code"); },
    sort: function (a, b) { return (a.code || "").localeCompare(b.code || ""); },
    stats: function (rs) {
      var act = rs.filter(function (r) { return r.status !== "Exited"; }), y = DN.today().slice(0, 4);
      return [
        { l: "Headcount", v: act.length },
        { l: "Joined this year", v: act.filter(function (r) { return (r.joined || "").slice(0, 4) === y; }).length },
        { l: "On notice", v: rs.filter(function (r) { return r.status === "On notice"; }).length, tone: "bad" },
        { l: "Departments", v: new Set(act.map(function (r) { return r.dept; })).size }
      ];
    }
  });

  engineApp({ id: "recruitment", name: "Recruitment", group: "People", mono: "RC", desc: "Candidates through to offer and hire." }, {
    col: "candidates", noun: "Candidate", csvName: "candidates", board: "stage", wide: true, canCreate: ["manager", "hr", "admin"],
    filter: function () { return DN.isMgr(); },
    fields: [
      { k: "name", label: "Candidate", required: true, list: true },
      { k: "position", label: "Position", required: true, list: true },
      { k: "stage", label: "Stage", type: "select", options: ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"], required: true, list: true, pill: true },
      { k: "source", label: "Source", type: "select", options: ["Job portal", "Referral", "LinkedIn", "Campus", "Website", "Other"] },
      { k: "email", label: "Email", type: "email" },
      { k: "phone", label: "Phone", type: "tel" },
      { k: "expected", label: "Expected CTC (₹/yr)", type: "money", roles: HR_ONLY },
      { k: "interviewer", label: "Interviewer", ref: "employees", list: true },
      { k: "resume", label: "Resume link", type: "url" },
      { k: "notes", label: "Notes", type: "textarea" }
    ],
    defaults: function () { return { stage: "Applied", source: "Job portal" }; },
    beforeSave: function (r) { if (r.resume && !/^https?:\/\//i.test(r.resume)) return "Resume link must start with http:// or https://"; },
    cardTitle: function (r) { return r.name; },
    cardSub: function (r) { return [r.position, r.interviewer ? "Interviewer: " + DN.nm(r.interviewer) : ""]; },
    stats: function (rs) {
      var n = function (s) { return rs.filter(function (r) { return r.stage === s; }).length; };
      return [{ l: "In process", v: rs.filter(function (r) { return ["Applied", "Screening", "Interview", "Offer"].indexOf(r.stage) > -1; }).length },
        { l: "Interviews", v: n("Interview") }, { l: "Offers out", v: n("Offer") }, { l: "Hired", v: n("Hired"), tone: "good" }];
    },
    actions: [{ label: "Hire → create employee", when: function (r) { return (r.stage === "Offer" || r.stage === "Hired") && !r.employeeId && DN.can(HR_ONLY); },
      run: function (r) {
        var e = DN.insert("employees", { name: r.name, email: r.email || "", phone: r.phone || "", title: r.position, dept: "Operations",
          joined: DN.today(), access: "Staff", status: "Active", ctc: r.expected || "" });
        DN.patch("employees", e.id, { code: DN.nextNo("EMP-", "employees", "code") });
        DN.patch("candidates", r.id, { stage: "Hired", employeeId: e.id });
        DN.toast(r.name + " added to HRM. Set department, manager and CTC there."); go("hrm");
      } }]
  });

  engineApp({ id: "timesheets", name: "Timesheets", group: "People", mono: "TS", desc: "Log hours by project; managers approve." }, {
    col: "timesheets", noun: "Entry", csvName: "timesheets", filter: mine("emp"),
    fields: [
      { k: "date", label: "Date", type: "date", required: true, list: true },
      { k: "emp", label: "Employee", ref: "employees", required: true, list: true, roles: ["manager", "hr", "admin"] },
      { k: "project", label: "Project", required: true, list: true },
      { k: "task", label: "Task", list: true },
      { k: "hours", label: "Hours", type: "number", required: true, list: true, max: 24 },
      { k: "billable", label: "Billable", type: "select", options: ["Yes", "No"], required: true, list: true },
      { k: "status", label: "Status", type: "select", options: ["Draft", "Submitted", "Approved"], required: true, list: true, pill: true }
    ],
    defaults: function () { return { date: DN.today(), emp: meId(), billable: "Yes", status: "Draft" }; },
    beforeSave: function (r) {
      if (!DN.isMgr()) r.emp = meId();
      if (r.hours <= 0) return "Hours must be more than zero.";
    },
    canEdit: function (r) { return DN.isMgr() || (r.emp === meId() && r.status !== "Approved"); },
    sort: function (a, b) { return (b.date || "").localeCompare(a.date || ""); },
    stats: function (rs) {
      var t = DN.today(), dow = (DN.parse(t).getDay() + 6) % 7, wk = DN.addDays(t, -dow);
      var week = rs.filter(function (r) { return r.date >= wk && r.date <= DN.addDays(wk, 6); });
      var b = sum(week.filter(function (r) { return r.billable === "Yes"; }), function (r) { return r.hours; }), all = sum(week, function (r) { return r.hours; });
      return [{ l: "Hours this week", v: all }, { l: "Billable", v: all ? Math.round(b / all * 100) + "%" : "–" },
        { l: "Awaiting approval", v: rs.filter(function (r) { return r.status === "Submitted"; }).length }, { l: "Entries", v: rs.length }];
    },
    actions: [{ label: "Approve", quick: true, when: function (r) { return r.status === "Submitted" && DN.isMgr() && r.emp !== meId(); },
      run: function (r, done) { DN.patch("timesheets", r.id, { status: "Approved" }); if (done) done(); } },
      { label: "Submit", quick: true, when: function (r) { return r.status === "Draft" && r.emp === meId(); },
        run: function (r, done) { DN.patch("timesheets", r.id, { status: "Submitted" }); if (done) done(); } }]
  });

  engineApp({ id: "performance", name: "Performance", group: "People", mono: "PF", desc: "Review cycles, ratings and goals." }, {
    col: "reviews", noun: "Review", csvName: "reviews", wide: true, canCreate: ["manager", "hr", "admin"],
    filter: function (r) { return DN.isMgr() || r.emp === meId(); },
    canEdit: function (r) { return DN.isMgr() && r.emp !== meId() || DN.can(["hr", "admin"]); },
    fields: [
      { k: "emp", label: "Employee", ref: "employees", required: true, list: true },
      { k: "period", label: "Review period", required: true, list: true, hint: "e.g. H1 2026" },
      { k: "reviewer", label: "Reviewer", ref: "employees", list: true },
      { k: "delivery", label: "Delivery (1–5)", type: "select", options: ["1", "2", "3", "4", "5"], required: true },
      { k: "quality", label: "Quality (1–5)", type: "select", options: ["1", "2", "3", "4", "5"], required: true },
      { k: "teamwork", label: "Teamwork (1–5)", type: "select", options: ["1", "2", "3", "4", "5"], required: true },
      { k: "ownership", label: "Ownership (1–5)", type: "select", options: ["1", "2", "3", "4", "5"], required: true },
      { k: "goals", label: "Goals for next period", type: "textarea" },
      { k: "comments", label: "Reviewer comments", type: "textarea" },
      { k: "status", label: "Status", type: "select", options: ["Draft", "Shared", "Acknowledged"], required: true, list: true, pill: true }
    ],
    defaults: function () { return { reviewer: meId(), status: "Draft", delivery: "3", quality: "3", teamwork: "3", ownership: "3" }; },
    extraCols: [{ label: "Score", num: true, cell: score, csv: score }],
    beforeSave: function (r) { if (r.emp === r.reviewer) return "A review needs a reviewer other than the employee."; },
    stats: function (rs) {
      var sc = rs.map(function (r) { return +score(r); }).filter(Boolean);
      return [{ l: "Reviews", v: rs.length }, { l: "Average score", v: sc.length ? (sum(sc, function (x) { return x; }) / sc.length).toFixed(2) : "–" },
        { l: "Awaiting acknowledgement", v: rs.filter(function (r) { return r.status === "Shared"; }).length }];
    },
    actions: [{ label: "Acknowledge", quick: true, when: function (r) { return r.status === "Shared" && r.emp === meId(); },
      run: function (r, done) { DN.patch("reviews", r.id, { status: "Acknowledged" }); if (done) done(); } }]
  });
  function score(r) { var v = [r.delivery, r.quality, r.teamwork, r.ownership].map(Number); return (sum(v, function (x) { return x; }) / 4).toFixed(2); }

  /* ================= WORK ================= */
  engineApp({ id: "tasks", name: "Tasks", group: "Work", mono: "TK", desc: "Board of work, assigned and dated." }, {
    col: "tasks", noun: "Task", csvName: "tasks", board: "status",
    fields: [
      { k: "title", label: "Task", required: true, list: true },
      { k: "project", label: "Project", list: true },
      { k: "assignee", label: "Assignee", ref: "employees", list: true },
      { k: "due", label: "Due", type: "date", list: true },
      { k: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High"], required: true, list: true },
      { k: "status", label: "Status", type: "select", options: ["To do", "In progress", "In review", "Done"], required: true, list: true, pill: true },
      { k: "desc", label: "Description", type: "textarea" }
    ],
    defaults: function () { return { assignee: meId(), priority: "Medium", status: "To do" }; },
    cardTitle: function (r) { return r.title; },
    cardSub: function (r) { return [r.project, DN.nm(r.assignee), r.due ? "Due " + DN.date(r.due) : "", r.priority === "High" ? "● High priority" : ""]; },
    stats: function (rs) {
      var t = DN.today(), open = rs.filter(function (r) { return r.status !== "Done"; });
      return [{ l: "Open", v: open.length }, { l: "Mine", v: open.filter(function (r) { return r.assignee === meId(); }).length },
        { l: "Overdue", v: open.filter(function (r) { return r.due && r.due < t; }).length, tone: "bad" },
        { l: "Done", v: rs.length - open.length, tone: "good" }];
    }
  });

  var DOC_ACCESS = ["All staff", "Managers", "HR only", "Admin only"];
  engineApp({ id: "documents", name: "Documents", group: "Work", mono: "DC", desc: "Register of policies, templates and files." }, {
    col: "documents", noun: "Document", csvName: "documents",
    filter: function (r) {
      var a = r.access || "All staff", role = DN.role();
      return a === "All staff" || r.owner === meId() || (a === "Managers" && DN.isMgr()) || (a === "HR only" && (role === "hr" || role === "admin")) || (a === "Admin only" && role === "admin");
    },
    fields: [
      { k: "name", label: "Document", required: true, list: true },
      { k: "category", label: "Category", type: "select", options: ["Policy", "HR", "Finance", "Legal", "Template", "Client", "Other"], required: true, list: true },
      { k: "url", label: "Link", type: "url", full: true, hint: "Paste the Drive / SharePoint link (http/https). Files themselves aren't stored here." },
      { k: "version", label: "Version", list: true },
      { k: "owner", label: "Owner", ref: "employees", list: true },
      { k: "access", label: "Who can see it", type: "select", options: DOC_ACCESS, required: true, list: true },
      { k: "updated", label: "Last updated", type: "date", list: true, hideInForm: true },
      { k: "notes", label: "Notes", type: "textarea" }
    ],
    defaults: function () { return { owner: meId(), access: "All staff", version: "v1" }; },
    beforeSave: function (r) {
      if (r.url && !/^https?:\/\//i.test(r.url)) return "Link must start with http:// or https://";
      r.updated = DN.today();
    },
    actions: [{ label: "Open link", quick: true, when: function (r) { return /^https?:\/\//i.test(r.url || ""); },
      run: function (r) { window.open(r.url, "_blank", "noopener,noreferrer"); } }]
  });

  engineApp({ id: "kb", name: "Knowledge Base", group: "Work", mono: "KB", desc: "How-tos and policies your team can search." }, {
    col: "articles", noun: "Article", csvName: "knowledge-base", wide: true,
    fields: [
      { k: "title", label: "Title", required: true, list: true, full: true },
      { k: "category", label: "Category", type: "select", options: ["Getting started", "HR & policies", "Engineering", "Sales", "Finance", "IT", "Other"], required: true, list: true },
      { k: "visibility", label: "Status", type: "select", options: ["Published", "Draft"], required: true, list: true, pill: true },
      { k: "body", label: "Article", type: "textarea", required: true, hint: "Use “# Heading”, “- bullet” and blank lines between paragraphs." },
      { k: "author", label: "Author", ref: "employees", list: true },
      { k: "updated", label: "Updated", type: "date", list: true, hideInForm: true }
    ],
    filter: function (r) { return r.visibility !== "Draft" || r.author === meId() || DN.isMgr(); },
    defaults: function () { return { author: meId(), visibility: "Published" }; },
    beforeSave: function (r) { r.updated = DN.today(); r.rev = (r.rev || 0) + 1; },
    open: function (r, edit) {
      DN.read(r.title, r.body, [{ label: "Edit", run: edit }]);
    }
  });

  /* ================= DEMO SEED ================= */
  DN.seed = function () {
    var t = DN.today(), d = function (n) { return DN.addDays(t, n); }, I = {}, db = { settings: { company: "Dotnapps", address: "", gstin: "", pt: 200 } };
    var ec = 0;
    function emp(key, name, dept, title, access, ctc, joinedDaysAgo, mgr) {
      var id = "e_" + key; I[key] = id;
      db.employees.push({ id: id, created: Date.now() + ec, name: name, code: "EMP-" + String(++ec).padStart(4, "0"), dept: dept, title: title,
        email: key + "@example.com", joined: d(-joinedDaysAgo), access: access, ctc: ctc, status: "Active", manager: mgr ? I[mgr] : "" });
    }
    db.employees = [];
    emp("aarav", "Aarav Mehta", "Management", "Founder & Director", "Admin", 3600000, 900);
    emp("diya", "Diya Nair", "HR", "HR Manager", "HR", 1200000, 600, "aarav");
    emp("rohan", "Rohan Iyer", "Engineering", "Engineering Lead", "Manager", 2400000, 540, "aarav");
    emp("meera", "Meera Pillai", "Design", "Product Designer", "Staff", 1080000, 300, "rohan");
    emp("karan", "Karan Shah", "Sales", "Sales Executive", "Staff", 840000, 200, "aarav");
    emp("sana", "Sana Khan", "Engineering", "Software Engineer", "Staff", 1320000, 120, "rohan");
    var n = 0, mk = function (o) { o.id = "s" + (++n); o.created = Date.now() + n; return o; };
    db.leads = [
      mk({ name: "Vikram Rao", company: "Rao Textiles", value: 450000, stage: "Qualified", owner: I.karan, follow: d(2), source: "Referral", email: "", phone: "", notes: "Wants HRM + payroll." }),
      mk({ name: "Priya Menon", company: "Menon Logistics", value: 900000, stage: "Proposal", owner: I.karan, follow: d(-1), source: "Website", email: "", phone: "", notes: "" }),
      mk({ name: "Arjun Das", company: "Das Clinics", value: 250000, stage: "New", owner: I.karan, follow: d(5), source: "Event", email: "", phone: "", notes: "" }),
      mk({ name: "Neha Kapoor", company: "Kapoor Foods", value: 600000, stage: "Won", owner: I.aarav, follow: "", source: "Referral", email: "", phone: "", notes: "" })];
    db.salesdocs = [
      mk({ type: "Quotation", no: "QT-0001", client: "Menon Logistics", gstin: "", date: d(-6), due: d(9), gst: "18", status: "Sent", notes: "50% advance, balance on delivery.", lines: [{ d: "Business OS setup (CRM, Invoices, HRM)", q: 1, r: 600000 }, { d: "Staff training", q: 3, r: 100000 }] }),
      mk({ type: "Invoice", no: "INV-0001", client: "Kapoor Foods", gstin: "", date: d(-30), due: d(-15), gst: "18", status: "Sent", notes: "", lines: [{ d: "Implementation — phase 1", q: 1, r: 300000 }] }),
      mk({ type: "Invoice", no: "INV-0002", client: "Kapoor Foods", gstin: "", date: d(-20), due: d(10), gst: "18", status: "Paid", notes: "", lines: [{ d: "Implementation — phase 2", q: 1, r: 300000 }] })];
    db.contracts = [
      mk({ title: "Kapoor Foods — implementation agreement", party: "Kapoor Foods", type: "Client", value: 600000, start: d(-40), end: d(325), status: "Signed", owner: I.aarav, link: "", notes: "" }),
      mk({ title: "Cloud hosting — annual", party: "Example Hosting Pvt Ltd", type: "Vendor", value: 180000, start: d(-300), end: d(45), status: "Signed", owner: I.rohan, link: "", notes: "Renew before expiry." }),
      mk({ title: "Menon Logistics — MSA", party: "Menon Logistics", type: "Client", value: 900000, start: "", end: "", status: "Sent for signature", owner: I.aarav, link: "", notes: "" })];
    db.candidates = [
      mk({ name: "Ishaan Verma", position: "Frontend Engineer", stage: "Interview", source: "LinkedIn", interviewer: I.rohan, expected: 1200000, notes: "" }),
      mk({ name: "Tara Joseph", position: "Product Designer", stage: "Screening", source: "Referral", interviewer: I.meera, expected: 900000, notes: "" }),
      mk({ name: "Dev Malhotra", position: "Sales Executive", stage: "Offer", source: "Job portal", interviewer: I.karan, expected: 800000, notes: "" })];
    db.leave = [
      mk({ emp: I.meera, type: "Casual", from: d(3), to: d(4), days: DN.leaveDays(d(3), d(4)), reason: "Family function", status: "Pending" }),
      mk({ emp: I.sana, type: "Sick", from: d(-8), to: d(-7), days: DN.leaveDays(d(-8), d(-7)), reason: "Fever", status: "Approved" })];
    db.attendance = [
      mk({ emp: I.rohan, date: d(-1), in: "09:32", out: "18:10" }), mk({ emp: I.meera, date: d(-1), in: "10:05", out: "18:45" }),
      mk({ emp: I.sana, date: d(-1), in: "09:50", out: "17:58" })];
    db.timesheets = [
      mk({ date: d(-1), emp: I.sana, project: "Kapoor Foods", task: "Invoice module", hours: 7.5, billable: "Yes", status: "Submitted" }),
      mk({ date: d(-1), emp: I.meera, project: "Menon Logistics", task: "Onboarding screens", hours: 6, billable: "Yes", status: "Approved" }),
      mk({ date: d(-2), emp: I.rohan, project: "Internal", task: "Hiring interviews", hours: 3, billable: "No", status: "Submitted" })];
    db.reviews = [mk({ emp: I.sana, period: "H1", reviewer: I.rohan, delivery: "4", quality: "4", teamwork: "5", ownership: "4", goals: "Lead the invoicing module.", comments: "Reliable and quick to learn.", status: "Shared" })];
    db.tasks = [
      mk({ title: "Send Menon Logistics proposal", project: "Sales", assignee: I.karan, due: d(1), priority: "High", status: "In progress", desc: "" }),
      mk({ title: "Renew cloud hosting contract", project: "Operations", assignee: I.rohan, due: d(30), priority: "Medium", status: "To do", desc: "" }),
      mk({ title: "Draft Q3 hiring plan", project: "HR", assignee: I.diya, due: d(-2), priority: "Medium", status: "In review", desc: "" }),
      mk({ title: "Design onboarding screens", project: "Menon Logistics", assignee: I.meera, due: d(-5), priority: "Low", status: "Done", desc: "" })];
    db.documents = [
      mk({ name: "Leave policy", category: "Policy", url: "", version: "v2", owner: I.diya, access: "All staff", updated: d(-60), notes: "" }),
      mk({ name: "Offer letter template", category: "Template", url: "", version: "v1", owner: I.diya, access: "HR only", updated: d(-90), notes: "" }),
      mk({ name: "Employment agreements", category: "Legal", url: "", version: "v3", owner: I.aarav, access: "Admin only", updated: d(-120), notes: "" })];
    db.articles = [
      mk({ title: "Welcome to Dotnapps", category: "Getting started", visibility: "Published", author: I.diya, updated: t, rev: 1,
        body: "# First week\n- Meet your manager and your team\n- Set up your email and the staff portal\n- Read the leave policy in Documents\n\n# Working hours\nOffice hours are 9:30 to 18:30. Log your time daily in Timesheets." }),
      mk({ title: "How to apply for leave", category: "HR & policies", visibility: "Published", author: I.diya, updated: t, rev: 1,
        body: "Open Leave & Attendance, choose Leave, and press New request. Your manager is notified and approves or rejects it.\n\nUnpaid leave is deducted in payroll for that month." })];
    db.events = [mk({ title: "All-hands", date: d(7), kind: "Meeting", notes: "" })];
    db.channels = [{ id: "general", name: "general" }, { id: "sales", name: "sales" }, { id: "engineering", name: "engineering" }, { id: "hr", name: "hr" }];
    db.messages = [
      mk({ ch: "general", from: I.aarav, ts: Date.now() - 36e5, text: "Welcome to the new staff portal. Everything here is demo data until we connect it to Business OS." }),
      mk({ ch: "engineering", from: I.rohan, ts: Date.now() - 18e5, text: "Standup at 10:30. Invoice module is ready for review." })];
    db.payruns = [];
    db.demo = true;
    return db;
  };
})();
