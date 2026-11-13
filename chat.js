/* Dotnapps chat widget.
   - AI assistant:   POST /api/chat   (api/chat.js)
   - Live human chat: /api/live       (api/live.js), answered from the Chats tab of /admin */
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
  var GREETING = "Hi! I'm BLOOP, your friendly Dotnapps assistant. Ask me about our services, Business OS, or how we work.";
  var SUB_AI = "Dotnapps assistant · AI chat";
  var SUB_LIVE = "Live chat with our team";
  var NOTE_AI = "AI can make mistakes. Don’t share passwords or sensitive data.";
  var NOTE_LIVE = "You’re talking to our team. Please don’t share passwords or card details.";
  var CHIPS = [
    ["Our services", "What services does Dotnapps offer?"],
    ["Business OS", "What is Business OS?"],
    ["Pricing", "How does pricing work?"]
  ];

  if (!window.fetch || document.getElementById("dn-chat-launch")) return;

  var EYEBROW = ["Online", "Live chat"];
  function stamp(ts) { try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }

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

  // ---- BLOOP, the bot's face (see bloop.svg) -------------------------------
  // One SVG, three expressions switched by data-state: idle, typing, happy.
  var RING = "M19 64.9A36.3 36.3 0 1 1 81 64.9"; // open ring, ends rounded, gap at the bottom
  function sv(tag, attrs, parent) {
    var n = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  /*
   * BLOOP's face: an open ring, two round eyes and a speech-bubble mouth, all in one
   * colour. Expressions: idle, typing, happy, excited, wink, love, cool, thinking, help,
   * success, error, alert, offline, processing, online. Each is a <g class="g g-NAME">;
   * CSS shows the one(s) matching data-state. Several states (thinking, help, success,
   * error, alert, online) reuse the idle eyes ("g-eyes") and add a badge or dot on top.
   */
  var MOODS = ["idle", "typing", "happy", "excited", "wink", "love", "cool", "thinking", "help", "success", "error", "alert", "offline", "processing", "online"];
  function face(cls) {
    var s = sv("svg", { "class": "dn-face " + (cls || ""), viewBox: "0 0 100 100", "aria-hidden": "true", focusable: "false", "data-state": "idle" });
    sv("path", { "class": "dn-ring", d: RING }, s);
    sv("ellipse", { "class": "dn-mouth", cx: 50, cy: 73.8, rx: 25.1, ry: 10.9 }, s);
    sv("path", { "class": "dn-mouth", d: "M50 82V94.6L73.4 79.2Z" }, s);
    function grp(name) { return sv("g", { "class": "g g-" + name }, s); }
    function dot(parent, cx, cy, r, cls) { return sv("circle", { "class": cls || "dn-fe", cx: cx, cy: cy, r: r }, parent); }
    function line(parent, d, cls) { return sv("path", { "class": cls || "dn-arc", d: d }, parent); }
    function eyesIn(g) { dot(g, 37.5, 42.8, 6.9); dot(g, 62.5, 42.8, 6.9); }

    eyesIn(grp("eyes"));

    var typ = grp("typing");
    eyesIn(typ);
    [42, 50, 58].forEach(function (cx, i) { dot(typ, cx, 73.8, 2.3, "dn-fd dn-td dn-td" + i); });

    var hap = grp("happy");
    line(hap, "M30.5 47Q37.5 36 44.5 47"); line(hap, "M55.5 47Q62.5 36 69.5 47");

    var exc = grp("excited");
    line(exc, "M31 36L43 43L31 50"); line(exc, "M69 36L57 43L69 50");
    line(exc, "M82 8L86 0", "dn-spark"); line(exc, "M91 11L98 5", "dn-spark"); line(exc, "M93 20L100 19", "dn-spark");

    var wnk = grp("wink");
    dot(wnk, 37.5, 42.8, 6.9);
    sv("rect", { "class": "dn-fe", x: 55.5, y: 40.3, width: 14, height: 5, rx: 2.5 }, wnk);

    var lov = grp("love");
    var heart = "M0-2C-2-8-10-6-10 0C-10 5-4 8 0 12C4 8 10 5 10 0C10-6 2-8 0-2Z";
    sv("path", { "class": "dn-fe", d: heart, transform: "translate(37.5 40) scale(.78)" }, lov);
    sv("path", { "class": "dn-fe", d: heart, transform: "translate(62.5 40) scale(.78)" }, lov);

    var col = grp("cool");
    sv("rect", { "class": "dn-fe", x: 26, y: 36, width: 21, height: 14, rx: 6 }, col);
    sv("rect", { "class": "dn-fe", x: 53, y: 36, width: 21, height: 14, rx: 6 }, col);
    sv("rect", { "class": "dn-fe", x: 46, y: 37, width: 8, height: 4 }, col);

    // speech-bubble badges (top right): thinking, help, success, error, alert
    function badge(name, draw) {
      var g = grp(name);
      sv("circle", { "class": "dn-bt", cx: 88, cy: 12, r: 11 }, g);
      draw(g);
    }
    badge("thinking", function (g) { [82, 88, 94].forEach(function (cx) { dot(g, cx, 12, 2, "dn-bg-f"); }); });
    badge("help", function (g) { line(g, "M84 8.5Q84 4.5 88 4.5Q92 4.5 92 8.5Q92 11.2 88 13V15", "dn-bg"); dot(g, 88, 19, 1.8, "dn-bg-f"); });
    badge("success", function (g) { line(g, "M82 12.5L86.5 17L94 7.5", "dn-bg"); });
    badge("error", function (g) { line(g, "M83 7L93 17M93 7L83 17", "dn-bg"); });
    badge("alert", function (g) { line(g, "M88 5.5V13.5", "dn-bg"); dot(g, 88, 18.5, 2, "dn-bg-f"); });

    var off = grp("offline");
    sv("rect", { "class": "dn-fe", x: 30, y: 40.6, width: 15, height: 4.6, rx: 2.3 }, off);
    sv("rect", { "class": "dn-fe", x: 55, y: 40.6, width: 15, height: 4.6, rx: 2.3 }, off);
    line(off, "M78 10H85L78 18H85", "dn-spark"); line(off, "M89 -2H99L89 12H99", "dn-spark");

    var prc = grp("processing");
    var ring = sv("g", { "class": "dn-spin" }, prc);
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      dot(ring, (50 + 10 * Math.cos(a)).toFixed(1), (43 + 10 * Math.sin(a)).toFixed(1), i % 2 ? 1.8 : 2.6);
    }

    dot(grp("online"), 86, 84, 4.6);
    return s;
  }
  // The Dotnapps mark (favicon.svg), shown while a human is on the chat.
  function teamMark() {
    var s = sv("svg", { "class": "dn-team", viewBox: "26 27.4 48 45.1", "aria-hidden": "true", focusable: "false" });
    sv("path", { d: "M27 28.4H43.1V43.8H27Z M47.6 28.4H59.3L73 42.1V66.3L67.9 71.5H56.2V42.4H47.6Z M43.1 47.9L27 54.7V67.2L32 71.5H43.1Z" }, s);
    return s;
  }
  var headFace, launchFace, moodTimer = 0;
  // Show an expression on the header face; with `ms` it returns to idle afterwards.
  function setMood(state, ms) {
    if (!headFace || MOODS.indexOf(state) < 0) return;
    headFace.setAttribute("data-state", state);
    clearTimeout(moodTimer);
    if (ms) moodTimer = setTimeout(function () { if (headFace) headFace.setAttribute("data-state", "idle"); }, ms);
  }
  // Small easter eggs: how BLOOP reacts to what the visitor said / what it replied.
  function moodFor(said, reply) {
    if (/\b(thanks?|thank you|thx|appreciate)/i.test(said)) return "love";
    if (/\b(cool|awesome|great|nice|amazing|perfect)\b/i.test(said)) return "cool";
    if (/^\s*(hi|hello|hey|hola|namaste)\b/i.test(said)) return "wink";
    if (/not sure|don.t know|couldn.t find|not certain/i.test(reply)) return "help";
    return "happy";
  }

  var launch = el("button", "dn-launch");
  launch.type = "button";
  launch.id = "dn-chat-launch";
  launch.setAttribute("aria-label", "Chat with BLOOP, the Dotnapps assistant");
  launch.setAttribute("aria-expanded", "false");
  launch.setAttribute("aria-controls", "dn-chat-panel");
  launchFace = face("dn-lface");
  launch.classList.add("dn-s-a");
  launch.appendChild(launchFace);
  launch.appendChild(el("span", "dn-dot"));

  var panel = el("section", "dn-panel dn-s-a");
  panel.id = "dn-chat-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "dn-chat-title");

  var head = el("div", "dn-head");
  var avatar = el("span", "dn-avatar");
  headFace = face("dn-hface");
  avatar.appendChild(headFace);
  var titles = el("div", "dn-titles");
  var eyebrow = el("span", "dn-eyebrow", EYEBROW[0]);
  var title = el("h2", "dn-title");
  title.id = "dn-chat-title";
  title.appendChild(document.createTextNode("BLOOP"));
  var sub = el("span", "dn-sub", SUB_AI);
  title.appendChild(sub);
  var close = el("button", "dn-close");
  close.type = "button";
  close.setAttribute("aria-label", "Close chat");
  close.appendChild(icon("M6 6l12 12M18 6L6 18"));
  titles.appendChild(eyebrow);
  titles.appendChild(title);
  // Phones get a compact card by default; this button makes it full screen (and back).
  var expand = el("button", "dn-expand");
  expand.type = "button";
  expand.setAttribute("aria-pressed", "false");
  expand.setAttribute("aria-label", "Make chat full screen");
  expand.appendChild(icon("M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"));
  var expandPath = expand.querySelector("path");
  head.appendChild(avatar);
  head.appendChild(titles);
  head.appendChild(expand);
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

  function bubble(role, text, extra, who, ts) {
    var cls = who === "sys" ? "dn-msg dn-note" : "dn-msg " + (role === "user" ? "dn-me" : who === "agent" ? "dn-bot dn-agent" : "dn-bot");
    var b = el("div", cls + (extra ? " " + extra : ""));
    if (who === "agent") b.appendChild(el("span", "dn-who", "Dotnapps team"));
    if (who !== "sys") {
      var label = role === "user" ? "You" : who === "agent" ? "Team" : "BLOOP";
      b.appendChild(el("span", "dn-meta", label + (ts ? " · " + stamp(ts) : "")));
    }
    String(text).split(/\n+/).forEach(function (line) {
      if (!line.trim()) return;
      var p = el("p");
      fill(p, line);
      b.appendChild(p);
    });
    if (role === "assistant" && !who) {
      // BLOOP's own messages get its face beside the first bubble of a run.
      var prev = log.lastElementChild;
      var row = el("div", "dn-row");
      row.appendChild(prev && prev.classList.contains("dn-row") ? el("span", "dn-sp") : face("dn-mini"));
      row.appendChild(b);
      log.appendChild(row);
    } else {
      log.appendChild(b);
    }
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function typing() {
    var row = el("div", "dn-row");
    var mini = face("dn-mini");
    mini.setAttribute("data-state", "typing");
    row.appendChild(mini);
    var b = el("div", "dn-msg dn-bot");
    var dots = el("span", "dn-typing");
    dots.setAttribute("aria-hidden", "true");
    dots.appendChild(el("i"));
    dots.appendChild(el("i"));
    dots.appendChild(el("i"));
    b.appendChild(dots);
    b.appendChild(el("span", "dn-vh", "BLOOP is typing"));
    row.appendChild(b);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
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
    title.firstChild.nodeValue = on ? "Dotnapps team" : "BLOOP";
    avatar.textContent = "";
    if (on) {
      headFace = null;
      avatar.appendChild(teamMark());
    } else {
      headFace = face("dn-hface");
      avatar.appendChild(headFace);
    }
    sub.textContent = on ? SUB_LIVE : SUB_AI;
    eyebrow.textContent = EYEBROW[on ? 1 : 0];
    note.textContent = on ? NOTE_LIVE : NOTE_AI;
    human.textContent = on ? "End live chat" : "Talk to a human";
    input.placeholder = on ? "Message our team…" : "Type your question…";
    input.maxLength = on ? 1000 : MAX_CHARS;
    renderChips();
  }

  function restore() {
    log.textContent = "";
    bubble("assistant", GREETING);
    msgs.forEach(function (m) { bubble(m.role, m.content, null, m.who, m.ts); });
    setLiveUi();
    if (live) poll();
  }

  // ---- behaviour ----------------------------------------------------------
  var greeted = false;
  // On phones the keyboard must not pop up by itself (it would cover the welcome message and
  // squeeze the card); it opens when the visitor taps the message box. While it is open the
  // card drops the suggestions and the footer so the conversation keeps its room.
  var COARSE = window.matchMedia ? window.matchMedia("(pointer: coarse)") : null;
  var kbdWanted = false, kbdTimer = 0;
  function focusInput() {
    if (COARSE && COARSE.matches && !kbdWanted) return;
    input.focus({ preventScroll: true });
  }
  input.addEventListener("focus", function () {
    kbdWanted = true;
    clearTimeout(kbdTimer);
    if (COARSE && COARSE.matches) {
      panel.classList.add("dn-kbd");
      setTimeout(function () { log.scrollTop = log.scrollHeight; }, 320);
    }
  });
  input.addEventListener("blur", function () {
    clearTimeout(kbdTimer);
    kbdTimer = setTimeout(function () {
      if (document.activeElement === input) return;
      kbdWanted = false; // a keyboard the visitor dismissed stays dismissed
      panel.classList.remove("dn-kbd");
    }, 300);
  });
  // Tapping the send arrow must not take focus from the message box, or the keyboard would close after every message.
  send.addEventListener("mousedown", function (e) { e.preventDefault(); });

  function setOpen(open) {
    if (open) { hideGreeting(); markEngaged(); }
    else { kbdWanted = false; panel.classList.remove("dn-kbd"); }
    panel.hidden = !open;
    launch.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      launch.removeAttribute("data-unread");
      launchFace.setAttribute("data-state", "idle");
      if (!msgs.length && !greeted) { greeted = true; setMood("excited", 1800); }
      log.scrollTop = log.scrollHeight;
      focusInput();
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

    msgs.push({ role: "user", content: text, ts: Date.now() });
    persist();
    bubble("user", text, null, null, Date.now());
    renderChips();
    input.value = "";
    grow();
    setBusy(true);
    var wait = typing();
    setMood("typing");
    var thinkT = setTimeout(function () { setMood("thinking"); }, 4000);
    var slowT = setTimeout(function () { setMood("processing"); }, 9000);

    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 30000);
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: aiTurns().slice(-SEND_HISTORY).map(function (m) { return { role: m.role, content: m.content }; }) }),
      signal: ctl.signal
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d, status: r.status }; });
      })
      .then(function (x) {
        clearTimeout(thinkT); clearTimeout(slowT);
        wait.remove();
        if (x.ok && x.d && x.d.reply) {
          msgs.push({ role: "assistant", content: x.d.reply, ts: Date.now() });
          persist();
          bubble("assistant", x.d.reply, null, null, Date.now());
          setMood(moodFor(text, x.d.reply), 2000);
        } else {
          setMood(x.status === 429 ? "alert" : "error", 3500);
          var m = (x.d && x.d.error) || "Sorry, something went wrong.";
          var b = bubble("assistant", m + " Tap “Talk to a human” below to reach our team.", "dn-err");
          emailFallback(b);
        }
      })
      .catch(function () {
        clearTimeout(thinkT); clearTimeout(slowT);
        wait.remove();
        setMood("error", 3500);
        var b = bubble("assistant", "I couldn’t reach the assistant. Please try again, or tap “Talk to a human” below.", "dn-err");
        emailFallback(b);
      })
      .then(function () {
        clearTimeout(timer);
        setBusy(false);
        focusInput();
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

  function endLive(text, mood) {
    live = null;
    clearTimeout(pollTimer);
    if (text) addSys(text);
    persist();
    setLiveUi();
    if (mood) setMood(mood, 2500); // BLOOP is back: wave the result
  }

  // Inline form: collects an email so the team can follow up if the visitor leaves.
  function showHandoff() {
    if (live) return;
    var old = document.getElementById("dn-handoff");
    if (old) { old.querySelector("input").focus(); return; }
    var f = el("form", "dn-msg dn-bot dn-hand");
    f.id = "dn-handoff";
    f.setAttribute("aria-label", "Contact details for live chat");
    f.appendChild(el("p", null, "Happy to connect you with our team. Add your email if you'd like a reply after you leave this page (optional)."));
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
    var mailI = field("dn-h-email", "Email (optional)", "email", "email", false);
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

    cancel.addEventListener("click", function () { f.remove(); focusInput(); });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      errP.textContent = "";
      if (!mailI.checkValidity()) { errP.textContent = "That email address doesn’t look right."; mailI.focus(); return; }
      go.disabled = true;
      go.textContent = "Connecting…";
      setMood("processing");
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
            : "You’re connected. Our team isn’t online right now. Your messages are saved, and they’ll reply here (or by email if you left one) when they’re back.");
          persist();
          setLiveUi();
          schedulePoll();
          focusInput();
        } else {
          go.disabled = false;
          go.textContent = "Start live chat";
          setMood("error", 3500);
          errP.textContent = d.error || "Couldn’t connect you right now.";
          if (!errP.querySelector("a")) emailFallback(errP);
        }
      }).catch(function () {
        go.disabled = false;
        go.textContent = "Start live chat";
        setMood("error", 3500);
        errP.textContent = "Couldn’t connect you right now.";
        if (!errP.querySelector("a")) emailFallback(errP);
      });
    });
  }

  function sendLive(text) {
    msgs.push({ role: "user", content: text, ts: Date.now() });
    persist();
    var b = bubble("user", text, null, null, Date.now());
    input.value = "";
    grow();
    setBusy(true);
    postLive({ action: "send", id: live.id, text: text }).then(function (d) {
      if (d._ok) return;
      b.classList.add("dn-failed");
      msgs.pop();
      persist();
      if (d.closed || d.gone) {
        endLive(d.closed ? "This live chat has ended. You’re back with the AI assistant." : "That live chat has expired. You’re back with the AI assistant.", d.closed ? "success" : "alert");
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
      focusInput();
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
        if (d._status === 404) return endLive("That live chat has expired. You’re back with the AI assistant.", "alert");
        if (!d.messages) return;
        var gotAgent = false;
        d.messages.forEach(function (m) {
          if (m.f === "agent") {
            msgs.push({ role: "assistant", content: m.t, who: "agent", ts: m.ts || Date.now() });
            bubble("assistant", m.t, null, "agent", m.ts || Date.now());
            gotAgent = true;
          }
        });
        live.next = d.next;
        if (gotAgent && panel.hidden) { launch.setAttribute("data-unread", "1"); launchFace.setAttribute("data-state", "excited"); }
        if (d.status === "closed") return endLive("Our team ended this chat. You’re back with the AI assistant.", "success");
        persist();
      })
      .catch(function () {})
      .then(function () { polling = false; schedulePoll(); });
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && live) poll();
  });
  // BLOOP naps when the visitor's connection drops, and waves when it's back.
  window.addEventListener("offline", function () { clearTimeout(moodTimer); if (headFace) headFace.setAttribute("data-state", "offline"); });
  window.addEventListener("online", function () { setMood("online", 1800); });

  human.addEventListener("click", function () {
    if (!live) {
      if (panel.hidden) setOpen(true);
      showHandoff();
      return;
    }
    if (!window.confirm("End the live chat with our team?")) return;
    var id = live.id;
    postLive({ action: "end", id: id }).catch(function () {});
    endLive("You ended the live chat. You’re back with the AI assistant.", "success");
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

  // ---- full screen on phones --------------------------------------------
  var FULL_KEY = "dotnapps-chat-full";
  function setFull(on) {
    panel.classList.toggle("dn-full", on);
    expand.setAttribute("aria-pressed", on ? "true" : "false");
    expand.setAttribute("aria-label", on ? "Exit full screen" : "Make chat full screen");
    expandPath.setAttribute("d", on ? "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" : "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5");
    try { sessionStorage.setItem(FULL_KEY, on ? "1" : "0"); } catch (e) {}
  }
  expand.addEventListener("click", function () { setFull(!panel.classList.contains("dn-full")); focusInput(); });
  try { if (sessionStorage.getItem(FULL_KEY) === "1") setFull(true); } catch (e) {}

  // On phones the on-screen keyboard covers the bottom of the page; keep the card above it.
  if (window.visualViewport) {
    var fit = function () {
      var vv = window.visualViewport;
      panel.style.setProperty("--dn-kb", Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) + "px");
    };
    window.visualViewport.addEventListener("resize", fit);
    window.visualViewport.addEventListener("scroll", fit);
  }

  // ---- two pop-up messages with a soft chime ----------------------------
  // 1. "Hi there!" once per visitor, after the cookie choice (or a few seconds in, if there
  //    is no cookie banner).
  // 2. "Need any help?" about a minute later, with a button to reach the team. It is skipped
  //    if the visitor has already opened the chat.
  // Browsers only allow sound after a tap or key press, and the tap on the cookie banner
  // counts, so the chime is prepared on the first tap and played only if it is allowed;
  // otherwise the messages simply appear quietly.
  var GREET_KEY = "dotnapps-bloop-greeted";
  var HELP_KEY = "dotnapps-bloop-help";
  var HELP_DELAY = 60000;
  var audioCtx = null, audioReady = false;
  function primeAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      audioReady = true;
    } catch (e) {}
  }
  ["pointerdown", "keydown", "touchstart"].forEach(function (t) { document.addEventListener(t, primeAudio, { capture: true, passive: true }); });
  function chime(soft) {
    if (!audioReady || !audioCtx || audioCtx.state !== "running") return false;
    try {
      var t0 = audioCtx.currentTime;
      (soft ? [[880, 0, 0.3]] : [[659.25, 0, 0.2], [880, 0.13, 0.34]]).forEach(function (n) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = "sine";
        o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t0 + n[1]);
        g.gain.exponentialRampToValueAtTime(0.07, t0 + n[1] + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + n[2]);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(t0 + n[1]);
        o.stop(t0 + n[1] + n[2] + 0.03);
      });
      return true;
    } catch (e) { return false; }
  }

  var greet = el("div", "dn-greet");
  greet.hidden = true;
  greet.setAttribute("role", "status");
  var greetOpen = el("button", "dn-greet-open");
  greetOpen.type = "button";
  var greetTitle = el("strong", "dn-greet-t");
  var greetText = el("span", "dn-greet-p");
  greetOpen.appendChild(el("span", "dn-greet-eye", "BLOOP"));
  greetOpen.appendChild(greetTitle);
  greetOpen.appendChild(greetText);
  var greetAct = el("button", "dn-greet-act", "Talk to our team");
  greetAct.type = "button";
  var greetX = el("button", "dn-greet-x");
  greetX.type = "button";
  greetX.setAttribute("aria-label", "Dismiss greeting");
  greetX.appendChild(icon("M6 6l12 12M18 6L6 18"));
  greet.appendChild(greetOpen);
  greet.appendChild(greetAct);
  greet.appendChild(greetX);
  document.body.appendChild(greet);

  var greetTimer = 0, helpTimer = 0;
  function hideGreeting() { clearTimeout(greetTimer); greet.hidden = true; }
  greetOpen.addEventListener("click", function () { setOpen(true); });
  greetAct.addEventListener("click", function () { setOpen(true); showHandoff(); });
  greetX.addEventListener("click", function () { hideGreeting(); launch.focus({ preventScroll: true }); });

  function recent(key, ms) {
    try { var v = +localStorage.getItem(key); return !!v && Date.now() - v < ms; } catch (e) { return false; }
  }
  function alreadyGreeted() { return recent(GREET_KEY, 30 * 864e5); }
  function helpDone() { return recent(HELP_KEY, 30 * 864e5); }
  // Opening the chat means the visitor found BLOOP: no help nudge after that.
  function markEngaged() {
    clearTimeout(helpTimer);
    try { localStorage.setItem(HELP_KEY, String(Date.now())); } catch (e) {}
  }

  // Put one of the two messages on screen.
  function present(kind) {
    var help = kind === "help";
    greetTitle.textContent = help ? "Need any help?" : "Hi there!";
    greetText.textContent = help
      ? "I can answer questions right now, or connect you with our team."
      : "I\u2019m BLOOP. Ask me about our services, Business OS or how we work.";
    greetAct.hidden = !help;
    greet.hidden = true; void greet.offsetWidth; greet.hidden = false; // restart the pop-in
    launchFace.setAttribute("data-state", help ? "help" : "excited");
    setTimeout(function () { if (!launch.hasAttribute("data-unread")) launchFace.setAttribute("data-state", "idle"); }, 2200);
    chime(help);
    clearTimeout(greetTimer);
    greetTimer = setTimeout(hideGreeting, help ? 20000 : 12000);
  }
  function showGreeting() {
    if (alreadyGreeted() || !panel.hidden || live || msgs.length) return;
    try { localStorage.setItem(GREET_KEY, String(Date.now())); } catch (e) {}
    present("hi");
    scheduleHelp(HELP_DELAY);
  }
  function scheduleHelp(ms) {
    clearTimeout(helpTimer);
    if (helpDone()) return;
    helpTimer = setTimeout(showHelp, ms);
  }
  function showHelp() {
    if (helpDone() || !panel.hidden || live || msgs.length) return;
    if (document.hidden) { // wait until the visitor is looking at the page again
      document.addEventListener("visibilitychange", function again() {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", again);
        helpTimer = setTimeout(showHelp, 3000);
      });
      return;
    }
    try { localStorage.setItem(HELP_KEY, String(Date.now())); } catch (e) {}
    present("help");
  }
  function scheduleGreeting() {
    if (alreadyGreeted()) {
      // Same visit, another page: the help message still arrives about a minute after the first one.
      try {
        var age = Date.now() - (+localStorage.getItem(GREET_KEY));
        if (!helpDone() && age < 30 * 60 * 1000) scheduleHelp(Math.max(4000, HELP_DELAY - age));
      } catch (e) {}
      return;
    }
    function watch(banner) {
      var mo = new MutationObserver(function () {
        if (!document.body.contains(banner)) { mo.disconnect(); setTimeout(go, 1200); }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    function go() {
      var b = document.querySelector(".dn-consent"); // the cookie choice is still open: keep waiting
      if (b) return watch(b);
      showGreeting();
    }
    function start() {
      var b = document.querySelector(".dn-consent");
      if (b) watch(b); else setTimeout(go, 1200);
    }
    if (document.readyState === "complete") setTimeout(start, 2500);
    else window.addEventListener("load", function () { setTimeout(start, 2500); });
  }

  restore();
  scheduleGreeting();
})();
