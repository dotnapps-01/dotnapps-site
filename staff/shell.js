/* Dotnapps staff portal — per-app shell. Each app page sets <body data-app="id">
   and gets its own header, sign-in switcher and data tools. There is no combined
   dashboard: every app is opened, bookmarked and deployed on its own URL. */
(function () {
  "use strict";
  var DN = window.DN, h = DN.h;
  var HR_ONLY = ["hr", "admin"], MGR = ["manager", "hr", "admin"], THEME_KEY = "dotnapps-site-theme";

  DN.load();
  ["contracts", "recruitment"].forEach(function (id) { DN.cfg[id].roles = MGR; });   // cosmetic until a backend enforces access

  var id = document.body.getAttribute("data-app"), app = DN.cfg[id];
  var head = document.getElementById("head"), page = document.getElementById("page");

  function companyDialog() {
    DN.form({ title: "Company details", values: DN.settings(), saveLabel: "Save",
      fields: [{ k: "company", label: "Company name", required: true, full: true },
        { k: "address", label: "Address (printed on quotes, invoices, payslips)", type: "textarea" },
        { k: "gstin", label: "Company GSTIN", pattern: "[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]", patternHelp: "15-character GSTIN" },
        { k: "pt", label: "Professional tax per month (₹)", type: "number", hint: "Used by Payroll when gross is above ₹25,000. Depends on your state." }],
      onSave: function (v) { DN.setSettings(v); DN.toast("Saved."); } });
  }

  function dataDialog() {
    var body = h("div", { class: "dlg-b" }), dlg, isAdmin = DN.role() === "admin";
    var box = function (title, text, ctl) { return h("div", { class: "fld full" }, h("label", null, title), h("span", { class: "hint" }, text), ctl); };
    body.append(
      box("Company details", "Name, address and GSTIN printed on quotes, invoices and payslips.", h("button", { class: "btn", disabled: !DN.can(HR_ONLY), onclick: function () { dlg.close(); companyDialog(); } }, "Edit company details")),
      box("Export backup", "Download all staff data held in this browser as a JSON file.", h("button", { class: "btn", onclick: function () {
        var a = h("a", { href: URL.createObjectURL(new Blob([JSON.stringify(DN.dump(), null, 1)], { type: "application/json" })), download: "dotnapps-staff-backup-" + DN.today() + ".json" });
        document.body.append(a); a.click(); a.remove();
      } }, "Download backup")),
      box("Restore backup", "Replaces everything here with the file's contents (Admin only).", h("input", { type: "file", accept: "application/json", disabled: !isAdmin, onchange: function (e) {
        var f = e.target.files[0]; if (!f) return;
        f.text().then(function (t) {
          var d; try { d = JSON.parse(t); } catch (x) { DN.toast("That isn't a valid backup file."); return; }
          if (!d || !Array.isArray(d.employees)) { DN.toast("That file doesn't look like a staff data backup."); return; }
          if (confirm("Replace all data in this browser with the backup?")) { DN.replaceAll(d); location.reload(); }
        });
      } })),
      box("Reset to demo data", "Throws away what's here and loads the sample company (Admin only).", h("button", { class: "btn danger", disabled: !isAdmin, onclick: function () {
        if (confirm("Replace everything with sample demo data?")) { DN.replaceAll(DN.seed()); try { localStorage.removeItem("dn.staff.me"); } catch (e) {} location.reload(); }
      } }, "Reset to demo data")),
      box("Start blank", "Clears the demo company and creates your own Admin account (Admin only).", h("button", { class: "btn danger", disabled: !isAdmin, onclick: function () {
        var name = (prompt("Your full name (you become the first Admin)") || "").trim(); if (!name) return;
        if (!confirm("Delete ALL data here and start a blank company?")) return;
        var e = { id: "e_" + DN.uid(), created: Date.now(), name: name, code: "EMP-0001", dept: "Management", title: "Admin", access: "Admin", status: "Active", joined: DN.today(), email: "" };
        DN.replaceAll({ settings: { company: "Dotnapps", address: "", gstin: "", pt: 200 }, employees: [e], channels: [{ id: "general", name: "general" }], demo: false });
        DN.setMe(e.id); location.reload();
      } }, "Start blank")));
    dlg = DN.dialog("Data & company", body, h("div", { class: "dlg-f" }, h("span", { class: "grow" }), h("button", { class: "btn pri", onclick: function () { dlg.close(); } }, "Done")));
  }

  function buildHead() {
    DN.clear(head);
    var sel = h("select", { "aria-label": "Signed in as (demo switcher)", title: "Demo switcher: not security", onchange: function (e) { DN.setMe(e.target.value); start(); } });
    DN.live("employees").forEach(function (e) { sel.append(h("option", { value: e.id }, e.name + " · " + e.access)); });
    var me = DN.me(); if (me) sel.value = me.id;
    head.append(
      h("a", { class: "brand", href: "/staff/", title: "All Dotnapps staff apps" },
        h("svg", { viewBox: "26 27.4 48 45.1", "aria-hidden": "true" }, h("path", { d: "M27 28.4H43.1V43.8H27Z M47.6 28.4H59.3L73 42.1V66.3L67.9 71.5H56.2V42.4H47.6Z M43.1 47.9L27 54.7V67.2L32 71.5H43.1Z" }))),
      h("span", { class: "mono-ico" }, app.mono),
      h("h1", { id: "pageTitle" }, app.name),
      h("span", { class: "grow" }),
      h("label", { class: "who" }, h("span", null, "Signed in as"), sel),
      h("button", { class: "btn sm", type: "button", onclick: dataDialog }, "Data"),
      h("button", { class: "btn sm", type: "button", "aria-label": "Switch colour theme", onclick: function () {
        var root = document.documentElement, n = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", n); try { localStorage.setItem(THEME_KEY, n); } catch (e) {}
      } }, "◐ Theme"));
  }

  function start() {
    buildHead(); DN.clear(page);
    DN.onExternalChange = start;                       // another tab changed the data
    if (!DN.me()) { page.append(h("div", { class: "empty" }, "No employees yet. Use Data → Start blank.")); return; }
    if (DN.isDemo()) page.append(h("div", { class: "demo-bar" }, "Sample company: people, deals and records are made up and saved only in this browser. Use Data → Start blank when your team is ready."));
    if (!DN.can(app.roles)) { page.append(h("div", { class: "demo-bar" }, "Your role (" + DN.role() + ") doesn't have access to " + app.name + ". Ask an Admin or HR.")); return; }
    var host = h("div"); page.append(host); app.mount(host);
  }

  if (!app) { page.textContent = "Unknown app."; return; }
  document.title = app.name + " · Dotnapps staff";
  start();
})();
