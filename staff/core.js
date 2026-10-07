/* Dotnapps staff portal — core: store, session, UI helpers, record engine.
   No build step, no dependencies. All user text is rendered with textContent
   (never innerHTML), so stored records can't inject markup.

   DATA LIVES IN THIS BROWSER (localStorage) until the apps are wired to the
   Business OS backend. See staff/README.md. */
(function () {
  "use strict";
  var DN = (window.DN = { apps: [], cfg: {} });
  var KEY = "dn.staff.v2", ME_KEY = "dn.staff.me";
  var db = null;

  /* ---------- tiny DOM helper ---------- */
  var SVG = { svg: 1, path: 1 };
  function h(tag, attrs) {
    var e = SVG[tag] ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag), a = attrs || {}, k;
    for (k in a) {
      var v = a[k];
      if (v == null || v === false || k === "value" || k === "checked") continue;
      if (k === "class") e.className = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    if (a.value != null) e.value = a.value;
    if (a.checked) e.checked = true;
    return e;
  }
  function add(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(e, x); });
    else e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  DN.h = h;
  DN.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* ---------- formatting ---------- */
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  DN.iso = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  DN.today = function () { return DN.iso(new Date()); };
  DN.parse = function (s) { return new Date(s + "T00:00:00"); };
  DN.addDays = function (s, n) { var d = DN.parse(s); d.setDate(d.getDate() + n); return DN.iso(d); };
  DN.daysBetween = function (a, b) { return Math.round((DN.parse(b) - DN.parse(a)) / 864e5); };
  DN.date = function (s) {
    if (!s) return "";
    var d = DN.parse(s);
    return isNaN(d) ? s : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };
  DN.money = function (v) {
    var n = Number(v);
    if (!isFinite(n)) n = 0;
    return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  };
  DN.hhmm = function () { var d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  DN.hoursBetween = function (a, b) {
    if (!a || !b) return 0;
    var p = function (t) { var x = t.split(":"); return +x[0] * 60 + +x[1]; };
    return Math.max(0, (p(b) - p(a)) / 60);
  };
  DN.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };

  /* ---------- store ---------- */
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { DN.toast("Browser storage is full or blocked, so changes will not be kept."); }
  }
  DN.load = function () {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || typeof db !== "object") { db = DN.seed(); save(); }
    if (!db.settings) db.settings = {};
  };
  DN.dump = function () { return db; };
  DN.isDemo = function () { return !!db.demo; };
  DN.replaceAll = function (data) { db = data; save(); };
  DN.col = function (c) { return db[c] || (db[c] = []); };
  DN.live = function (c) { return DN.col(c).filter(function (r) { return !r.archived; }); };
  DN.get = function (c, id) { return DN.col(c).filter(function (r) { return r.id === id; })[0]; };
  DN.insert = function (c, rec) { rec.id = DN.uid(); rec.created = Date.now(); DN.col(c).push(rec); save(); return rec; };
  DN.patch = function (c, id, p) { var r = DN.get(c, id); if (r) { Object.assign(r, p); save(); } return r; };
  DN.settings = function () { return db.settings; };
  DN.setSettings = function (p) { Object.assign(db.settings, p); save(); };
  DN.nextNo = function (prefix, c, field) {
    var n = DN.col(c).reduce(function (m, r) {
      var s = String(r[field] || ""), x = s.indexOf(prefix) === 0 ? parseInt(s.slice(prefix.length), 10) : 0;
      return x > m ? x : m;
    }, 0) + 1;
    return prefix + String(n).padStart(4, "0");
  };
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) { DN.load(); if (DN.onExternalChange) DN.onExternalChange(); }
  });

  /* ---------- session / roles ----------
     "Signed in as" is a demo picker, NOT security: anyone can switch it.
     Real access control must come from the Business OS backend. */
  DN.me = function () {
    var id = null;
    try { id = localStorage.getItem(ME_KEY); } catch (e) {}
    var e = id && DN.get("employees", id);
    if (!e || e.archived) e = DN.live("employees")[0];
    return e || null;
  };
  DN.setMe = function (id) { try { localStorage.setItem(ME_KEY, id); } catch (e) {} };
  DN.role = function () { var m = DN.me(); return m ? String(m.access || "Staff").toLowerCase() : "staff"; };
  DN.can = function (roles) { return !roles || roles.indexOf(DN.role()) > -1; };
  DN.isMgr = function () { return DN.can(["manager", "hr", "admin"]); };
  DN.nm = function (id) { var e = id && DN.get("employees", id); return e ? e.name : (id ? "(removed)" : ""); };
  DN.refOptions = function (c) {
    if (c === "employees") return DN.empOptions();
    return DN.live(c).map(function (r) { return { v: r.id, l: r.name || r.title || "(unnamed)" }; })
      .sort(function (a, b) { return a.l.localeCompare(b.l); });
  };
  DN.refName = function (c, id) {
    if (c === "employees") return DN.nm(id);
    var r = id && DN.get(c, id);
    return r ? (r.name || r.title || "") : (id ? "(removed)" : "");
  };
  DN.empOptions = function () {
    return DN.live("employees").filter(function (e) { return e.status !== "Exited"; })
      .map(function (e) { return { v: e.id, l: e.name }; });
  };

  /* ---------- toast / csv ---------- */
  var tt;
  DN.toast = function (msg) {
    var t = document.getElementById("toast");
    if (!t) { t = h("div", { id: "toast", class: "toast", role: "status" }); document.body.append(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(tt); tt = setTimeout(function () { t.hidden = true; }, 3200);
  };
  DN.csv = function (name, rows) {
    var out = rows.map(function (r) {
      return r.map(function (c) {
        var s = c == null ? "" : String(c);
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;         // block spreadsheet formula injection
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(",");
    }).join("\n");
    var a = h("a", { href: URL.createObjectURL(new Blob(["﻿" + out], { type: "text/csv" })), download: name });
    document.body.append(a); a.click(); a.remove();
  };

  /* ---------- dialog ---------- */
  DN.dialog = function (title, body, footer, opts) {
    var d = h("dialog", { class: opts && opts.wide ? "wide" : "" });
    var close = function () { d.close(); };
    d.append(h("div", { class: "dlg" },
      h("div", { class: "dlg-h" }, h("h3", null, title),
        h("button", { class: "btn sm", type: "button", "aria-label": "Close", onclick: close }, "✕")),
      body, footer));
    d.addEventListener("close", function () { d.remove(); });
    document.body.append(d); d.showModal();
    return d;
  };

  /* ---------- fields / forms ---------- */
  function visibleField(f) { return DN.can(f.roles); }
  DN.optionsOf = function (f) {
    if (f.ref) return DN.refOptions(f.ref);
    return (typeof f.options === "function" ? f.options() : f.options || []).map(function (o) { return typeof o === "object" ? o : { v: o, l: o }; });
  };
  DN.fmt = function (f, rec) {
    var v = rec[f.k];
    if (f.get) return f.get(rec);
    if (v == null || v === "") return "";
    if (f.type === "money") return DN.money(v);
    if (f.type === "date") return DN.date(v);
    if (f.ref) return DN.refName(f.ref, v);
    if (typeof f.options === "function") { var o = f.options().filter(function (x) { return (x.v || x) === v; })[0]; return o ? (o.l || o) : String(v); }
    if (f.type === "addresses") return (v || []).map(function (a) { return a.city || a.line1 || ""; }).filter(Boolean).join("; ");
    if (f.type === "bool") return v ? "Yes" : "No";
    return String(v);
  };
  DN.linesTotals = function (rec) {
    var sub = (rec.lines || []).reduce(function (s, l) { return s + (+l.q || 0) * (+l.r || 0); }, 0);
    var tax = sub * (+rec.gst || 0) / 100;
    return { sub: sub, tax: tax, total: sub + tax };
  };

  function control(f, v) {
    var t = f.type || "text", el;
    if (f.ref || t === "select") {
      el = h("select", { name: f.k, required: !!f.required });
      if (!f.required || f.ref) el.append(h("option", { value: "" }, f.ref ? "— choose —" : "—"));
      DN.optionsOf(f).forEach(function (o) { el.append(h("option", { value: o.v }, o.l)); });
      el.value = v == null ? "" : v;
      if (!f.ref && f.required && !el.value && el.options.length) el.selectedIndex = 0;
      return { el: el, get: function () { return el.value; } };
    }
    if (t === "textarea") {
      el = h("textarea", { name: f.k, required: !!f.required, value: v || "" });
      return { el: el, get: function () { return el.value.trim(); } };
    }
    if (t === "bool") {
      el = h("input", { type: "checkbox", name: f.k, checked: !!v });
      return { el: el, get: function () { return el.checked; } };
    }
    if (t === "lines") return linesControl(v);
    if (t === "addresses") return addressesControl(v);
    var type = { money: "number", number: "number", date: "date", time: "time", url: "url", email: "email", tel: "tel" }[t] || "text";
    el = h("input", { type: type, name: f.k, required: !!f.required, value: v == null ? "" : v,
      step: type === "number" ? "any" : null, min: type === "number" ? (f.min != null ? f.min : 0) : null,
      max: f.max, pattern: f.pattern, title: f.patternHelp, maxlength: type === "text" ? 200 : null });
    return { el: el, get: function () {
      if (type === "number") return el.value === "" ? "" : Number(el.value);
      return el.value.trim();
    } };
  }
  function addressesControl(v) {
    var box = h("div", { class: "lines" }), rows = [];
    var ph = { line1: "Address line 1", line2: "Line 2", city: "City", state: "State", postal: "PIN code", country: "Country" };
    function addRow(a) {
      var kind = h("select", null, ["Billing", "Shipping", "Other"].map(function (k) { return h("option", { value: k }, k); }));
      kind.value = a.kind || "Billing";
      var inp = {}; Object.keys(ph).forEach(function (k) { inp[k] = h("input", { placeholder: ph[k], value: a[k] || "", maxlength: 120 }); });
      var row = { kind: kind, inp: inp };
      row.el = h("div", { style: "display:grid;gap:6px;padding:10px;border:1px solid var(--hairline);border-radius:12px" },
        h("div", { style: "display:flex;gap:6px" }, kind, h("span", { style: "flex:1" }), h("button", { type: "button", class: "btn sm", onclick: function () { rows.splice(rows.indexOf(row), 1); row.el.remove(); } }, "Remove")),
        inp.line1, inp.line2, h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:6px" }, inp.city, inp.state), h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:6px" }, inp.postal, inp.country));
      rows.push(row); box.insertBefore(row.el, addBtn);
    }
    var addBtn = h("button", { type: "button", class: "btn sm", onclick: function () { addRow({}); } }, "+ Add address");
    box.append(addBtn); (v || []).forEach(addRow);
    return { el: box, get: function () {
      return rows.map(function (r) { var o = { kind: r.kind.value }; Object.keys(r.inp).forEach(function (k) { o[k] = r.inp[k].value.trim(); }); return o; })
        .filter(function (a) { return a.line1 || a.city || a.postal; });
    } };
  }
  function linesControl(v) {
    var box = h("div", { class: "lines" }), rows = [];
    function addRow(l) {
      var d = h("input", { placeholder: "Description", value: l.d || "", maxlength: 200 });
      var q = h("input", { type: "number", min: 0, step: "any", placeholder: "Qty", value: l.q == null ? 1 : l.q });
      var r = h("input", { type: "number", min: 0, step: "any", placeholder: "Rate", value: l.r == null ? "" : l.r });
      var row = { d: d, q: q, r: r };
      var x = h("button", { type: "button", class: "btn sm", "aria-label": "Remove line", onclick: function () {
        rows.splice(rows.indexOf(row), 1); row.el.remove(); upd();
      } }, "✕");
      row.el = h("div", { class: "ln" }, d, q, r, x);
      [q, r].forEach(function (i) { i.addEventListener("input", upd); });
      rows.push(row); box.insertBefore(row.el, tot);
    }
    var tot = h("div", { class: "tot" });
    function upd() {
      var s = rows.reduce(function (a, r) { return a + (+r.q.value || 0) * (+r.r.value || 0); }, 0);
      tot.textContent = "Subtotal " + DN.money(s);
    }
    box.append(tot);
    box.append(h("button", { type: "button", class: "btn sm", onclick: function () { addRow({}); } }, "+ Add line"));
    (v && v.length ? v : [{}]).forEach(addRow); upd();
    return { el: box, get: function () {
      return rows.map(function (r) { return { d: r.d.value.trim(), q: +r.q.value || 0, r: +r.r.value || 0 }; })
        .filter(function (l) { return l.d || l.r; });
    } };
  }

  /* Opens a form. opts: {title, fields, values, onSave(values)->false|string to block, actions:[{label,run}], onArchive} */
  DN.form = function (opts) {
    var fields = opts.fields.filter(function (f) { return visibleField(f) && !(f.createOnly && !opts.isNew); }), ctl = {};
    var form = h("form", { class: "dlg-b", id: "f" + DN.uid(), novalidate: false });
    fields.forEach(function (f) {
      if (f.hideInForm) return;
      var c = control(f, opts.values[f.k]);
      ctl[f.k] = c;
      form.append(h("div", { class: "fld" + (f.type === "textarea" || f.type === "lines" || f.full ? " full" : "") },
        h("label", null, f.label + (f.required ? " *" : "")), c.el, f.hint ? h("span", { class: "hint" }, f.hint) : null));
    });
    var dlg;
    function collect() {
      var out = {};
      Object.keys(ctl).forEach(function (k) { out[k] = ctl[k].get(); });
      return out;
    }
    var foot = h("div", { class: "dlg-f" });
    (opts.actions || []).forEach(function (a) {
      foot.append(h("button", { type: "button", class: "btn", onclick: function () { if (a.run(collect(), dlg) !== false) dlg.close(); } }, a.label));
    });
    foot.append(h("span", { class: "grow" }));
    if (opts.onArchive) foot.append(h("button", { type: "button", class: "btn danger", onclick: function () { opts.onArchive(); dlg.close(); } }, opts.archiveLabel || "Archive"));
    foot.append(h("button", { type: "button", class: "btn", onclick: function () { dlg.close(); } }, "Cancel"));
    foot.append(h("button", { type: "submit", class: "btn pri", form: form.id }, opts.saveLabel || "Save"));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var r = opts.onSave(collect());
      if (typeof r === "string") { DN.toast(r); return; }
      if (r !== false) dlg.close();
    });
    var body = form;
    if (opts.extra) { body = h("div", { class: "dlg-scroll" }, form, opts.extra); form.classList.add("noscroll"); }
    dlg = DN.dialog(opts.title, body, foot, { wide: opts.wide });
    return dlg;
  };

  /* Read-only article view (markdown-lite: "# heading", "- bullet", blank-line paragraphs). */
  DN.read = function (title, text, actions) {
    var body = h("div", { class: "dlg-b" }), wrap = h("div", { class: "read" }), list = null;
    String(text || "").split(/\n/).forEach(function (line) {
      if (/^# /.test(line)) { list = null; wrap.append(h("h4", null, line.slice(2))); }
      else if (/^- /.test(line)) { if (!list) { list = h("ul"); wrap.append(list); } list.append(h("li", null, line.slice(2))); }
      else if (line.trim()) { list = null; wrap.append(h("p", null, line)); }
      else list = null;
    });
    body.append(wrap);
    var dlg, foot = h("div", { class: "dlg-f" }, h("span", { class: "grow" }));
    (actions || []).forEach(function (a) { foot.append(h("button", { type: "button", class: "btn", onclick: function () { dlg.close(); a.run(); } }, a.label)); });
    foot.append(h("button", { type: "button", class: "btn pri", onclick: function () { dlg.close(); } }, "Close"));
    dlg = DN.dialog(title, body, foot);
  };

  DN.print = function (node) {
    var p = document.getElementById("printarea");
    if (!p) { p = h("div", { id: "printarea" }); document.body.append(p); }
    DN.clear(p).append(node);
    window.print();
  };

  /* ---------- record engine ----------
     A = {id, col, fields, board?, stats?, extraCols?, actions?, filter?, canCreate?,
          defaults?, beforeSave?, afterSave?, open?, noun, csvName} */
  var TONES = { good: ["Won", "Signed", "Approved", "Paid", "Done", "Hired", "Active", "Accepted", "Acknowledged"],
                bad: ["Lost", "Rejected", "Expired", "Terminated", "Exited", "Cancelled", "Overdue"],
                warn: ["Pending", "Sent", "Sent for signature", "Offer", "On notice", "Submitted", "In review", "Draft"] };
  DN.pill = function (txt) {
    var tone = "";
    Object.keys(TONES).forEach(function (t) { if (TONES[t].indexOf(txt) > -1) tone = t; });
    return h("span", { class: "pill " + tone }, txt);
  };

  DN.engine = function (A, root) {
    var st = { q: "", view: A.board ? "board" : "table", arch: false, f: {}, preset: 0 };
    var fields = A.fields.filter(visibleField);

    function rows() {
      var q = st.q.toLowerCase();
      return DN.col(A.col).filter(function (r) {
        if (!!r.archived !== st.arch) return false;
        if (A.filter && !A.filter(r)) return false;
        if (A.presets && A.presets[st.preset].test && !A.presets[st.preset].test(r)) return false;
        for (var i = 0; i < (A.filters || []).length; i++) { var fl = A.filters[i], fv = st.f[i]; if (fv && !fl.test(r, fv)) return false; }
        if (!q) return true;
        return fields.some(function (f) { return String(DN.fmt(f, r)).toLowerCase().indexOf(q) > -1; });
      }).sort(A.sort || function (a, b) { return b.created - a.created; });
    }
    function cols() {
      var c = fields.filter(function (f) { return f.list; }).map(function (f) {
        return { label: f.label, num: f.type === "money" || f.type === "number", cell: function (r) {
          var t = DN.fmt(f, r);
          return f.pill && t ? DN.pill(t) : t;
        }, csv: function (r) { return DN.fmt(f, r); } };
      });
      return c.concat((A.extraCols || []).filter(function (x) { return !x.roles || DN.can(x.roles); }));
    }
    function editable(r) { return !A.canEdit || A.canEdit(r); }

    function openRec(r) {
      var edit = function () {
        if (!editable(r)) { DN.toast("You don't have permission to edit this record."); return; }
        showForm(r, false);
      };
      if (A.open) A.open(r, edit, render); else edit();
    }
    function showForm(rec, isNew) {
      var actions = [];
      if (!isNew) (A.actions || []).forEach(function (a) {
        if (a.when && !a.when(rec)) return;
        actions.push({ label: a.label, run: function () { var res = a.run(rec, render); render(); return res; } });
      });
      DN.form({
        title: (isNew ? "New " : "Edit ") + A.noun, fields: A.fields, values: rec, wide: A.wide, actions: actions, isNew: isNew,
        extra: !isNew && A.extra ? A.extra(rec) : null,
        saveLabel: isNew ? "Create" : "Save",
        onSave: function (vals) {
          var next = Object.assign({}, rec, vals);
          if (A.beforeSave) { var err = A.beforeSave(next, isNew, rec); if (typeof err === "string") return err; }
          if (isNew) DN.insert(A.col, next); else DN.patch(A.col, rec.id, next);
          if (A.afterSave) A.afterSave(next, isNew);
          render();
        },
        onArchive: isNew ? null : function () { DN.patch(A.col, rec.id, { archived: true }); DN.toast(A.noun + " archived."); render(); }
      });
    }
    function create(extra) {
      if (A.canCreate && !DN.can(A.canCreate)) { DN.toast("Only " + A.canCreate.join(", ") + " can add this."); return; }
      showForm(Object.assign({}, A.defaults ? A.defaults() : {}, extra || {}), true);
    }
    DN.engineCreate = create;

    function table(list) {
      var c = cols();
      var thead = h("tr", null, c.map(function (x) { return h("th", { class: x.num ? "num" : "" }, x.label); }), h("th"));
      var quick = (A.actions || []).filter(function (a) { return a.quick; });
      var body = h("tbody");
      list.forEach(function (r) {
        var tr = h("tr", { class: "click", tabindex: 0, onclick: function () { openRec(r); },
          onkeydown: function (e) { if (e.key === "Enter") openRec(r); } },
          c.map(function (x) { return h("td", { class: x.num ? "num" : "" }, x.cell(r)); }));
        var td = h("td", { class: "acts" });
        if (st.arch) td.append(h("button", { class: "btn sm", onclick: function (e) { e.stopPropagation(); DN.patch(A.col, r.id, { archived: false }); render(); } }, "Restore"));
        else quick.forEach(function (a) {
          if (a.when && !a.when(r)) return;
          td.append(h("button", { class: "btn sm", onclick: function (e) { e.stopPropagation(); a.run(r, render); } }, a.label));
        });
        tr.append(td); body.append(tr);
      });
      return h("div", { class: "tbl-wrap" }, h("table", null, h("thead", null, thead), body));
    }
    function board(list) {
      var bf = A.fields.filter(function (f) { return f.k === A.board; })[0];
      var wrap = h("div", { class: "board" });
      DN.optionsOf(bf).forEach(function (o) {
        var items = list.filter(function (r) { return r[A.board] === o.v; });
        var col = h("div", { class: "col",
          ondragover: function (e) { e.preventDefault(); col.classList.add("over"); },
          ondragleave: function () { col.classList.remove("over"); },
          ondrop: function (e) {
            e.preventDefault(); col.classList.remove("over");
            var id = e.dataTransfer.getData("text/plain"), rec = DN.get(A.col, id);
            if (rec && rec[A.board] !== o.v && editable(rec)) {
              var next = Object.assign({}, rec); next[A.board] = o.v;
              if (A.beforeSave) { var err = A.beforeSave(next, false, rec); if (typeof err === "string") { DN.toast(err); return; } }
              DN.patch(A.col, id, next); render();
            }
          } }, h("h4", null, o.l, h("span", null, items.length)));
        items.forEach(function (r) {
          var card = h("div", { class: "kcard", draggable: "true", tabindex: 0,
            ondragstart: function (e) { e.dataTransfer.setData("text/plain", r.id); },
            onclick: function () { openRec(r); }, onkeydown: function (e) { if (e.key === "Enter") openRec(r); } },
            h("b", null, A.cardTitle(r)));
          (A.cardSub ? A.cardSub(r) : []).forEach(function (s) { if (s) card.append(h("small", null, s)); });
          col.append(card);
        });
        wrap.append(col);
      });
      return wrap;
    }

    function render() {
      DN.clear(root);
      if (A.top) A.top(root, render);
      var list = rows(), live = DN.live(A.col).filter(function (r) { return !A.filter || A.filter(r); });
      if (A.stats && !st.arch) {
        root.append(h("div", { class: "tiles" }, A.stats(live).map(function (s) {
          return h("div", { class: "tile " + (s.tone || "") }, h("div", { class: "v" }, s.v), h("div", { class: "l" }, s.l));
        })));
      }
      var bar = h("div", { class: "bar" });
      bar.append(h("input", { class: "search", type: "search", placeholder: "Search " + A.noun.toLowerCase() + "s…", value: st.q,
        "aria-label": "Search", oninput: function (e) { st.q = e.target.value; var p = e.target.selectionStart; render(); var s = root.querySelector(".search"); s.focus(); s.setSelectionRange(p, p); } }));
      if (A.presets) bar.append(h("div", { class: "seg", role: "group", "aria-label": "Show" }, A.presets.map(function (pr, i) {
        return h("button", { type: "button", "aria-pressed": st.preset === i, onclick: function () { st.preset = i; render(); } }, pr.label);
      })));
      (A.filters || []).forEach(function (fl, i) {
        var sel = h("select", { class: "flt", "aria-label": fl.label, onchange: function (e) { st.f[i] = e.target.value; render(); } }, h("option", { value: "" }, "All " + fl.label.toLowerCase()));
        (typeof fl.options === "function" ? fl.options() : fl.options).forEach(function (o) { var v = o.v || o, l = o.l || o; sel.append(h("option", { value: v }, l)); });
        sel.value = st.f[i] || ""; bar.append(sel);
      });
      if (A.board) bar.append(h("div", { class: "seg", role: "group", "aria-label": "View" },
        ["board", "table"].map(function (v) { return h("button", { type: "button", "aria-pressed": st.view === v, onclick: function () { st.view = v; render(); } }, v === "board" ? "Board" : "List"); })));
      bar.append(h("span", { class: "grow" }));
      bar.append(h("label", { class: "muted", style: "font-size:13px;display:flex;gap:6px;align-items:center" },
        h("input", { type: "checkbox", checked: st.arch, onchange: function (e) { st.arch = e.target.checked; render(); } }), "Archived"));
      bar.append(h("button", { class: "btn", type: "button", onclick: exportCsv }, "Export CSV"));
      if (!A.canCreate || DN.can(A.canCreate)) bar.append(h("button", { class: "btn pri", type: "button", onclick: function () { create(); } }, "+ New " + A.noun.toLowerCase()));
      root.append(bar);
      if (!list.length) root.append(h("div", { class: "tbl-wrap" }, h("div", { class: "empty" }, st.arch ? "Nothing archived." : (st.q ? "No matches." : "No " + A.noun.toLowerCase() + "s yet."))));
      else root.append(A.board && st.view === "board" && !st.arch ? board(list) : table(list));
    }
    function exportCsv() {
      var c = cols(), list = rows();
      DN.csv((A.csvName || A.id) + "-" + DN.today() + ".csv", [c.map(function (x) { return x.label; })].concat(list.map(function (r) {
        return c.map(function (x) { var v = x.csv ? x.csv(r) : x.cell(r); return v && v.nodeType ? v.textContent : v; });
      })));
    }
    render();
    return { render: render, create: create };
  };
})();
