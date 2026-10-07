/* Dotnapps staff portal — leave & attendance, payroll, chat, calendar. */
(function () {
  "use strict";
  var DN = window.DN, h = DN.h;
  var HR_ONLY = ["hr", "admin"], MGR = ["manager", "hr", "admin"];
  var QUOTA = { Casual: 12, Sick: 8, Earned: 15 };
  var meId = function () { var m = DN.me(); return m ? m.id : ""; };
  var sum = function (a, f) { return a.reduce(function (s, x) { return s + (+f(x) || 0); }, 0); };
  var mine = function (r) { return DN.isMgr() || r.emp === meId(); };
  var yr = function () { return DN.today().slice(0, 4); };

  function tabs(root, list, key) {
    var cur = list[0].id, body = h("div"), bar = h("div", { class: "tabs", role: "tablist" });
    function show() {
      DN.clear(bar);
      list.forEach(function (t) {
        bar.append(h("button", { role: "tab", "aria-selected": t.id === cur, onclick: function () { cur = t.id; show(); } }, t.label));
      });
      DN.clear(body); list.filter(function (t) { return t.id === cur; })[0].mount(body);
    }
    root.append(bar, body); show();
  }
  function reg(a) { DN.apps.push(a); DN.cfg[a.id] = a; }

  /* ================= LEAVE & ATTENDANCE ================= */
  function used(empId, type) {
    return sum(DN.live("leave").filter(function (r) {
      return r.emp === empId && r.type === type && (r.status === "Approved" || r.status === "Pending") && (r.from || "").slice(0, 4) === yr();
    }), function (r) { return r.days; });
  }
  var leaveCfg = {
    id: "leave", col: "leave", noun: "Leave request", csvName: "leave", filter: mine, wide: true,
    fields: [
      { k: "emp", label: "Employee", ref: "employees", required: true, list: true, roles: MGR },
      { k: "type", label: "Leave type", type: "select", options: ["Casual", "Sick", "Earned", "Unpaid"], required: true, list: true },
      { k: "from", label: "From", type: "date", required: true, list: true },
      { k: "to", label: "To", type: "date", required: true, list: true },
      { k: "days", label: "Days", type: "number", list: true, hideInForm: true },
      { k: "reason", label: "Reason", type: "textarea" },
      { k: "status", label: "Status", list: true, pill: true, hideInForm: true }
    ],
    defaults: function () { return { emp: meId(), type: "Casual", from: DN.today(), to: DN.today() }; },
    canEdit: function (r) { return DN.can(HR_ONLY) || (r.emp === meId() && r.status === "Pending"); },
    sort: function (a, b) { return (b.from || "").localeCompare(a.from || ""); },
    beforeSave: function (r, isNew, old) {
      if (!DN.isMgr()) r.emp = meId();
      if (r.to < r.from) return "The end date is before the start date.";
      r.days = DN.leaveDays(r.from, r.to);
      if (r.days === 0) return "That range has no working days (Sundays aren't counted).";
      if (isNew) r.status = "Pending";
      var clash = DN.live("leave").filter(function (x) {
        return x.id !== r.id && x.emp === r.emp && (x.status === "Approved" || x.status === "Pending") && x.from <= r.to && x.to >= r.from;
      })[0];
      if (clash) return "This overlaps another request (" + DN.date(clash.from) + " to " + DN.date(clash.to) + ").";
      if (QUOTA[r.type]) {
        var left = QUOTA[r.type] - used(r.emp, r.type) + (old && old.type === r.type && old.status !== "Rejected" && old.status !== "Cancelled" ? +old.days || 0 : 0);
        if (r.days > left) return "Only " + left + " day(s) of " + r.type + " leave left this year. Choose Unpaid for the rest.";
      }
    },
    top: function (root) {
      var m = DN.me(); if (!m) return;
      var bal = h("div", { class: "bal" });
      Object.keys(QUOTA).forEach(function (t) { bal.append(h("div", null, h("b", null, QUOTA[t] - used(m.id, t)), t + " left")); });
      root.append(h("div", { class: "panel" }, h("div", { class: "grow" }, h("b", null, "Your balance, " + yr()), h("div", { class: "muted", style: "font-size:13px" }, "Sundays aren't counted. Unpaid leave reduces that month's pay.")), bal));
    },
    stats: function (rs) {
      var t = DN.today();
      return [{ l: "Pending approval", v: rs.filter(function (r) { return r.status === "Pending"; }).length, tone: "bad" },
        { l: "Away today", v: rs.filter(function (r) { return r.status === "Approved" && r.from <= t && r.to >= t; }).length },
        { l: "Approved this year", v: sum(rs.filter(function (r) { return r.status === "Approved" && (r.from || "").slice(0, 4) === yr(); }), function (r) { return r.days; }) + " days" }];
    },
    actions: [
      { label: "Approve", quick: true, when: function (r) { return r.status === "Pending" && DN.isMgr() && r.emp !== meId(); }, run: function (r, done) { DN.patch("leave", r.id, { status: "Approved", decidedBy: meId() }); DN.toast("Leave approved."); if (done) done(); } },
      { label: "Reject", quick: true, when: function (r) { return r.status === "Pending" && DN.isMgr() && r.emp !== meId(); }, run: function (r, done) { DN.patch("leave", r.id, { status: "Rejected", decidedBy: meId() }); if (done) done(); } },
      { label: "Cancel request", when: function (r) { return (r.status === "Pending" || r.status === "Approved") && r.emp === meId() && r.to >= DN.today(); }, run: function (r, done) { DN.patch("leave", r.id, { status: "Cancelled" }); if (done) done(); } }
    ]
  };

  var attCfg = {
    id: "attendance", col: "attendance", noun: "Attendance record", csvName: "attendance", filter: mine, canCreate: ["manager", "hr", "admin"],
    canEdit: function () { return DN.isMgr(); },
    fields: [
      { k: "emp", label: "Employee", ref: "employees", required: true, list: true },
      { k: "date", label: "Date", type: "date", required: true, list: true },
      { k: "in", label: "Check in", type: "time", list: true },
      { k: "out", label: "Check out", type: "time", list: true }
    ],
    extraCols: [{ label: "Hours", num: true, cell: function (r) { var x = DN.hoursBetween(r.in, r.out); return x ? x.toFixed(1) : ""; }, csv: function (r) { return DN.hoursBetween(r.in, r.out).toFixed(2); } }],
    defaults: function () { return { date: DN.today() }; },
    sort: function (a, b) { return (b.date || "").localeCompare(a.date || "") || (a.in || "").localeCompare(b.in || ""); },
    beforeSave: function (r, isNew) {
      if (r.in && r.out && r.out < r.in) return "Check-out is before check-in.";
      if (isNew && DN.live("attendance").some(function (x) { return x.emp === r.emp && x.date === r.date; })) return "There is already a record for that person on that date.";
    },
    top: function (root, redo) {
      var m = DN.me(); if (!m) return;
      var t = DN.today(), rec = DN.live("attendance").filter(function (r) { return r.emp === m.id && r.date === t; })[0];
      var msg = !rec ? "You haven't checked in today." : !rec.out ? "Checked in at " + rec.in + "." : "Checked in " + rec.in + ", out " + rec.out + " (" + DN.hoursBetween(rec.in, rec.out).toFixed(1) + " h).";
      var btn = !rec ? h("button", { class: "btn pri", onclick: function () { DN.insert("attendance", { emp: m.id, date: t, in: DN.hhmm(), out: "" }); redo(); } }, "Check in")
        : !rec.out ? h("button", { class: "btn pri", onclick: function () { DN.patch("attendance", rec.id, { out: DN.hhmm() }); redo(); } }, "Check out")
        : h("span", { class: "pill good" }, "Day complete");
      root.append(h("div", { class: "panel" }, h("div", { class: "grow" }, h("b", null, "Today, " + DN.date(t)), h("div", { class: "muted", style: "font-size:13px" }, msg)), btn));
    },
    stats: function (rs) {
      var t = DN.today(), mo = t.slice(0, 7), m = meId();
      var away = DN.live("leave").filter(function (r) { return r.status === "Approved" && r.from <= t && r.to >= t; }).length;
      var done = rs.filter(function (r) { return r.out && r.in; });
      return [{ l: "Present today", v: rs.filter(function (r) { return r.date === t; }).length }, { l: "On leave today", v: away },
        { l: "Your days this month", v: DN.live("attendance").filter(function (r) { return r.emp === m && r.date.slice(0, 7) === mo; }).length },
        { l: "Avg hours / day", v: done.length ? (sum(done, function (r) { return DN.hoursBetween(r.in, r.out); }) / done.length).toFixed(1) : "–" }];
    }
  };
  reg({ id: "leave", name: "Leave & Attendance", group: "People", mono: "LA", desc: "Apply for leave, approve, check in and out.",
    mount: function (root) {
      tabs(root, [{ id: "leave", label: "Leave", mount: function (b) { DN.engine(leaveCfg, b); } },
        { id: "att", label: "Attendance", mount: function (b) { DN.engine(attCfg, b); } }]);
    } });

  /* ================= PAYROLL ================= */
  function monthInfo(ym) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7), last = new Date(y, m, 0).getDate(), first = ym + "-01", end = ym + "-" + String(last).padStart(2, "0"), work = 0;
    for (var d = first; d <= end; d = DN.addDays(d, 1)) if (DN.parse(d).getDay() !== 0) work++;
    return { first: first, end: end, work: work };
  }
  function payFor(e, ym) {
    var mi = monthInfo(ym), gross = Math.round((+e.ctc || 0) / 12), basic = Math.round(gross * .5), hra = Math.round(basic * .4), special = gross - basic - hra;
    var lop = 0;
    DN.live("leave").forEach(function (l) {
      if (l.emp !== e.id || l.type !== "Unpaid" || l.status !== "Approved") return;
      var a = l.from > mi.first ? l.from : mi.first, b = l.to < mi.end ? l.to : mi.end;
      if (a <= b) lop += DN.leaveDays(a, b);
    });
    var lopAmt = Math.round(gross / mi.work * Math.min(lop, mi.work)), pf = Math.round(.12 * Math.min(basic, 15000));
    var ptCfg = +DN.settings().pt; var pt = gross > 25000 && isFinite(ptCfg) ? ptCfg : 0;
    return { emp: e.id, name: e.name, code: e.code, basic: basic, hra: hra, special: special, gross: gross, lopDays: lop, lop: lopAmt, pf: pf, pt: pt, net: gross - lopAmt - pf - pt };
  }
  function payslip(row, ym) {
    var s = DN.settings(), box = h("div"), mn = DN.parse(ym + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    var line = function (a, b) { return h("tr", null, h("td", null, a), h("td", { class: "num" }, DN.money(b))); };
    box.append(h("div", { class: "pr-h" }, h("div", null, h("h2", null, s.company || "Dotnapps"), h("div", null, s.address || "")), h("div", { style: "text-align:right" }, h("h2", null, "PAYSLIP"), h("div", null, mn))));
    box.append(h("p", null, h("b", null, row.name), " (" + (row.code || "") + ")"));
    box.append(h("table", null, h("thead", null, h("tr", null, h("th", null, "Earnings"), h("th", { class: "num" }, "₹"))),
      h("tbody", null, line("Basic", row.basic), line("House rent allowance", row.hra), line("Special allowance", row.special), line("Gross", row.gross))));
    box.append(h("table", { style: "margin-top:14px" }, h("thead", null, h("tr", null, h("th", null, "Deductions"), h("th", { class: "num" }, "₹"))),
      h("tbody", null, line("Loss of pay (" + row.lopDays + " day" + (row.lopDays === 1 ? "" : "s") + ")", row.lop), line("Provident fund (employee)", row.pf), line("Professional tax", row.pt))));
    box.append(h("div", { class: "pr-tot" }, h("div", { class: "g" }, h("span", null, "Net pay"), h("span", null, DN.money(row.net)))));
    box.append(h("p", { style: "margin-top:24px;font-size:11px" }, "Computer-generated payslip. Income tax (TDS) is not included."));
    DN.print(box);
  }
  reg({ id: "payroll", name: "Payroll", group: "People", mono: "PR", desc: "Monthly pay from CTC, leave and statutory basics.", roles: HR_ONLY,
    mount: function (root) {
      if (!DN.can(HR_ONLY)) { root.append(h("div", { class: "demo-bar" }, "Payroll is limited to HR and Admin.")); return; }
      var ym = DN.today().slice(0, 7), host = h("div");
      root.append(h("div", { class: "demo-bar" }, "Estimate only: salary split is 50% basic, HRA 40% of basic, PF 12% of basic capped at ₹15,000, professional tax from Company details (applies above ₹25,000 gross). No TDS, ESI or bonus. Check with your accountant before paying anyone."), host);
      function draw() {
        DN.clear(host);
        var run = DN.live("payruns").filter(function (p) { return p.month === ym; })[0];
        var rows = run ? run.rows : DN.live("employees").filter(function (e) { return e.status !== "Exited" && +e.ctc > 0; }).map(function (e) { return payFor(e, ym); });
        var bar = h("div", { class: "bar" }, h("input", { type: "month", value: ym, style: "width:auto", "aria-label": "Pay month", onchange: function (e) { if (e.target.value) { ym = e.target.value; draw(); } } }),
          run ? h("span", { class: "pill good" }, "Finalised " + DN.date(DN.iso(new Date(run.ts)))) : h("span", { class: "pill warn" }, "Draft"), h("span", { class: "grow" }));
        bar.append(h("button", { class: "btn", onclick: function () {
          DN.csv("payroll-" + ym + ".csv", [["Code", "Employee", "Basic", "HRA", "Special", "Gross", "LOP days", "LOP", "PF", "PT", "Net"]].concat(rows.map(function (r) { return [r.code, r.name, r.basic, r.hra, r.special, r.gross, r.lopDays, r.lop, r.pf, r.pt, r.net]; })));
        } }, "Export CSV"));
        if (run) { if (DN.role() === "admin") bar.append(h("button", { class: "btn danger", onclick: function () { DN.patch("payruns", run.id, { archived: true }); DN.toast("Month reopened."); draw(); } }, "Reopen")); }
        else bar.append(h("button", { class: "btn pri", disabled: !rows.length, onclick: function () {
          if (!confirm("Finalise payroll for " + ym + "? The figures are frozen as a snapshot.")) return;
          DN.insert("payruns", { month: ym, rows: rows, by: meId(), ts: Date.now() }); draw();
        } }, "Finalise month"));
        host.append(bar);
        host.append(h("div", { class: "tiles" },
          h("div", { class: "tile" }, h("div", { class: "v" }, DN.money(sum(rows, function (r) { return r.net; }))), h("div", { class: "l" }, "Net payable")),
          h("div", { class: "tile" }, h("div", { class: "v" }, DN.money(sum(rows, function (r) { return r.gross; }))), h("div", { class: "l" }, "Gross")),
          h("div", { class: "tile" }, h("div", { class: "v" }, rows.length), h("div", { class: "l" }, "Employees"))));
        if (!rows.length) { host.append(h("div", { class: "tbl-wrap" }, h("div", { class: "empty" }, "No employees with a CTC. Add CTC in HRM."))); return; }
        var tb = h("tbody");
        rows.forEach(function (r) {
          tb.append(h("tr", null, h("td", null, r.name), h("td", { class: "num" }, DN.money(r.gross)), h("td", { class: "num" }, r.lopDays), h("td", { class: "num" }, DN.money(r.lop)),
            h("td", { class: "num" }, DN.money(r.pf)), h("td", { class: "num" }, DN.money(r.pt)), h("td", { class: "num" }, h("b", null, DN.money(r.net))),
            h("td", { class: "acts" }, h("button", { class: "btn sm", onclick: function () { payslip(r, ym); } }, "Payslip"))));
        });
        var th = function (t) { return h("th", { class: t === "Employee" ? "" : "num" }, t); };
        host.append(h("div", { class: "tbl-wrap" }, h("table", null, h("thead", null, h("tr", null, ["Employee", "Gross", "LOP days", "LOP", "PF", "PT", "Net"].map(th), h("th"))), tb)));
      }
      draw();
    } });

  /* ================= CHAT ================= */
  reg({ id: "chat", name: "Chat", group: "Work", mono: "CH", desc: "Team channels, built in.",
    mount: function (root) {
      var cur = "general", wrap = h("div");
      root.append(h("div", { class: "demo-bar" }, "Demo chat: messages are stored in this browser only, so colleagues on other computers won't see them until Chat is connected to the Business OS backend."), wrap);
      function draw() {
        DN.clear(wrap);
        var chs = DN.col("channels"), list = h("div", { class: "chs" });
        chs.forEach(function (c) { list.append(h("button", { "aria-current": c.id === cur, onclick: function () { cur = c.id; draw(); } }, "# " + c.name)); });
        if (DN.isMgr()) list.append(h("button", { class: "muted", onclick: function () {
          var n = (prompt("New channel name") || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
          if (!n) return;
          if (chs.some(function (c) { return c.name === n; })) { DN.toast("That channel exists."); return; }
          cur = DN.insert("channels", { name: n }).id; draw();
        } }, "+ New channel"));
        var msgs = h("div", { class: "msgs", tabindex: 0, "aria-live": "polite" });
        DN.col("messages").filter(function (m) { return m.ch === cur; }).sort(function (a, b) { return a.ts - b.ts; }).slice(-200).forEach(function (m) {
          msgs.append(h("div", { class: "msg" }, h("b", null, DN.nm(m.from) || "Unknown", h("small", null, new Date(m.ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }))), h("p", null, m.text)));
        });
        if (!msgs.children.length) msgs.append(h("div", { class: "muted" }, "No messages in #" + cur + " yet."));
        var input = h("input", { placeholder: "Message #" + cur, maxlength: 2000, "aria-label": "Message", autocomplete: "off" });
        var form = h("form", { onsubmit: function (e) {
          e.preventDefault(); var t = input.value.trim(); if (!t || !DN.me()) return;
          DN.insert("messages", { ch: cur, from: DN.me().id, ts: Date.now(), text: t }); draw();
        } }, input, h("button", { class: "btn pri", type: "submit" }, "Send"));
        wrap.append(h("div", { class: "chat" }, list, h("div", { class: "conv" }, msgs, form)));
        msgs.scrollTop = msgs.scrollHeight;
      }
      DN.onExternalChange = draw; draw();
    } });

  /* ================= CALENDAR ================= */
  var HOLIDAYS = { "01-26": "Republic Day", "05-01": "Maharashtra / Labour Day", "08-15": "Independence Day", "10-02": "Gandhi Jayanti", "12-25": "Christmas" };
  reg({ id: "calendar", name: "Calendar", group: "Work", mono: "CL", desc: "Events, leave, task deadlines and contract dates in one view.",
    mount: function (root) {
      var now = new Date(), cursor = new Date(now.getFullYear(), now.getMonth(), 1), sel = DN.today(), host = h("div");
      root.append(host);
      function itemsOn(d) {
        var out = [], hol = HOLIDAYS[d.slice(5)];
        if (hol) out.push({ k: "holiday", t: hol });
        DN.live("events").forEach(function (e) { if (e.date === d) out.push({ k: "event", t: e.title, rec: e }); });
        DN.live("leave").forEach(function (l) { if (l.status === "Approved" && l.from <= d && l.to >= d && DN.parse(d).getDay() !== 0) out.push({ k: "leave", t: DN.nm(l.emp) + " on leave" }); });
        DN.live("tasks").forEach(function (t) { if (t.due === d && t.status !== "Done") out.push({ k: "task", t: "Due: " + t.title }); });
        if (DN.isMgr()) DN.live("contracts").forEach(function (c) { if (c.end === d && c.status === "Signed") out.push({ k: "contract", t: "Contract ends: " + c.title }); });
        return out;
      }
      function editEvent(e, date) {
        DN.form({ title: e ? "Edit event" : "New event", values: e || { date: date, kind: "Meeting" }, saveLabel: e ? "Save" : "Create",
          fields: [{ k: "title", label: "Title", required: true, full: true }, { k: "date", label: "Date", type: "date", required: true },
            { k: "kind", label: "Kind", type: "select", options: ["Meeting", "Reminder", "Event", "Deadline"], required: true }, { k: "notes", label: "Notes", type: "textarea" }],
          onSave: function (v) { if (e) DN.patch("events", e.id, v); else DN.insert("events", v); sel = v.date; draw(); },
          onArchive: e ? function () { DN.patch("events", e.id, { archived: true }); draw(); } : null });
      }
      function draw() {
        DN.clear(host);
        var label = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
        host.append(h("div", { class: "cal-h" },
          h("button", { class: "btn sm", "aria-label": "Previous month", onclick: function () { cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1); draw(); } }, "‹"),
          h("h3", null, label),
          h("button", { class: "btn sm", "aria-label": "Next month", onclick: function () { cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1); draw(); } }, "›"),
          h("button", { class: "btn sm", onclick: function () { cursor = new Date(now.getFullYear(), now.getMonth(), 1); sel = DN.today(); draw(); } }, "Today"),
          h("span", { style: "flex:1" }), h("button", { class: "btn pri", onclick: function () { editEvent(null, sel); } }, "+ New event")));
        var grid = h("div", { class: "cal" });
        ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(function (d) { grid.append(h("div", { class: "dow" }, d)); });
        var first = new Date(cursor.getFullYear(), cursor.getMonth(), 1), lead = (first.getDay() + 6) % 7, start = new Date(first); start.setDate(1 - lead);
        for (var i = 0; i < 42; i++) {
          var dt = new Date(start); dt.setDate(start.getDate() + i); var iso = DN.iso(dt), its = itemsOn(iso);
          (function (iso) {
            var b = h("button", { class: "day" + (dt.getMonth() !== cursor.getMonth() ? " off" : "") + (iso === DN.today() ? " today" : "") + (iso === sel ? " sel" : ""),
              "aria-label": DN.date(iso) + ", " + its.length + " item" + (its.length === 1 ? "" : "s"), onclick: function () { sel = iso; draw(); } },
              h("span", { class: "dn" }, dt.getDate()));
            its.slice(0, 3).forEach(function (x) { b.append(h("span", { class: "chip " + x.k }, x.t)); });
            if (its.length > 3) b.append(h("span", { class: "more" }, "+" + (its.length - 3) + " more"));
            if (its.length) b.append(h("span", { class: "dot" }, "● " + its.length));
            grid.append(b);
          })(iso);
        }
        host.append(grid);
        var day = itemsOn(sel), dl = h("div", { class: "daylist" }, h("h4", { style: "margin:14px 0 0" }, DN.date(sel)));
        if (!day.length) dl.append(h("div", { class: "muted" }, "Nothing scheduled."));
        day.forEach(function (x) {
          dl.append(h("div", { class: "row" }, h("span", { class: "chip " + x.k, style: "flex:none" }, x.k), h("span", { style: "flex:1" }, x.t),
            x.rec ? h("button", { class: "btn sm", onclick: function () { editEvent(x.rec); } }, "Edit") : null));
        });
        host.append(dl);
      }
      draw();
    } });

  /* app order for the sidebar / home */
  var ORDER = ["crm", "sales", "contracts", "hrm", "recruitment", "leave", "payroll", "timesheets", "performance", "tasks", "chat", "calendar", "documents", "kb"];
  DN.apps.sort(function (a, b) { return ORDER.indexOf(a.id) - ORDER.indexOf(b.id); });
})();
