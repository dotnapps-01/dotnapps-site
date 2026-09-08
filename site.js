  (function () {
    var root = document.documentElement;
    root.classList.add("js");

    /* ?debug=1 — on-screen event log to diagnose the tap-scroll report */
    if (/[?&]debug/.test(location.search)) {
      var dbg = document.createElement("div");
      dbg.style.cssText = "position:fixed;left:6px;right:6px;bottom:6px;z-index:99999;pointer-events:none;background:#000;color:#3f3;font:10px/1.3 ui-monospace,Menlo,monospace;padding:6px 8px;border-radius:8px;max-height:20vh;overflow:hidden;white-space:pre-wrap;box-shadow:0 0 0 1px #3f3";
      var lines = [];
      var dlog = function (s) {
        lines.unshift((Date.now() % 100000) + "  " + s);
        lines = lines.slice(0, 24);
        dbg.textContent = lines.join("\n");
      };
      var addDbg = function () { (document.body || root).appendChild(dbg); dlog("debug on  y=" + Math.round(scrollY)); };
      if (document.body) addDbg(); else addEventListener("DOMContentLoaded", addDbg);
      var lastDbgY = scrollY;
      addEventListener("scroll", function () {
        var d = scrollY - lastDbgY; lastDbgY = scrollY;
        if (Math.abs(d) > 3) dlog("scroll " + (d > 0 ? "+" : "") + Math.round(d) + "  -> y" + Math.round(scrollY));
      }, { passive: true });
      var tag = function (el) { return el ? (el.tagName + (el.className && el.className.toString ? "." + el.className.toString().trim().split(/\s+/)[0] : "")) : "?"; };
      document.addEventListener("click", function (e) { dlog("click " + tag(e.target) + (e.target.closest ? " in " + tag(e.target.closest("section,footer,nav")) : "")); }, true);
      document.addEventListener("focusin", function (e) { dlog("FOCUSIN " + tag(e.target)); }, true);
      addEventListener("hashchange", function () { dlog("HASHCHANGE " + location.hash); });
      addEventListener("resize", function () { dlog("resize  vh=" + innerHeight); });
    }
    var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (RM) {
      root.classList.add("reduce-motion");
      document.querySelectorAll(".viz-graph").forEach(function (s) { try { s.pauseAnimations(); } catch (e) {} });
    }

    /* theme toggle */
    var KEY = "dotnapps-site-theme";
    var tbtns = document.querySelectorAll("[data-theme-toggle]");
    try {
      var s = localStorage.getItem(KEY);
      if (s === "light" || s === "dark") root.setAttribute("data-theme", s);
    } catch (e) {}
    function curTheme() {
      return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    }
    tbtns.forEach(function (b) {
      b.addEventListener("click", function () {
        var n = curTheme() === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", n);
        try { localStorage.setItem(KEY, n); } catch (e) {}
      });
    });

    /* FAQ category tabs + single-open accordion */
    var faqTabs = document.querySelectorAll(".faq-tab");
    var faqGroups = document.querySelectorAll(".faq-group");
    if (faqTabs.length) {
      faqTabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          var cat = tab.getAttribute("data-cat");
          faqTabs.forEach(function (t) {
            var on = t === tab;
            t.classList.toggle("is-active", on);
            t.setAttribute("aria-selected", on ? "true" : "false");
          });
          faqGroups.forEach(function (g) {
            var on = g.getAttribute("data-cat") === cat;
            g.classList.toggle("is-active", on);
            g.querySelectorAll("details").forEach(function (d, i) { d.open = on && i === 0; });
          });
        });
      });
      faqGroups.forEach(function (g) {
        var ds = g.querySelectorAll("details");
        ds.forEach(function (d) {
          d.addEventListener("toggle", function () {
            if (d.open) ds.forEach(function (o) { if (o !== d) o.open = false; });
          });
        });
      });
    }

    /* touch: don't let a tap focus a toggle control — focusing scrolls it
       into view and the page appears to jump elsewhere. mousedown-preventDefault
       blocks the focus; blur() on click is a backstop for engines that focus
       on touchend anyway. Keyboard focus (Tab) is unaffected. */
    if (window.matchMedia && window.matchMedia("(hover: none)").matches) {
      document.querySelectorAll(".faq-group summary, .faq-tab").forEach(function (el) {
        el.addEventListener("mousedown", function (e) { e.preventDefault(); });
        el.addEventListener("click", function () {
          var el2 = this;
          setTimeout(function () { try { el2.blur(); } catch (e) {} }, 0);
        });
      });
    }

    /* brief form -> mailto */
    var bf = document.getElementById("brief-form");
    if (bf) {
      bf.addEventListener("submit", function (e) {
        e.preventDefault();
        var d = new FormData(bf);
        var body = "Name: " + (d.get("name") || "") +
          "\nEmail: " + (d.get("email") || "") +
          "\nCompany: " + (d.get("company") || "") +
          "\nBudget: " + (d.get("budget") || "") +
          "\nTimeline: " + (d.get("timeline") || "") +
          "\n\nWhat they're building:\n" + (d.get("detail") || "");
        var href = "mailto:hello@dotnapps.com?subject=" +
          encodeURIComponent("Project brief — " + (d.get("company") || d.get("name") || "new")) +
          "&body=" + encodeURIComponent(body);
        var done = document.getElementById("brief-done");
        if (done) done.hidden = false;
        window.location.href = href;
      });
    }

    /* dedicated form modals (careers / Business OS / general contact) */
    var fm = document.getElementById("formModal");
    if (fm && typeof fm.showModal === "function") {
      var FORMS = {
        contact:    { title: "Say hello",          sub: "A short note — we read every one.",                     to: "hello@dotnapps.com",   subj: function () { return "Hello from dotnapps.com"; } },
        careers:    { title: "Join the team",       sub: "Senior engineers and product designers who like shipping.",  to: "careers@dotnapps.com", subj: function (d) { return "Application — " + (d.get("role") || "role"); } },
        businessos: { title: "Business OS access",  sub: "Tell us what you'd run on it.",                              to: "hello@dotnapps.com",   subj: function () { return "Business OS — access request"; } }
      };
      var mTitle = fm.querySelector("[data-modal-title]");
      var mSub = fm.querySelector("[data-modal-sub]");
      var mPanels = fm.querySelectorAll(".mform");
      var mTrigger = null;

      var mScrollY = 0;
      var openModal = function (key, trigger) {
        var cfg = FORMS[key];
        if (!cfg) return;
        mTrigger = trigger || null;
        mScrollY = window.scrollY;
        mTitle.textContent = cfg.title;
        mSub.textContent = cfg.sub;
        mPanels.forEach(function (p) {
          var on = p.getAttribute("data-form") === key;
          p.hidden = !on;
          if (on) { p.reset(); p.querySelector(".mform-done").hidden = true; }
        });
        fm.showModal();
        var first = fm.querySelector(".mform:not([hidden]) input, .mform:not([hidden]) textarea");
        if (first) setTimeout(function () { first.focus(); }, 40);
      };

      document.querySelectorAll("[data-modal]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          openModal(btn.getAttribute("data-modal"), btn);
        });
      });
      fm.querySelectorAll("[data-modal-close]").forEach(function (b) {
        b.addEventListener("click", function () { fm.close(); });
      });
      fm.addEventListener("click", function (e) { if (e.target === fm) fm.close(); });
      fm.addEventListener("close", function () {
        try { window.scrollTo({ top: mScrollY, left: 0, behavior: "instant" }); } catch (e) { window.scrollTo(0, mScrollY); }
        if (mTrigger) {
          try { mTrigger.focus({ preventScroll: true }); }
          catch (e) { try { mTrigger.focus(); } catch (e2) {} }
        }
      });

      mPanels.forEach(function (form) {
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var cfg = FORMS[form.getAttribute("data-form")];
          var d = new FormData(form);
          var lines = [];
          d.forEach(function (v, k) {
            if (v) lines.push(k.charAt(0).toUpperCase() + k.slice(1) + ": " + v);
          });
          var href = "mailto:" + cfg.to +
            "?subject=" + encodeURIComponent(cfg.subj(d)) +
            "&body=" + encodeURIComponent(lines.join("\n"));
          form.querySelector(".mform-done").hidden = false;
          window.location.href = href;
        });
      });
    }

    /* person bio popup (About page) — a plain fixed overlay, toggled by
       [hidden]. Deliberately NOT a <dialog>/showModal(): on iOS that moved
       focus into the dialog and the browser scrolled the page to it, which
       read as a jump into another section. This never touches scroll or
       focus, so the page stays exactly where it was. */
    var bioModal = document.getElementById("bioModal");
    if (bioModal) {
      var bioName = bioModal.querySelector("[data-bio-name]");
      var bioRole = bioModal.querySelector("[data-bio-role]");
      var bioAva = bioModal.querySelector("[data-bio-ava]");
      var bioBody = bioModal.querySelector("[data-bio-body]");
      var bioCard = bioModal.querySelector(".bio-modal-card");
      var openBio = function (btn) {
        var src = document.querySelector('.bio-store [data-bio="' + btn.getAttribute("data-bio") + '"]');
        if (!src) return;
        bioName.textContent = src.getAttribute("data-name") || "";
        bioRole.innerHTML = src.getAttribute("data-role") || "";
        var avaImg = src.getAttribute("data-ava-img");
        if (avaImg) {
          bioAva.textContent = "";
          var im = document.createElement("img");
          im.src = avaImg; im.alt = "";
          bioAva.appendChild(im);
        } else {
          bioAva.textContent = src.getAttribute("data-ava") || "";
        }
        bioBody.innerHTML = src.innerHTML;
        if (bioCard) bioCard.scrollTop = 0;
        bioModal.hidden = false;
      };
      var closeBio = function () { bioModal.hidden = true; };
      document.querySelectorAll(".origin-row[data-bio]").forEach(function (btn) {
        btn.addEventListener("click", function (e) { e.preventDefault(); openBio(btn); });
      });
      bioModal.querySelectorAll("[data-modal-close]").forEach(function (b) {
        b.addEventListener("click", closeBio);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !bioModal.hidden) closeBio();
      });
    }

    /* nav condense — collapse on scroll-down, reveal on scroll-up */
    var nav = document.getElementById("nav");
    var lastY = window.scrollY;
    var onScrollNav = function () {
      var y = window.scrollY;
      nav.classList.toggle("scrolled", y > 40);
      if (y <= 40) {
        nav.classList.remove("show-menu");
      } else if (y < lastY - 2) {
        nav.classList.add("show-menu");
      } else if (y > lastY + 4) {
        nav.classList.remove("show-menu");
      }
      lastY = y;
    };
    onScrollNav();
    window.addEventListener("scroll", onScrollNav, { passive: true });

    /* mobile menu */
    var navToggle = document.querySelector(".nav-toggle");
    if (navToggle) {
      var closeMenu = function () {
        nav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
        var d = nav.querySelector(".nav-drop");
        if (d) d.classList.remove("open");
      };
      navToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = nav.classList.toggle("open");
        navToggle.setAttribute("aria-expanded", open ? "true" : "false");
        if (!open) { var d = nav.querySelector(".nav-drop"); if (d) d.classList.remove("open"); }
      });
      /* desktop only: "Resources" is a hover mega-menu; on mobile the panel
         is always shown (its links close the menu via the handler below) */
      var dropBtn = nav.querySelector(".nav-drop > button");
      if (dropBtn) dropBtn.addEventListener("click", function (e) {
        if (window.matchMedia("(max-width: 820px)").matches) e.preventDefault();
      });
      var onNavLinkActivate = function () {
        /* kill transitions for a beat so the anchor-scroll this click triggers
           can't animate the pill condensing (menu items sliding left); also
           drop focus so :focus-within doesn't pin the mega-menu half-open */
        nav.classList.add("nav-instant");
        setTimeout(function () { nav.classList.remove("nav-instant"); }, 600);
        if (document.activeElement && document.activeElement.blur) {
          try { document.activeElement.blur(); } catch (e) {}
        }
        closeMenu();
      };
      nav.querySelectorAll(".nav-links a").forEach(function (a) {
        a.addEventListener("click", onNavLinkActivate);
      });
      var menuClose = nav.querySelector(".menu-close");
      if (menuClose) menuClose.addEventListener("click", function (e) {
        e.stopPropagation();
        closeMenu();
      });
      document.addEventListener("click", function (e) {
        if (nav.classList.contains("open") && !nav.contains(e.target)) closeMenu();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && nav.classList.contains("open")) closeMenu();
      });
      /* desktop: a click-opened pill re-collapses when the pointer leaves it */
      nav.addEventListener("mouseleave", function () {
        if (nav.classList.contains("open") && window.matchMedia("(min-width: 821px)").matches) closeMenu();
      });
    }

    /* scroll reveal */
    var revealEls = document.querySelectorAll(".reveal, .stagger");
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add("in"); });
    }

    /* practices: hover-to-reveal on desktop only. On touch the descriptions
       are always visible (see CSS) — no tap handler, nothing to glitch. */
    if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
      document.querySelectorAll(".practice").forEach(function (card) {
        var items = [].slice.call(card.querySelectorAll("ul > li"));
        items.forEach(function (li) {
          li.addEventListener("click", function () {
            var wasOpen = li.classList.contains("is-open");
            items.forEach(function (o) { o.classList.remove("is-open"); });
            if (!wasOpen) li.classList.add("is-open");
          });
        });
      });
    }

    /* timeline activation + progress */
    var timeline = document.querySelector(".timeline");
    var steps = document.querySelectorAll(".tl-step");
    if (timeline && !RM && "IntersectionObserver" in window) {
      var tio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { en.target.classList.toggle("active", en.isIntersecting); });
      }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
      steps.forEach(function (st) { tio.observe(st); });

      var ticking = false;
      var updateProgress = function () {
        ticking = false;
        var r = timeline.getBoundingClientRect();
        var total = r.height - 52;
        if (total <= 0) return;
        var scrolled = Math.min(Math.max(window.innerHeight * 0.5 - r.top - 26, 0), total);
        timeline.style.setProperty("--progress", (scrolled / total).toFixed(3));
      };
      var reqProgress = function () { if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); } };
      updateProgress();
      window.addEventListener("scroll", reqProgress, { passive: true });
      window.addEventListener("resize", reqProgress);
    } else if (timeline) {
      steps.forEach(function (st) { st.classList.add("active"); });
    }

    /* "Ship it" endless-runner mini-game */
    var gameWrap = document.querySelector("[data-game]");
    if (gameWrap) {
      var stage = gameWrap.querySelector("[data-stage]");
      var canvas = gameWrap.querySelector("[data-canvas]");
      var ctx = canvas.getContext("2d");
      var scoreEl = gameWrap.querySelector("[data-score]");
      var bestEl = gameWrap.querySelector("[data-best]");
      var timeEl = gameWrap.querySelector("[data-time]");
      var levelEl = gameWrap.querySelector("[data-level]");
      var msgEl = gameWrap.querySelector("[data-msg]");
      var hintEl = gameWrap.querySelector("[data-hint]");
      var startBtn = gameWrap.querySelector("[data-start]");
      var padBtn = gameWrap.querySelector("[data-jump]");
      var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      if (coarse && stage) stage.removeAttribute("tabindex");
      var BEST_KEY = "dotnapps-site-runner-best";
      var W = 680, H = 180, GROUND = 150;

      var fitCanvas = function () {
        var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      fitCanvas();
      window.addEventListener("resize", fitCanvas);

      var col = {};
      var readColors = function () {
        var cs = getComputedStyle(stage);
        var g = function (n, f) { return (cs.getPropertyValue(n) || "").trim() || f; };
        col.text = g("--text", "#1d1d1f");
        col.muted = g("--muted", "#6e6e73");
        col.faint = g("--faint", "#8a8a8e");
        col.hair = g("--hairline", "#d2d2d7");
        col.sunken = g("--sunken", "#f5f5f7");
      };
      readColors();

      var best = 0;
      try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) {}
      bestEl.textContent = String(best);

      var stateG = "idle"; /* idle | run | over */
      var runner, obstacles, clouds, dashes, speed, scoreAcc, shown, spawnIn, frame, raf, lastT;
      var elapsed, shownT, diff, curLevel;

      /* difficulty is a 0..1 ramp driven purely by seconds survived */
      var LEVELS = [
        [0.14, "Warm-up"], [0.38, "Easy"], [0.62, "Cruising"], [0.84, "Brisk"], [1.1, "Relentless"]
      ];
      var levelFor = function (d) {
        for (var i = 0; i < LEVELS.length; i++) if (d < LEVELS[i][0]) return LEVELS[i][1];
        return "Relentless";
      };

      var reset = function () {
        runner = { x: 64, y: GROUND, w: 34, h: 34, vy: 0, onGround: true };
        obstacles = [];
        clouds = [{ x: 170, y: 38, s: 0.16 }, { x: 400, y: 24, s: 0.1 }, { x: 600, y: 52, s: 0.22 }];
        dashes = [];
        for (var i = 0; i < 10; i++) dashes.push(i * 74 + 12);
        speed = 205; scoreAcc = 0; shown = 0; spawnIn = 300; frame = 0;
        elapsed = 0; shownT = -1; diff = 0; curLevel = "";
      };

      var jump = function () {
        if (runner.onGround) { runner.vy = -638; runner.onGround = false; }
      };

      var spawnObstacle = function () {
        var d = diff, r = Math.random(), o;
        var small = { w: 22, h: 20 }, tallShort = { w: 26, h: 26 },
            tall = { w: 26, h: 32 }, dbl = { w: 46, h: 22 }, bigTall = { w: 30, h: 38 };
        if (d < 0.25) {
          o = r < 0.78 ? small : tallShort;                       /* easy: low singles */
        } else if (d < 0.6) {
          o = r < 0.44 ? small : r < 0.72 ? tallShort : r < 0.9 ? tall : dbl;
        } else {
          o = r < 0.28 ? small : r < 0.52 ? tall : r < 0.8 ? dbl : bigTall;
        }
        o = { w: o.w, h: o.h, x: W + 20 };
        obstacles.push(o);
        /* seconds of clear track before the next one, tightening with time */
        var gapS = (1.55 - d * 0.82) + Math.random() * (0.55 - d * 0.34);
        spawnIn = Math.max(135, gapS * speed);
      };

      var overlap = function (a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      };

      var step = function (dt) {
        frame++;
        elapsed += dt;
        var ws = Math.floor(elapsed);
        if (ws !== shownT) { shownT = ws; timeEl.textContent = String(ws); }

        /* 0 -> 1 over the first 50s, then a slow endless creep */
        diff = Math.min(1, elapsed / 50);
        speed = 205 + diff * 360 + Math.max(0, elapsed - 50) * 1.6;
        if (speed > 640) speed = 640;
        var lvl = levelFor(diff);
        if (lvl !== curLevel) { curLevel = lvl; levelEl.textContent = lvl; }

        scoreAcc += speed * dt * 0.025;
        var s = Math.floor(scoreAcc);
        if (s !== shown) { shown = s; scoreEl.textContent = String(s); }

        runner.vy += 2100 * dt;
        runner.y += runner.vy * dt;
        if (runner.y >= GROUND) { runner.y = GROUND; runner.vy = 0; runner.onGround = true; }

        for (var i = 0; i < dashes.length; i++) {
          dashes[i] -= speed * dt;
          if (dashes[i] < -16) dashes[i] += 740;
        }
        for (var c = 0; c < clouds.length; c++) {
          clouds[c].x -= speed * clouds[c].s * dt;
          if (clouds[c].x < -50) { clouds[c].x = W + 30 + Math.random() * 90; clouds[c].y = 18 + Math.random() * 44; }
        }

        spawnIn -= speed * dt;
        if (spawnIn <= 0) spawnObstacle();
        var rb = { x: runner.x + 5, y: runner.y - runner.h + 4, w: runner.w - 10, h: runner.h - 6 };
        for (var k = obstacles.length - 1; k >= 0; k--) {
          var o = obstacles[k];
          o.x -= speed * dt;
          if (o.x + o.w < -12) { obstacles.splice(k, 1); continue; }
          var ob = { x: o.x + 3, y: GROUND - o.h + 3, w: o.w - 6, h: o.h - 6 };
          if (overlap(rb, ob)) { gameOver(); return; }
        }
      };

      var roundRect = function (x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };

      var drawBug = function (x, cy, w, h) {
        var cx = x + w / 2;
        ctx.strokeStyle = col.text; ctx.fillStyle = col.text;
        ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.3, cy - h * 0.12); ctx.lineTo(cx - w * 0.72, cy - h * 0.4);
        ctx.moveTo(cx - w * 0.32, cy + h * 0.1); ctx.lineTo(cx - w * 0.74, cy + h * 0.1);
        ctx.moveTo(cx - w * 0.3, cy + h * 0.32); ctx.lineTo(cx - w * 0.68, cy + h * 0.56);
        ctx.moveTo(cx + w * 0.3, cy - h * 0.12); ctx.lineTo(cx + w * 0.72, cy - h * 0.4);
        ctx.moveTo(cx + w * 0.32, cy + h * 0.1); ctx.lineTo(cx + w * 0.74, cy + h * 0.1);
        ctx.moveTo(cx + w * 0.3, cy + h * 0.32); ctx.lineTo(cx + w * 0.68, cy + h * 0.56);
        ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.5, h * 0.56, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy - h * 0.64, w * 0.22, 0, Math.PI * 2); ctx.fill();
      };

      var draw = function () {
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = col.faint; ctx.globalAlpha = 0.45;
        for (var c = 0; c < clouds.length; c++) {
          var cl = clouds[c];
          ctx.beginPath();
          ctx.arc(cl.x, cl.y, 9, 0, 7);
          ctx.arc(cl.x + 12, cl.y + 3, 7, 0, 7);
          ctx.arc(cl.x - 11, cl.y + 3, 6, 0, 7);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.strokeStyle = col.hair; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, GROUND + 1); ctx.lineTo(W, GROUND + 1); ctx.stroke();
        ctx.strokeStyle = col.faint;
        ctx.beginPath();
        for (var d = 0; d < dashes.length; d++) { ctx.moveTo(dashes[d], GROUND + 9); ctx.lineTo(dashes[d] + 12, GROUND + 9); }
        ctx.stroke();

        for (var k = 0; k < obstacles.length; k++) {
          var o = obstacles[k];
          if (o.w > 40) {
            drawBug(o.x, GROUND - 11, 22, 20);
            drawBug(o.x + 24, GROUND - 11, 22, 20);
          } else {
            drawBug(o.x, GROUND - o.h / 2, o.w, o.h);
          }
        }

        var ry = runner.y - runner.h;
        ctx.fillStyle = col.text;
        roundRect(runner.x, ry, runner.w, runner.h, 9); ctx.fill();
        ctx.fillStyle = col.sunken;
        ctx.beginPath();
        ctx.moveTo(runner.x + runner.w * 0.54, ry + 6);
        ctx.lineTo(runner.x + runner.w * 0.74, ry + 6);
        ctx.lineTo(runner.x + runner.w * 0.48, ry + runner.h - 6);
        ctx.lineTo(runner.x + runner.w * 0.28, ry + runner.h - 6);
        ctx.closePath(); ctx.fill();

        ctx.strokeStyle = col.text; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath();
        if (runner.onGround) {
          var sw = Math.sin(frame * 0.45) * 4;
          ctx.moveTo(runner.x + 10, runner.y); ctx.lineTo(runner.x + 10 + sw, runner.y + 6);
          ctx.moveTo(runner.x + runner.w - 10, runner.y); ctx.lineTo(runner.x + runner.w - 10 - sw, runner.y + 6);
        } else {
          ctx.moveTo(runner.x + 12, runner.y - 1); ctx.lineTo(runner.x + 7, runner.y + 3);
          ctx.moveTo(runner.x + runner.w - 12, runner.y - 1); ctx.lineTo(runner.x + runner.w - 7, runner.y + 3);
        }
        ctx.stroke();

        ctx.fillStyle = col.muted;
        ctx.font = "600 12px 'Space Grotesk', system-ui, sans-serif";
        ctx.textAlign = "right";
        var sc = String(shown); while (sc.length < 5) sc = "0" + sc;
        ctx.fillText(sc, W - 14, 22);
      };

      var loop = function (t) {
        if (stateG !== "run") return;
        if (!lastT) lastT = t;
        var dt = Math.min(0.05, (t - lastT) / 1000);
        lastT = t;
        readColors();
        step(dt);
        if (stateG === "run") { draw(); raf = window.requestAnimationFrame(loop); }
      };

      var start = function () {
        reset();
        readColors();
        stateG = "run";
        lastT = 0;
        hintEl.hidden = true;
        msgEl.textContent = "";
        scoreEl.textContent = "0";
        timeEl.textContent = "0";
        levelEl.textContent = "Warm-up";
        startBtn.disabled = true;
        startBtn.textContent = "Running…";
        window.cancelAnimationFrame(raf);
        raf = window.requestAnimationFrame(loop);
      };

      function gameOver() {
        stateG = "over";
        window.cancelAnimationFrame(raf);
        draw();
        startBtn.disabled = false;
        startBtn.textContent = "Run again";
        hintEl.textContent = coarse ? "Tap the button to run again" : "Space or tap to run again";
        hintEl.hidden = false;
        var secs = Math.floor(elapsed);
        var line = "You lasted <b>" + secs + "s</b> &mdash; <b>" + shown + "</b> shipped &mdash; at <b>" + curLevel + "</b> pace.";
        if (shown > best) {
          best = shown;
          try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
          bestEl.textContent = String(best);
          line = "New best &mdash; <b>" + shown + "</b> shipped in <b>" + secs + "s</b>. <a href=\"#contact\">Do it for real</a>.";
        }
        msgEl.innerHTML = line;
      }

      var onInput = function (e) {
        if (e && e.cancelable) e.preventDefault();
        if (stateG === "run") jump();
        else start();
      };

      stage.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Spacebar" || e.code === "Space" || e.key === "ArrowUp") onInput(e);
      });
      stage.addEventListener("pointerdown", function (e) {
        if (e && e.cancelable) e.preventDefault();
        onInput(e);
        /* only steal focus for keyboard play — on touch, focus() scrolls the
           stage into view (iOS ignores preventScroll) and the page jumps */
        if (!coarse) { try { stage.focus({ preventScroll: true }); } catch (err) {} }
      });
      startBtn.addEventListener("click", function () { if (stateG !== "run") start(); });

      if (padBtn) {
        var padPress = function (e) {
          if (e && e.cancelable) e.preventDefault();
          padBtn.classList.add("is-pressed");
          onInput();
        };
        var padRelease = function () {
          padBtn.classList.remove("is-pressed");
          try { padBtn.blur(); } catch (e) {}
        };
        padBtn.addEventListener("pointerdown", padPress);
        padBtn.addEventListener("pointerup", padRelease);
        padBtn.addEventListener("pointercancel", padRelease);
        padBtn.addEventListener("pointerleave", padRelease);
        padBtn.addEventListener("click", function (e) { e.preventDefault(); });
      }

      if (coarse) hintEl.textContent = "Tap the button to jump";

      reset();
      draw();
    }

    if (RM) return; /* skip pointer-motion niceties */

    /* hero chip parallax */
    var hero = document.querySelector(".hero");
    var chips = document.querySelectorAll(".chip");
    if (hero && chips.length && window.matchMedia("(pointer:fine)").matches) {
      var praf = false;
      hero.addEventListener("mousemove", function (e) {
        if (praf) return;
        praf = true;
        requestAnimationFrame(function () {
          praf = false;
          var b = hero.getBoundingClientRect();
          var dx = (e.clientX - (b.left + b.width / 2)) / b.width;
          var dy = (e.clientY - (b.top + b.height / 2)) / b.height;
          chips.forEach(function (c, i) {
            var depth = 6 + (i % 4) * 5;
            c.style.translate = (dx * depth).toFixed(1) + "px " + (dy * depth).toFixed(1) + "px";
          });
        });
      });
      hero.addEventListener("mouseleave", function () {
        chips.forEach(function (c) { c.style.translate = "0px 0px"; });
      });
    }

    /* engagement spotlight */
    document.querySelectorAll(".model").forEach(function (m) {
      m.addEventListener("mousemove", function (e) {
        var r = m.getBoundingClientRect();
        m.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
        m.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
      });
    });

    /* magnetic CTA */
    document.querySelectorAll(".magnetic").forEach(function (wrap) {
      var btn = wrap.querySelector(".btn");
      if (!btn) return;
      wrap.addEventListener("mousemove", function (e) {
        var r = wrap.getBoundingClientRect();
        var x = e.clientX - (r.left + r.width / 2);
        var y = e.clientY - (r.top + r.height / 2);
        btn.style.transform = "translate(" + (x * 0.3).toFixed(1) + "px," + (y * 0.4).toFixed(1) + "px)";
      });
      wrap.addEventListener("mouseleave", function () { btn.style.transform = ""; });
    });
  })();
