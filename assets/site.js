// stelint site: the compare editor and small effects.
// It reads window.STELINT_DATA from assets/data.js.
(function () {
  "use strict";

  document.documentElement.classList.remove("no-js");
  const DATA = window.STELINT_DATA || { examples: [] };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ---------- syntax classes, one for each character ----------

  function classesRust(line) {
    const cls = new Array(line.length).fill("");
    const m = line.match(/^(\s*)(\/\/[\/!]?)(.*)$/);
    if (m) {
      const a = m[1].length;
      const b = a + m[2].length;
      for (let i = a; i < b; i++) cls[i] = "s-mk";
      for (let i = b; i < line.length; i++) cls[i] = "s-doc";
      const body = m[3];
      if (/^\s*#/.test(body)) for (let i = b; i < line.length; i++) cls[i] = "s-h";
      markInline(line, cls, b);
      return cls;
    }
    // code line
    for (let i = 0; i < line.length; i++) cls[i] = /[(){}<>:;,&.\-=]/.test(line[i]) ? "s-p" : "";
    const re = /\b(pub|fn|let|mut|impl|struct|enum|use|mod|return|if|else|match|for|in|self|Self)\b|\b([A-Z][A-Za-z0-9_]*)\b/g;
    let t;
    while ((t = re.exec(line))) {
      const c = t[1] ? "s-kw" : "s-ty";
      for (let i = t.index; i < t.index + t[0].length; i++) cls[i] = c;
    }
    return cls;
  }

  function markInline(line, cls, from) {
    const re = /`[^`]*`/g;
    re.lastIndex = from;
    let t;
    while ((t = re.exec(line))) for (let i = t.index; i < t.index + t[0].length; i++) cls[i] = "s-code";
    const rb = /\*\*[^*]+\*\*/g;
    rb.lastIndex = from;
    while ((t = rb.exec(line))) for (let i = t.index; i < t.index + t[0].length; i++) if (!cls[i] || cls[i] === "s-doc") cls[i] = "s-b";
  }

  function classesMarkdown(lines) {
    let fence = false;
    return lines.map((line) => {
      const cls = new Array(line.length).fill("");
      if (/^\s*```/.test(line)) {
        fence = !fence;
        return cls.fill("s-fence");
      }
      if (fence) return cls.fill("s-code");
      if (/^#{1,6}\s/.test(line)) return cls.fill("s-h");
      const q = line.match(/^>\s?/);
      if (q) for (let i = 0; i < q[0].length; i++) cls[i] = "s-q";
      const li = line.match(/^\s*(\d+\.|[-*])\s/);
      if (li) for (let i = 0; i < li[0].length; i++) cls[i] = "s-mk";
      markInline(line, cls, 0);
      return cls;
    });
  }

  // ---------- code rendering ----------

  function renderCode(text, lang, diags, withIds) {
    const lines = text.replace(/\n$/, "").split("\n");
    const syn = lang === "rust" ? lines.map(classesRust) : classesMarkdown(lines);
    const byLine = new Map();
    diags.forEach((d, i) => {
      if (!byLine.has(d.line)) byLine.set(d.line, []);
      byLine.get(d.line).push({ ...d, i });
    });
    const out = [];
    lines.forEach((line, li) => {
      const chars = Array.from(line);
      // map from code unit index to char index for wide chars
      const unitToChar = [];
      let u = 0;
      chars.forEach((ch, ci) => {
        for (let k = 0; k < ch.length; k++) unitToChar[u++] = ci;
      });
      const err = new Array(chars.length).fill(-1);
      (byLine.get(li + 1) || []).forEach((d) => {
        const a = unitToChar[d.start] ?? chars.length;
        const end = unitToChar[Math.min(d.start + d.len, line.length) - 1];
        const b = end === undefined ? chars.length : end + 1;
        for (let k = a; k < b; k++) if (err[k] === -1) err[k] = d.i;
      });
      const cls = chars.map((_, ci) => {
        const unit = unitToChar.indexOf(ci);
        return syn[li][unit] || "";
      });
      let html = "";
      let k = 0;
      while (k < chars.length) {
        const e = err[k];
        let j = k;
        while (j < chars.length && err[j] === e) j++;
        let inner = "";
        let p = k;
        while (p < j) {
          let q = p;
          while (q < j && cls[q] === cls[p]) q++;
          const t = esc(chars.slice(p, q).join(""));
          inner += cls[p] ? `<span class="${cls[p]}">${t}</span>` : t;
          p = q;
        }
        html += e >= 0 ? `<span class="x" tabindex="${withIds ? 0 : -1}" data-d="${e}">${inner}</span>` : inner;
        k = j;
      }
      const has = byLine.has(li + 1) ? " has-err" : "";
      out.push(`<span class="l${has}">${html || " "}</span>`);
    });
    return `<pre class="code">${out.join("")}</pre>`;
  }

  // ---------- tooltip ----------

  const tip = document.createElement("div");
  tip.className = "tip";
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  let tipFor = null;

  function showTip(el, d) {
    tip.innerHTML = `<span class="rule">${esc(d.rule)}</span> ${esc(d.msg)}${d.help ? `<span class="help">help: ${esc(d.help)}</span>` : ""}`;
    const r = el.getBoundingClientRect();
    tip.classList.add("on");
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let x = Math.min(Math.max(12, r.left), window.innerWidth - tw - 12);
    let y = r.top - th - 10;
    if (y < 70) y = r.bottom + 10;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
    tipFor = el;
  }

  function hideTip() {
    tip.classList.remove("on");
    tipFor = null;
  }

  function bindDiags(root, diags, list) {
    const hot = (i, on) => {
      $$(`.x[data-d="${i}"]`, root).forEach((x) => x.classList.toggle("hot", on));
      if (list) {
        const li = $(`li[data-d="${i}"]`, list);
        if (li) li.classList.toggle("hot", on);
      }
    };
    root.addEventListener("pointerover", (ev) => {
      const x = ev.target.closest(".x");
      if (!x || !root.contains(x)) return;
      const i = +x.dataset.d;
      showTip(x, diags[i]);
      hot(i, true);
    });
    root.addEventListener("pointerout", (ev) => {
      const x = ev.target.closest(".x");
      if (!x) return;
      hot(+x.dataset.d, false);
      if (tipFor === x) hideTip();
    });
    root.addEventListener("focusin", (ev) => {
      const x = ev.target.closest(".x");
      if (x) {
        showTip(x, diags[+x.dataset.d]);
        hot(+x.dataset.d, true);
      }
    });
    root.addEventListener("focusout", (ev) => {
      const x = ev.target.closest(".x");
      if (x) {
        hot(+x.dataset.d, false);
        hideTip();
      }
    });
    if (list) {
      list.addEventListener("pointerover", (ev) => {
        const li = ev.target.closest("li");
        if (li) hot(+li.dataset.d, true);
      });
      list.addEventListener("pointerout", (ev) => {
        const li = ev.target.closest("li");
        if (li) hot(+li.dataset.d, false);
      });
    }
  }

  window.addEventListener("scroll", hideTip, { passive: true });

  // ---------- the compare editor ----------

  const PAIN = {
    verbose: "<b>Long sentences.</b> Some sentences hold two or three facts.",
    names: "<b>Four names for two objects.</b> Callers \u201cnever block\u201d, but on a miss the caller waits.",
    noise: "<b>Soft words.</b> \u201cYou can tune\u201d, \u201ce.g.\u201d and \u201cbump it up\u201d give no clear instruction.",
    contradiction: "<b>Two instructions that do not agree.</b> One sentence tells you to drain the traffic. The next sentence tells you that the script does it.",
  };

  function initCompare() {
    const stage = $("#stage");
    if (!stage || !DATA.examples.length) return;
    const tabs = $("#tabs", stage);
    const cmp = $("#compare", stage);
    const mirror = $("#mirror", stage);
    const list = $("#diags");
    const dict = $("#dict");
    const painLine = $("#pain-line");
    let pos = 62;
    let current = 0;

    DATA.examples.forEach((ex, i) => {
      const b = document.createElement("button");
      b.className = "tab";
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", i === 0 ? "true" : "false");
      b.innerHTML = `<span class="dot ${ex.lang === "markdown" ? "md" : ""}"></span>${esc(ex.file)}`;
      b.addEventListener("click", () => select(i));
      tabs.appendChild(b);
    });

    function setPos(p, animate) {
      pos = Math.max(0, Math.min(100, p));
      stage.style.setProperty("--pos", pos + "%");
      const h = $(".handle", cmp);
      if (h) h.setAttribute("aria-valuenow", Math.round(pos));
      $$("#view-toggle button").forEach((b) => {
        b.classList.toggle("on", (b.dataset.v === "before" && pos >= 99) || (b.dataset.v === "after" && pos <= 1));
      });
    }

    function select(i) {
      current = i;
      const ex = DATA.examples[i];
      $$(".tab", tabs).forEach((t, k) => t.setAttribute("aria-selected", k === i ? "true" : "false"));
      const nb = ex.before.diags.length;
      cmp.innerHTML = `
        <div class="pane before">
          <div class="pane-head"><span>agent</span><span class="count">${nb} errors</span></div>
          ${renderCode(ex.before.text, ex.lang, ex.before.diags, true)}
        </div>
        <div class="pane after" aria-label="after stelint">
          <div class="pane-head"><span class="count">0 errors</span><span>after stelint</span></div>
          ${renderCode(ex.after.text, ex.lang, [], false)}
        </div>
        <div class="handle" role="slider" tabindex="0" aria-label="Divider between the two texts" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pos)}">
          <div class="knob"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg></div>
        </div>`;
      // the mirror is a copy without focus or ids
      mirror.innerHTML = "";
      const copy = cmp.cloneNode(true);
      copy.removeAttribute("id");
      copy.setAttribute("aria-hidden", "true");
      $$("[tabindex]", copy).forEach((n) => n.setAttribute("tabindex", "-1"));
      mirror.appendChild(copy);
      mirror.setAttribute("inert", "");

      list.innerHTML = ex.before.diags
        .map(
          (d, k) =>
            `<li data-d="${k}"><span class="pos">${d.line}:${d.start + 1}</span><span><span class="rule">${esc(d.rule)}</span> <span class="msg">${esc(d.msg)}</span>${d.help ? `<span class="help">${esc(d.help)}</span>` : ""}</span></li>`
        )
        .join("");
      $("#diag-count").textContent = `${nb} errors`;
      $("#diag-file").textContent = ex.file;
      dict.innerHTML = ex.dictionary.map(([t, m]) => `<tr><td>${esc(t)}</td><td>${esc(m)}</td></tr>`).join("");
      painLine.innerHTML = PAIN[ex.pain] || "";
      bindDiags(cmp, ex.before.diags, list);
      bindHandle();
      setPos(pos);
    }

    function bindHandle() {
      const handle = $(".handle", cmp);
      let dragging = false;
      const at = (ev) => {
        const r = cmp.getBoundingClientRect();
        return ((ev.clientX - r.left) / r.width) * 100;
      };
      handle.addEventListener("pointerdown", (ev) => {
        dragging = true;
        cmp.classList.add("dragging");
        handle.setPointerCapture(ev.pointerId);
        ev.preventDefault();
      });
      handle.addEventListener("pointermove", (ev) => {
        if (dragging) setPos(at(ev));
      });
      const stop = () => {
        dragging = false;
        cmp.classList.remove("dragging");
      };
      handle.addEventListener("pointerup", stop);
      handle.addEventListener("pointercancel", stop);
      handle.addEventListener("keydown", (ev) => {
        const step = ev.shiftKey ? 10 : 4;
        if (ev.key === "ArrowLeft") setPos(pos - step);
        else if (ev.key === "ArrowRight") setPos(pos + step);
        else if (ev.key === "Home") setPos(0);
        else if (ev.key === "End") setPos(100);
        else return;
        ev.preventDefault();
      });
      // a click on the editor (not on a diagnostic) moves the line there
      cmp.addEventListener("click", (ev) => {
        if (ev.target.closest(".x") || ev.target.closest(".handle")) return;
        if (window.getSelection && String(window.getSelection())) return;
        if (matchMedia("(max-width: 900px)").matches) glide(pos > 50 ? 0 : 100);
        else glide(at(ev));
      });
    }

    let raf = 0;
    function glide(to, ms = 520) {
      cancelAnimationFrame(raf);
      const from = pos;
      const t0 = performance.now();
      const ease = (t) => 1 - Math.pow(1 - t, 3);
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        setPos(from + (to - from) * ease(t));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    $$("#view-toggle button").forEach((b) =>
      b.addEventListener("click", () => glide(b.dataset.v === "before" ? 100 : b.dataset.v === "after" ? 0 : 50))
    );

    select(0);
    setPos(96);
    // a sweep when the editor comes into view. On a narrow screen the lines
    // wrap, so the two texts do not align: show one text at a time there.
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const narrow = matchMedia("(max-width: 900px)").matches;
    if (narrow) {
      setPos(100);
    } else if (reduce) {
      setPos(50);
    } else {
      const io = new IntersectionObserver(
        (es) => {
          if (es.some((e) => e.isIntersecting)) {
            io.disconnect();
            // show all of the new text, then stop in the middle
            setTimeout(() => glide(3, 1500), 250);
            setTimeout(() => glide(50, 1100), 2700);
          }
        },
        { threshold: 0.45 }
      );
      io.observe(cmp);
    }
  }

  // ---------- the hero terminal ----------

  function initTerm() {
    const t = $("#term-body");
    if (!t || !DATA.examples.length) return;
    const ex = DATA.examples[1];
    const n = ex.before.diags.length;
    const first = ex.before.diags.slice(0, 3);
    const script = [
      { html: `<span class="ps">$</span> stelint src/price_cache.rs`, type: true },
      ...first.map((d) => ({ html: `<span class="e">error[${esc(d.rule)}]</span> <span class="d">${esc(d.msg)}</span>` })),
      { html: `<span class="d">…</span>` },
      { html: `<span class="e">${n} errors</span><span class="d">, 0 warnings</span>` },
      { html: `<span class="ps">$</span> <span class="d"># the agent writes the comment again</span>`, type: true, wait: 900 },
      { html: `<span class="ps">$</span> stelint src/price_cache.rs`, type: true },
      { html: `<span class="o">0 errors</span><span class="d">, 0 warnings</span>` },
    ];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      t.innerHTML = script.map((s) => `<div class="ln">${s.html}</div>`).join("");
      return;
    }
    let i = 0;
    const next = () => {
      if (i >= script.length) {
        const c = document.createElement("div");
        c.className = "ln";
        c.innerHTML = `<span class="ps">$</span> <span class="caret"></span>`;
        t.appendChild(c);
        return;
      }
      const s = script[i++];
      const ln = document.createElement("div");
      ln.className = "ln";
      t.appendChild(ln);
      if (s.type) {
        const tmp = document.createElement("div");
        tmp.innerHTML = s.html;
        const full = tmp.textContent;
        const prefix = full.startsWith("$ ") ? 2 : 0;
        let k = prefix;
        const step = () => {
          ln.innerHTML = `<span class="ps">$</span> ${esc(full.slice(prefix, k))}<span class="caret"></span>`;
          if (k++ < full.length) setTimeout(step, 28 + Math.random() * 40);
          else {
            ln.innerHTML = s.html;
            setTimeout(next, 260);
          }
        };
        setTimeout(step, s.wait || 300);
      } else {
        ln.innerHTML = s.html;
        setTimeout(next, 110);
      }
    };
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        io.disconnect();
        next();
      }
    });
    io.observe(t);
  }

  // ---------- numbers from the data ----------

  function initNumbers() {
    const ex = DATA.examples;
    if (!ex.length) return;
    const sum = (f) => ex.reduce((a, e) => a + f(e), 0);
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set("n-diags", sum((e) => e.before.diags.length));
  }

  // ---------- single sentences ----------

  // The text of a comment without its markers, with each diagnostic marked.
  function commentInline(text, diags) {
    const lines = text.replace(/\n$/, "").split("\n");
    return lines
      .map((line, li) => {
        const m = line.match(/^\s*\/\/[\/!]?\s?/);
        const cut = m ? m[0].length : 0;
        const body = line.slice(cut);
        const err = new Array(body.length).fill(-1);
        diags.forEach((d, i) => {
          if (d.line !== li + 1 || d.rule === "line-width") return;
          const from = Math.max(0, d.start - cut);
          for (let k = from; k < Math.min(from + d.len, body.length); k++) if (err[k] === -1) err[k] = i;
        });
        let html = "";
        let k = 0;
        while (k < body.length) {
          let j = k;
          while (j < body.length && err[j] === err[k]) j++;
          const t = esc(body.slice(k, j));
          html += err[k] >= 0 ? `<s>${t}</s>` : t;
          k = j;
        }
        return html;
      })
      .join(" ");
  }

  function initCases() {
    const root = $("#cases");
    if (!root || !DATA.cases) return;
    root.innerHTML = DATA.cases
      .map(
        (c) => `
        <article class="pain case">
          <span class="tag">${esc(c.tag)}</span>
          <h3>${esc(c.title)}</h3>
          <div class="quote">${commentInline(c.before.text, c.before.diags)}</div>
          <ul class="case-diags">${c.before.diags
            .map((d) => `<li><span class="rule">${esc(d.rule)}</span> ${esc(d.msg)}</li>`)
            .join("")}</ul>
          <div class="quote ok">${commentInline(c.after.text, [])}</div>
        </article>`
      )
      .join("");
  }

  // ---------- small things ----------

  function initCopy() {
    $$(".cmd").forEach((c) => {
      const b = document.createElement("button");
      b.className = "copy";
      b.type = "button";
      b.setAttribute("aria-label", "Copy");
      b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
      b.addEventListener("click", async () => {
        const text = $$(".c", c)
          .map((n) => n.textContent)
          .join("\n");
        try {
          await navigator.clipboard.writeText(text);
          b.classList.add("done");
          setTimeout(() => b.classList.remove("done"), 1200);
        } catch (_) {
          /* no clipboard */
        }
      });
      c.appendChild(b);
    });
  }

  function initReveal() {
    const els = $$(".rv");
    if (!("IntersectionObserver" in window)) return els.forEach((e) => e.classList.add("in"));
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((e) => io.observe(e));
  }

  function initTop() {
    const top = $(".top");
    if (!top) return;
    const f = () => top.classList.toggle("scrolled", window.scrollY > 8);
    f();
    window.addEventListener("scroll", f, { passive: true });
  }

  function initLoop() {
    const cells = $$("#loop > div");
    if (!cells.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    setInterval(() => {
      cells.forEach((c, k) => c.classList.toggle("lit", k === i));
      i = (i + 1) % cells.length;
    }, 1300);
  }

  initTop();
  initNumbers();
  initCompare();
  initCases();
  initTerm();
  initCopy();
  initLoop();
  initReveal();
})();
