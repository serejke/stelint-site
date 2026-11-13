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

  // Binds the events one time. `diagsOf` gives the diagnostics of the text
  // that the editor shows now.
  function bindDiags(root, diagsOf, list) {
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
      showTip(x, diagsOf()[i]);
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
        showTip(x, diagsOf()[+x.dataset.d]);
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

  // ---------- the compare editor: the files of one project ----------

  const PAIN = {
    verbose: "<b>Long sentences, rare words.</b> \u201cExponential\u201d, \u201ctransient\u201d, \u201ccapped\u201d.",
    names: "<b>Words outside the dictionary.</b> \u201cStale-while-revalidate\u201d, \u201ccold miss\u201d, \u201csweeper\u201d.",
    noise: "<b>Hedges and slang.</b> \u201cYou can tune\u201d, \u201ce.g.\u201d, \u201cbump it up\u201d.",
    contradiction: "<b>Two instructions that do not agree.</b> Drain the traffic first, or let the script do it?",
  };

  // The file that the editor shows first.
  const FIRST_FILE = "src/cache/price_cache.rs";

  // A tree of the paths: folders first, then files, each sorted by name.
  function fileTree(files) {
    const root = { dirs: {}, files: [] };
    files.forEach((f, i) => {
      const parts = f.file.split("/");
      let node = root;
      parts.slice(0, -1).forEach((p) => (node = node.dirs[p] = node.dirs[p] || { dirs: {}, files: [] }));
      node.files.push({ name: parts[parts.length - 1], i });
    });
    const rows = [];
    const walk = (node, prefix) => {
      const kids = [
        ...Object.keys(node.dirs)
          .sort()
          .map((d) => ({ dir: d, node: node.dirs[d] })),
        ...node.files.sort((a, b) => a.name.localeCompare(b.name)),
      ];
      kids.forEach((k, n) => {
        const last = n === kids.length - 1;
        const br = prefix + (last ? "└─ " : "├─ ");
        if (k.dir) {
          rows.push({ br, name: k.dir + "/" });
          walk(k.node, prefix + (last ? "   " : "│  "));
        } else rows.push({ br, name: k.name, i: k.i });
      });
    };
    walk(root, "");
    return rows;
  }

  function initCompare() {
    const stage = $("#stage");
    const P = DATA.project;
    if (!stage || !P || !P.files.length) return;
    const tree = $("#files", stage);
    const cmp = $("#compare", stage);
    const list = $("#diags");
    const dict = $("#dict");
    const painLine = $("#pain-line");
    const files = P.files;
    let pos = 62;
    let current = Math.max(0, files.findIndex((f) => f.file === FIRST_FILE));

    tree.innerHTML =
      `<div class="ft-root">tidepool/</div>` +
      fileTree(files)
        .map((r) => {
          const br = `<span class="br">${r.br}</span>`;
          if (r.i === undefined) return `<div class="ft-dir">${br}${esc(r.name)}</div>`;
          const n = files[r.i].before.diags.length;
          return `<button type="button" class="ft-file" role="tab" data-i="${r.i}">${br}<span class="nm">${esc(r.name)}</span><span class="ft-n"><span class="e">${n}</span><span class="ar">→</span><span class="o">0</span></span></button>`;
        })
        .join("");
    tree.addEventListener("click", (ev) => {
      const b = ev.target.closest(".ft-file");
      if (b) select(+b.dataset.i);
    });

    function setPos(p) {
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
      const f = files[i];
      $$(".ft-file", tree).forEach((t) => t.setAttribute("aria-selected", +t.dataset.i === i ? "true" : "false"));
      const nb = f.before.diags.length;
      cmp.innerHTML = `
        <div class="pane before">
          <div class="pane-head"><span>before the check</span><span class="count">${nb} errors</span></div>
          ${renderCode(f.before.text, f.lang, f.before.diags, true)}
        </div>
        <div class="pane after" aria-label="after the check">
          <div class="pane-head"><span class="count">0 errors</span><span>after the check</span></div>
          ${renderCode(f.after.text, f.lang, [], false)}
        </div>
        <div class="handle" role="slider" tabindex="0" aria-label="Divider between the two texts" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pos)}">
          <div class="knob"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg></div>
        </div>`;
      list.innerHTML = f.before.diags
        .map(
          (d, k) =>
            `<li data-d="${k}"><span class="pos">${d.line}:${d.start + 1}</span><span><span class="rule">${esc(d.rule)}</span> <span class="msg">${esc(d.msg)}</span>${d.help ? `<span class="help">${esc(d.help)}</span>` : ""}</span></li>`
        )
        .join("");
      $("#diag-count").textContent = `${nb} errors`;
      $("#diag-file").textContent = f.file;
      $("#file-path").textContent = f.file;
      // the dictionaries of this file, the widest scope first
      dict.innerHTML = P.dictionaries
        .filter((d) => f.dictionaries.includes(d.path))
        .sort((a, b) => a.paths.length - b.paths.length)
        .map(
          (d) =>
            `<tr class="dict-src"><td colspan="2">${esc(d.path.split("/").pop())}<span>${d.paths.length ? d.paths.map(esc).join(" ") : "each file"}</span></td></tr>` +
            d.rows.map(([t, m]) => `<tr><td>${esc(t)}</td><td>${esc(m)}</td></tr>`).join("")
        )
        .join("");
      painLine.innerHTML = PAIN[f.pain] || "";
      setPos(pos);
    }

    // the events of the editor: bound one time, for each file
    bindDiags(cmp, () => files[current].before.diags, list);
    let dragging = false;
    const at = (ev) => {
      const r = cmp.getBoundingClientRect();
      return ((ev.clientX - r.left) / r.width) * 100;
    };
    cmp.addEventListener("pointerdown", (ev) => {
      const handle = ev.target.closest(".handle");
      if (!handle) return;
      dragging = true;
      cmp.classList.add("dragging");
      handle.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    cmp.addEventListener("pointermove", (ev) => {
      if (dragging) setPos(at(ev));
    });
    const stop = () => {
      dragging = false;
      cmp.classList.remove("dragging");
    };
    cmp.addEventListener("pointerup", stop);
    cmp.addEventListener("pointercancel", stop);
    cmp.addEventListener("keydown", (ev) => {
      if (!ev.target.closest(".handle")) return;
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

    select(current);
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

  // ---------- the hero session ----------

  // An agent session: each tool call has a dot, and its output sits under an elbow.
  function initTerm() {
    const t = $("#term-body");
    if (!t || !DATA.project) return;
    const ex = (DATA.project.files || []).find((f) => f.file.endsWith("price_cache.rs"));
    if (!ex) return;
    const n = ex.before.diags.length;
    const first = ex.before.diags.slice(0, 3);
    const file = ex.file;
    const call = (ok, name, arg) => ({
      cls: "tool",
      html: `<span class="bul ${ok ? "ok" : "err"}"></span><b>${name}</b>(${esc(arg)})`,
    });
    const out = (html, isFirst) => ({ cls: "out" + (isFirst ? " first" : ""), html });
    const script = [
      { spin: "Checking" },
      call(false, "Bash", `stelint ${file}`),
      ...first.map((d, i) =>
        out(`<span class="e">error[${esc(d.rule)}]</span> <span class="d">${esc(d.msg)}</span>`, i === 0)
      ),
      out(`<span class="d">… +${Math.max(n - first.length, 0)} errors</span>`),
      out(`<span class="e">${n} errors</span><span class="d">, 0 warnings</span>`),
      { spin: "Writing", wait: 1400 },
      call(true, "Update", file),
      out(`<span class="d">Updated</span> ${esc(file)}`, true),
      { spin: "Checking" },
      call(true, "Bash", `stelint ${file}`),
      out(`<span class="o">0 errors</span><span class="d">, 0 warnings</span>`, true),
    ];
    const line = (s) => {
      const ln = document.createElement("div");
      ln.className = "ln " + s.cls;
      ln.innerHTML = s.html;
      return ln;
    };
    const prompt = () => {
      const p = document.createElement("div");
      p.className = "ln prompt";
      p.innerHTML = `<span class="ps">&gt;</span> <span class="caret"></span>`;
      t.appendChild(p);
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      script.filter((s) => !s.spin).forEach((s) => t.appendChild(line(s)));
      prompt();
      return;
    }
    const GLYPHS = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"];
    // one spinner line, shown while the agent works
    const spin = document.createElement("div");
    spin.className = "ln spin";
    let i = 0;
    const next = () => {
      if (i >= script.length) return prompt();
      const s = script[i++];
      if (!s.spin) {
        t.appendChild(line(s));
        setTimeout(next, s.cls === "tool" ? 260 : 120);
        return;
      }
      t.appendChild(spin);
      let k = 0;
      const draw = () =>
        (spin.innerHTML = `<span class="sp">${GLYPHS[k++ % GLYPHS.length]}</span> ${s.spin}… <span class="d">(esc to interrupt)</span>`);
      draw();
      const timer = setInterval(draw, 110);
      setTimeout(() => {
        clearInterval(timer);
        t.removeChild(spin);
        next();
      }, s.wait || 900);
    };
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        io.disconnect();
        setTimeout(next, 400);
      }
    });
    io.observe(t);
  }

  // ---------- output in the format of the terminal ----------

  const total = (n) => `${n} ${n === 1 ? "error" : "errors"}, 0 warnings`;

  // One diagnostic as stelint prints it.
  function diagBlock(d, file) {
    return (
      `<span class="e">error[${esc(d.rule)}]</span>: ${esc(d.msg)}\n` +
      `<span class="c">  --></span> ${esc(file)}:${d.line}:${d.start + 1}\n` +
      (d.help ? `<span class="c">  = help:</span> ${esc(d.help)}\n` : "")
    );
  }

  // ---------- the layered dictionaries ----------

  function initLayers() {
    const L = DATA.layers;
    const files = $("#layer-files");
    if (!L || !files) return;
    const marked = new Set([L.word, L.moved.term]);
    const term = (t) => (marked.has(t) ? `<b>${esc(t)}</b>` : esc(t));
    // project.md first: it applies to each file
    const dicts = [...L.dictionaries].sort((a, b) => a.paths.length - b.paths.length);
    files.innerHTML =
      `<div class="tree-root">.stelint/dictionaries/</div>` +
      dicts
        .map((d, i) => {
          const last = i === dicts.length - 1;
          const scope = d.paths.length ? d.paths.map(esc).join(" ") : "each file";
          return `<div class="tree-node${last ? " last" : ""}">
            <div class="tree-name"><span class="br">${last ? "└──" : "├──"}</span> ${esc(d.path.split("/").pop())}<span class="scope">${scope}</span></div>
            <div class="tree-terms"><span class="br">${last ? " " : "│"}</span><span>${d.rows.map(([t]) => `<span class="t">${term(t)}</span>`).join(" <i>·</i> ")}</span></div>
          </div>`;
        })
        .join("");

    $("#layer-find").innerHTML =
      `<span class="ps">$</span> stelint dictionary find ${esc(L.word)}\n` +
      L.find
        .map((e) => `<b>${esc(e.word)}</b> (${esc(e.part_of_speech)}), ${esc(e.source)}:${e.line}, paths ${e.paths.map(esc).join(" ")}\n  <span class="c">${esc(e.meaning)}</span>`)
        .join("\n");

    const b = L.before.diags;
    $("#layer-check").innerHTML =
      `<span class="ps">$</span> stelint ${esc(L.file)}\n` +
      b.map((d) => diagBlock(d, L.file)).join("\n") +
      `\n<span class="e">${total(b.length)}</span>\n\n` +
      `<span class="ps">$</span> <span class="c"># the same object in two modules: move \u201c${esc(L.moved.term)}\u201d to ${esc(L.moved.to.split("/").pop())}</span>\n` +
      `<span class="ps">$</span> stelint ${esc(L.file)}\n` +
      `<span class="o">${total(L.after.diags.length)}</span>`;
  }

  // ---------- the report on how.html ----------

  function initHow() {
    const el = $("#how-report");
    if (!el || !DATA.how) return;
    // The page names the file src/lib.rs, the file of a real crate.
    const d = DATA.how.before.diags;
    el.innerHTML = d.map((x) => diagBlock(x, "src/lib.rs")).join("\n") + `\n<span class="e">${total(d.length)}</span>`;
    const fixed = $("#how-after");
    if (!fixed) return;
    const comment = DATA.how.after.text
      .split("\n")
      .filter((l) => l.startsWith("///"))
      .join("\n");
    fixed.innerHTML =
      `<span class="faint">${esc(comment)}</span>\n\n` +
      `<span class="faint">$</span> stelint src/lib.rs\n` +
      `<span class="ok">${total(DATA.how.after.diags.length)}</span>`;
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
    if (!cells.length) return;
    // a task list: the tasks before the current one are done
    const show = (i) =>
      cells.forEach((c, k) => {
        c.classList.toggle("done", k < i);
        c.classList.toggle("lit", k === i);
      });
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return show(cells.length);
    let i = 0;
    show(i);
    setInterval(() => {
      i = (i + 1) % (cells.length + 1);
      show(i);
    }, 1300);
  }

  initTop();
  initLayers();
  initHow();
  initCompare();
  initCases();
  initTerm();
  initCopy();
  initLoop();
  initReveal();
})();
