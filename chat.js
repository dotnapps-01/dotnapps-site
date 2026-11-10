/* Dotnapps chat widget. Talks to /api/chat (see api/chat.js). */
(function () {
  "use strict";

  // ---- config -------------------------------------------------------------
  var EMAIL = "hello@dotnapps.com";
  var WHATSAPP = ""; // digits only with country code, e.g. "919876543210". Empty hides the link.
  var ENDPOINT = "/api/chat";
  var STORE = "dotnapps-chat-v1";
  var MAX_CHARS = 500;
  var SEND_HISTORY = 8;
  var GREETING = "Hi! I'm the Dotnapps assistant. Ask me about our services, Business OS, or how we work.";
  var CHIPS = [
    ["Our services", "What services does Dotnapps offer?"],
    ["Business OS", "What is Business OS?"],
    ["Pricing", "How does pricing work?"]
  ];

  if (!window.fetch || document.getElementById("dn-chat-launch")) return;

  // ---- state --------------------------------------------------------------
  var msgs = []; // {role, content} — the greeting is display-only
  try {
    var saved = JSON.parse(sessionStorage.getItem(STORE) || "[]");
    if (Array.isArray(saved)) {
      msgs = saved.filter(function (m) {
        return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
      }).slice(-20);
    }
  } catch (e) {}
  function persist() { try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-20))); } catch (e) {} }

  var busy = false;

  // ---- DOM ----------------------------------------------------------------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  var SVG_NS = "http://www.w3.org/2000/svg";
  function icon(path, vb) {
    var s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", vb || "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("focusable", "false");
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "1.8");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    var p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", path);
    s.appendChild(p);
    return s;
  }

  var launch = el("button", "dn-launch");
  launch.type = "button";
  launch.id = "dn-chat-launch";
  launch.setAttribute("aria-label", "Chat with Dotnapps");
  launch.setAttribute("aria-expanded", "false");
  launch.setAttribute("aria-controls", "dn-chat-panel");
  launch.appendChild(icon("M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12Z"));

  var panel = el("section", "dn-panel");
  panel.id = "dn-chat-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "dn-chat-title");

  var head = el("div", "dn-head");
  var title = el("h2", "dn-title");
  title.id = "dn-chat-title";
  title.appendChild(document.createTextNode("Dotnapps assistant"));
  title.appendChild(el("span", "dn-sub", "AI chat · usually replies in seconds"));
  var close = el("button", "dn-close");
  close.type = "button";
  close.setAttribute("aria-label", "Close chat");
  close.appendChild(icon("M6 6l12 12M18 6L6 18"));
  head.appendChild(title);
  head.appendChild(close);

  var log = el("div", "dn-log");
  log.setAttribute("role", "log");
  log.setAttribute("aria-live", "polite");
  log.setAttribute("aria-relevant", "additions");

  var chips = el("div", "dn-chips");

  var form = el("form", "dn-form");
  form.setAttribute("autocomplete", "off");
  var label = el("label", "dn-vh", "Your message");
  label.setAttribute("for", "dn-chat-input");
  var input = el("textarea", "dn-input");
  input.id = "dn-chat-input";
  input.rows = 1;
  input.maxLength = MAX_CHARS;
  input.placeholder = "Type your question…";
  input.setAttribute("enterkeyhint", "send");
  var send = el("button", "dn-send");
  send.type = "submit";
  send.setAttribute("aria-label", "Send message");
  send.appendChild(icon("M5 12h14M13 6l6 6-6 6"));
  form.appendChild(label);
  form.appendChild(input);
  form.appendChild(send);

  var foot = el("div", "dn-foot");
  var note = el("span", null, "AI can make mistakes. Don’t share passwords or sensitive data.");
  var human = el("a", null, "Talk to a human");
  human.href = "mailto:" + EMAIL;
  foot.appendChild(note);
  foot.appendChild(human);
  if (WHATSAPP) {
    var wa = el("a", null, "WhatsApp");
    wa.target = "_blank";
    wa.rel = "noopener";
    foot.appendChild(wa);
  }

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(chips);
  panel.appendChild(form);
  panel.appendChild(foot);
  document.body.appendChild(panel);
  document.body.appendChild(launch);

  // ---- rendering ----------------------------------------------------------
  // Plain text only; dotnapps.com links and emails become real links.
  var LINKS = /(https?:\/\/(?:www\.)?dotnapps\.com(?:\/[^\s)]*[^\s).,;:!?])?|[\w.+-]+@dotnapps\.com)/g;

  function fill(p, line) {
    var last = 0, m;
    LINKS.lastIndex = 0;
    while ((m = LINKS.exec(line))) {
      if (m.index > last) p.appendChild(document.createTextNode(line.slice(last, m.index)));
      var a = el("a", null, m[0]);
      a.href = m[0].indexOf("@") > -1 && m[0].indexOf("http") !== 0 ? "mailto:" + m[0] : m[0];
      p.appendChild(a);
      last = m.index + m[0].length;
    }
    if (last < line.length) p.appendChild(document.createTextNode(line.slice(last)));
  }

  function bubble(role, text, extra) {
    var b = el("div", "dn-msg " + (role === "user" ? "dn-me" : "dn-bot") + (extra ? " " + extra : ""));
    String(text).split(/\n+/).forEach(function (line) {
      if (!line.trim()) return;
      var p = el("p");
      fill(p, line);
      b.appendChild(p);
    });
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function typing() {
    var b = el("div", "dn-msg dn-bot");
    var dots = el("span", "dn-typing");
    dots.setAttribute("aria-hidden", "true");
    dots.appendChild(el("i"));
    dots.appendChild(el("i"));
    dots.appendChild(el("i"));
    b.appendChild(dots);
    b.appendChild(el("span", "dn-vh", "Assistant is typing"));
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function renderChips() {
    chips.textContent = "";
    chips.hidden = msgs.length > 0;
    if (msgs.length) return;
    CHIPS.forEach(function (c) {
      var b = el("button", "dn-chip", c[0]);
      b.type = "button";
      b.addEventListener("click", function () { ask(c[1]); });
      chips.appendChild(b);
    });
  }

  // "Talk to a human" carries the conversation along in the email body.
  function updateHandoff() {
    var t = msgs.map(function (m) { return (m.role === "user" ? "Me: " : "Assistant: ") + m.content; }).join("\n\n");
    var body = "Hi Dotnapps team,\n\nI'd like to talk to someone.\n" + (t ? "\n--- chat so far ---\n" + t.slice(-1200) : "");
    human.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent("Enquiry from dotnapps.com chat") + "&body=" + encodeURIComponent(body);
    if (WHATSAPP) {
      wa.href = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent("Hi Dotnapps, I'd like to talk to someone." + (t ? "\n\n" + t.slice(-600) : ""));
    }
  }

  function restore() {
    log.textContent = "";
    bubble("assistant", GREETING);
    msgs.forEach(function (m) { bubble(m.role, m.content); });
    renderChips();
    updateHandoff();
  }

  // ---- behaviour ----------------------------------------------------------
  function setOpen(open) {
    panel.hidden = !open;
    launch.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      log.scrollTop = log.scrollHeight;
      input.focus({ preventScroll: true });
    } else if (panel.contains(document.activeElement)) {
      launch.focus({ preventScroll: true });
    }
  }

  function setBusy(v) {
    busy = v;
    send.disabled = v;
    log.setAttribute("aria-busy", v ? "true" : "false");
  }

  function ask(text) {
    text = String(text || "").trim().slice(0, MAX_CHARS);
    if (!text || busy) return;
    msgs.push({ role: "user", content: text });
    persist();
    bubble("user", text);
    renderChips();
    updateHandoff();
    input.value = "";
    grow();
    setBusy(true);
    var wait = typing();

    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 30000);
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: msgs.slice(-SEND_HISTORY) }),
      signal: ctl.signal
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; });
      })
      .then(function (x) {
        wait.remove();
        if (x.ok && x.d && x.d.reply) {
          msgs.push({ role: "assistant", content: x.d.reply });
          persist();
          bubble("assistant", x.d.reply);
        } else {
          var m = (x.d && x.d.error) || "Sorry, something went wrong.";
          bubble("assistant", m + " You can email us at " + EMAIL + " or use “Talk to a human” below.", "dn-err");
        }
      })
      .catch(function () {
        wait.remove();
        bubble("assistant", "I couldn’t reach the assistant. Please try again, or email us at " + EMAIL + ".", "dn-err");
      })
      .then(function () {
        clearTimeout(timer);
        setBusy(false);
        updateHandoff();
        input.focus({ preventScroll: true });
      });
  }

  function grow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 110) + "px";
  }

  launch.addEventListener("click", function () { setOpen(panel.hidden); });
  close.addEventListener("click", function () { setOpen(false); });
  panel.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
  input.addEventListener("input", grow);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); }
  });

  restore();
})();
