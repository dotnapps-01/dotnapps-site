/* Dotnapps chat widget.
   - AI assistant:   POST /api/chat   (api/chat.js)
   - Live human chat: /api/live       (api/live.js) — the team replies from /agent */
(function () {
  "use strict";

  // ---- config -------------------------------------------------------------
  var EMAIL = "hello@dotnapps.com"; // shown only if live chat is unavailable
  var ENDPOINT = "/api/chat";
  var LIVE = "/api/live";
  var STORE = "dotnapps-chat-v1";
  var LIVE_STORE = "dotnapps-chat-live-v1";
  var MAX_CHARS = 500;
  var SEND_HISTORY = 8;
  var GREETING = "Hi! I'm the Dotnapps assistant. Ask me about our services, Business OS, or how we work.";
  var SUB_AI = "AI chat · usually replies in seconds";
  var SUB_LIVE = "Live chat with our team";
  var NOTE_AI = "AI can make mistakes. Don’t share passwords or sensitive data.";
  var NOTE_LIVE = "You’re talking to our team. Messages are emailed to us.";
  var CHIPS = [
    ["Our services", "What services does Dotnapps offer?"],
    ["Business OS", "What is Business OS?"],
    ["Pricing", "How does pricing work?"]
  ];

  if (!window.fetch || document.getElementById("dn-chat-launch")) return;

  // ---- state --------------------------------------------------------------
  // msgs: {role:"user"|"assistant", content, who?:"agent"|"sys"}. Only entries
  // without `who` are AI-chat turns. The greeting is display-only.
  var msgs = [];
  var live = null; // {id, next} while a human chat is active
  try {
    var saved = JSON.parse(sessionStorage.getItem(STORE) || "[]");
    if (Array.isArray(saved)) {
      msgs = saved.filter(function (m) {
        return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
      }).slice(-40);
    }
    var sl = JSON.parse(sessionStorage.getItem(LIVE_STORE) || "null");
    if (sl && /^[a-f0-9]{32}$/.test(sl.id) && typeof sl.next === "number") live = { id: sl.id, next: sl.next };
  } catch (e) {}
  function persist() {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-40)));
      if (live) sessionStorage.setItem(LIVE_STORE, JSON.stringify(live));
      else sessionStorage.removeItem(LIVE_STORE);
    } catch (e) {}
  }
  function aiTurns() { return msgs.filter(function (m) { return !m.who; }); }

  var busy = false;
  var pollTimer = 0;

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
  var sub = el("span", "dn-sub", SUB_AI);
  title.appendChild(sub);
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
  var note = el("span", null, NOTE_AI);
  var human = el("button", "dn-link", "Talk to a human");
  human.type = "button";
  foot.appendChild(note);
  foot.appendChild(human);

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

  function bubble(role, text, extra, who) {
    var cls = who === "sys" ? "dn-msg dn-note" : "dn-msg " + (role === "user" ? "dn-me" : who === "agent" ? "dn-bot dn-agent" : "dn-bot");
    var b = el("div", cls + (extra ? " " + extra : ""));
    if (who === "agent") b.appendChild(el("span", "dn-who", "Dotnapps team"));
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
    chips.hidden = msgs.length > 0 || !!live;
    if (chips.hidden) return;
    CHIPS.forEach(function (c) {
      var b = el("button", "dn-chip", c[0]);
      b.type = "button";
      b.addEventListener("click", function () { ask(c[1]); });
      chips.appendChild(b);
    });
  }

  // Fallback when live chat can't be reached: email with the chat attached.
  function mailtoHref() {
    var t = aiTurns().map(function (m) { return (m.role === "user" ? "Me: " : "Assistant: ") + m.content; }).join("\n\n");
    var body = "Hi Dotnapps team,\n\nI'd like to talk to someone.\n" + (t ? "\n--- chat so far ---\n" + t.slice(-1200) : "");
    return "mailto:" + EMAIL + "?subject=" + encodeURIComponent("Enquiry from dotnapps.com chat") + "&body=" + encodeURIComponent(body);
  }
  function emailFallback(parent) {
    var p = el("p");
    p.appendChild(document.createTextNode("You can still reach us: "));
    var a = el("a", null, "email the team");
    a.href = mailtoHref();
    p.appendChild(a);
    p.appendChild(document.createTextNode("."));
    parent.appendChild(p);
  }

  function setLiveUi() {
    var on = !!live;
    title.firstChild.nodeValue = on ? "Dotnapps team" : "Dotnapps assistant";
    sub.textContent = on ? SUB_LIVE : SUB_AI;
    note.textContent = on ? NOTE_LIVE : NOTE_AI;
    human.textContent = on ? "End live chat" : "Talk to a human";
    input.placeholder = on ? "Message our team…" : "Type your question…";
    input.maxLength = on ? 1000 : MAX_CHARS;
    renderChips();
  }

  function restore() {
    log.textContent = "";
    bubble("assistant", GREETING);
    msgs.forEach(function (m) { bubble(m.role, m.content, null, m.who); });
    setLiveUi();
    if (live) poll();
  }

  // ---- behaviour ----------------------------------------------------------
  function setOpen(open) {
    panel.hidden = !open;
    launch.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      launch.removeAttribute("data-unread");
      log.scrollTop = log.scrollHeight;
      input.focus({ preventScroll: true });
      if (live) poll();
    } else if (panel.contains(document.activeElement)) {
      launch.focus({ preventScroll: true });
    }
    schedulePoll();
  }

  function setBusy(v) {
    busy = v;
    send.disabled = v;
    log.setAttribute("aria-busy", v ? "true" : "false");
  }

  function ask(text) {
    text = String(text || "").trim().slice(0, live ? 1000 : MAX_CHARS);
    if (!text || busy) return;
    if (live) return sendLive(text);

    msgs.push({ role: "user", content: text });
    persist();
    bubble("user", text);
    renderChips();
    input.value = "";
    grow();
    setBusy(true);
    var wait = typing();

    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 30000);
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: aiTurns().slice(-SEND_HISTORY).map(function (m) { return { role: m.role, content: m.content }; }) }),
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
          var b = bubble("assistant", m + " Tap “Talk to a human” below to reach our team.", "dn-err");
          emailFallback(b);
        }
      })
      .catch(function () {
        wait.remove();
        var b = bubble("assistant", "I couldn’t reach the assistant. Please try again, or tap “Talk to a human” below.", "dn-err");
        emailFallback(b);
      })
      .then(function () {
        clearTimeout(timer);
        setBusy(false);
        input.focus({ preventScroll: true });
      });
  }

  // ---- live human chat ----------------------------------------------------
  function postLive(payload) {
    return fetch(LIVE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { d._ok = r.ok; d._status = r.status; return d; });
    });
  }

  function addSys(text) {
    msgs.push({ role: "assistant", content: text, who: "sys" });
    bubble("assistant", text, null, "sys");
  }

  function endLive(text) {
    live = null;
    clearTimeout(pollTimer);
    if (text) addSys(text);
    persist();
    setLiveUi();
  }

  // Inline form: collects an email so the team can follow up if the visitor leaves.
  function showHandoff() {
    if (live) return;
    var old = document.getElementById("dn-handoff");
    if (old) { old.querySelector("input").focus(); return; }
    var f = el("form", "dn-msg dn-bot dn-hand");
    f.id = "dn-handoff";
    f.setAttribute("aria-label", "Contact details for live chat");
    f.appendChild(el("p", null, "Happy to connect you with our team. Leave your email so they can reach you if you step away."));
    function field(id, text, type, auto, req) {
      var l = el("label", "dn-lab", text);
      l.setAttribute("for", id);
      var i = el("input", "dn-field");
      i.id = id;
      i.type = type;
      i.autocomplete = auto;
      i.required = !!req;
      i.maxLength = 120;
      f.appendChild(l);
      f.appendChild(i);
      return i;
    }
    var nameI = field("dn-h-name", "Name (optional)", "text", "name", false);
    var mailI = field("dn-h-email", "Email", "email", "email", true);
    var errP = el("p", "dn-ferr");
    errP.setAttribute("role", "alert");
    var row = el("div", "dn-hrow");
    var go = el("button", "dn-hbtn", "Start live chat");
    go.type = "submit";
    var cancel = el("button", "dn-hbtn dn-ghost", "Cancel");
    cancel.type = "button";
    row.appendChild(go);
    row.appendChild(cancel);
    f.appendChild(errP);
    f.appendChild(row);
    log.appendChild(f);
    log.scrollTop = log.scrollHeight;
    mailI.focus({ preventScroll: true });

    cancel.addEventListener("click", function () { f.remove(); input.focus({ preventScroll: true }); });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      errP.textContent = "";
      if (!mailI.checkValidity()) { errP.textContent = "Please enter a valid email address."; mailI.focus(); return; }
      go.disabled = true;
      go.textContent = "Connecting…";
      postLive({
        action: "start",
        name: nameI.value,
        email: mailI.value,
        page: location.pathname,
        transcript: aiTurns().slice(-10).map(function (m) { return { role: m.role, content: m.content }; })
      }).then(function (d) {
        if (d._ok && d.id) {
          f.remove();
          live = { id: d.id, next: d.next || 0 };
          addSys(d.online
            ? "You’re connected. A team member will reply here shortly."
            : "You’re connected. Our team has been notified and will reply here, or by email if you leave.");
          persist();
          setLiveUi();
          schedulePoll();
          input.focus({ preventScroll: true });
        } else {
          go.disabled = false;
          go.textContent = "Start live chat";
          errP.textContent = d.error || "Couldn’t connect you right now.";
          if (!errP.querySelector("a")) emailFallback(errP);
        }
      }).catch(function () {
        go.disabled = false;
        go.textContent = "Start live chat";
        errP.textContent = "Couldn’t connect you right now.";
        if (!errP.querySelector("a")) emailFallback(errP);
      });
    });
  }

  function sendLive(text) {
    msgs.push({ role: "user", content: text });
    persist();
    var b = bubble("user", text);
    input.value = "";
    grow();
    setBusy(true);
    postLive({ action: "send", id: live.id, text: text }).then(function (d) {
      if (d._ok) return;
      b.classList.add("dn-failed");
      msgs.pop();
      persist();
      if (d.closed || d.gone) {
        endLive(d.closed ? "This live chat has ended. You’re back with the AI assistant." : "That live chat has expired. You’re back with the AI assistant.");
      } else {
        var e = bubble("assistant", (d.error || "Your message wasn’t sent.") + " Please try again.", "dn-err");
        input.value = text;
        grow();
        void e;
      }
    }).catch(function () {
      b.classList.add("dn-failed");
      msgs.pop();
      persist();
      bubble("assistant", "Your message wasn’t sent. Check your connection and try again.", "dn-err");
      input.value = text;
      grow();
    }).then(function () {
      setBusy(false);
      input.focus({ preventScroll: true });
    });
  }

  // Poll for the team's replies: quickly while the panel is open, slowly when
  // it's closed (so the launcher can show an unread dot), never when hidden.
  function schedulePoll() {
    clearTimeout(pollTimer);
    if (!live || document.hidden) return;
    pollTimer = setTimeout(poll, panel.hidden ? 20000 : 4000);
  }
  var polling = false;
  function poll() {
    if (!live || polling) return;
    polling = true;
    var id = live.id;
    fetch(LIVE + "?id=" + id + "&after=" + live.next, { cache: "no-store" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { d._status = r.status; return d; }); })
      .then(function (d) {
        if (!live || live.id !== id) return;
        if (d._status === 404) return endLive("That live chat has expired. You’re back with the AI assistant.");
        if (!d.messages) return;
        var gotAgent = false;
        d.messages.forEach(function (m) {
          if (m.f === "agent") {
            msgs.push({ role: "assistant", content: m.t, who: "agent" });
            bubble("assistant", m.t, null, "agent");
            gotAgent = true;
          }
        });
        live.next = d.next;
        if (gotAgent && panel.hidden) launch.setAttribute("data-unread", "1");
        if (d.status === "closed") return endLive("Our team ended this chat. You’re back with the AI assistant.");
        persist();
      })
      .catch(function () {})
      .then(function () { polling = false; schedulePoll(); });
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && live) poll();
  });

  human.addEventListener("click", function () {
    if (!live) {
      if (panel.hidden) setOpen(true);
      showHandoff();
      return;
    }
    if (!window.confirm("End the live chat with our team?")) return;
    var id = live.id;
    postLive({ action: "end", id: id }).catch(function () {});
    endLive("You ended the live chat. You’re back with the AI assistant.");
  });

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
