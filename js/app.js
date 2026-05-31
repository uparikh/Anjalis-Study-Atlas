// ==========================================================================
//  app.js  —  layout, hash router, dashboard (progress + streak), toolbar.
// ==========================================================================

const App = (() => {
  let railEl, contentEl;
  let pendingRegionScroll = null;

  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = el("div", { class: "toast" }); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1900);
  }

  /* ----------------------------- side rail ----------------------------- */
  function buildRail() {
    railEl.innerHTML = "";

    const home = el("div", { class: "rail-group" },
      el("a", { class: "navitem", href: "#/", style: "font-weight:600" },
        el("span", { class: "nm" }, "✦  Study Atlas Home")));
    railEl.appendChild(home);

    const apGroup = el("div", { class: "rail-group" }, el("div", { class: "rail-head" }, "Anatomy & Physiology"));
    GUIDE.ap.forEach(s => apGroup.appendChild(railLink("#/ap/" + s.id, s.name, statusOf(s))));
    railEl.appendChild(apGroup);

    const clGroup = el("div", { class: "rail-group" }, el("div", { class: "rail-head" }, "Clinical Medicine I"));
    GUIDE.clinical.specialties.forEach(s => {
      const st = Store.getStatus("st:clin:" + s.id);
      clGroup.appendChild(railLink("#/clin/" + s.id, s.name, st));
    });
    railEl.appendChild(clGroup);

    highlightActive();
  }

  function statusOf(sys) {
    const manual = Store.getStatus("st:" + sys.id);
    if (manual !== "not") return manual;
    const p = Store.checklistProgress(sys);
    return p.pct === 100 ? "done" : p.pct > 0 ? "in" : "not";
  }

  function railLink(href, name, status) {
    const pct = "";
    return el("a", { class: "navitem", href },
      el("span", { class: "dot " + status }),
      el("span", { class: "nm" }, name));
  }

  function highlightActive() {
    const h = location.hash || "#/";
    railEl.querySelectorAll("a.navitem").forEach(a => {
      a.classList.toggle("active", a.getAttribute("href") === h.replace(/\/3d$/, ""));
    });
  }

  /* ----------------------------- dashboard ----------------------------- */
  function dashboard() {
    contentEl.innerHTML = "";

    const streak = Store.streakCount();
    const days = Store.activeDays();
    const apDone = GUIDE.ap.filter(s => statusOf(s) === "done").length;

    const hero = el("div", { class: "hero" });
    const welcome = el("div", { class: "card framed welcome" },
      el("div", { class: "namaste" }, "Namaste, Anjali 🪷"),
      el("h1", {}, "Your Study Atlas"),
      el("p", { class: "subtle" }, "A home for your A&P and Clinical Medicine notes — set up exactly the way you organized them. Tap the body, fill in your tables, and watch your progress bloom."),
      el("div", { class: "stat-row" },
        stat("flame", streak, "Day streak"),
        stat("", days, "Days studied"),
        stat("", apDone + "/" + GUIDE.ap.length, "Systems mastered"))
    );

    const mapCard = el("div", { class: "card framed" },
      el("h2", { style: "margin:0 0 4px;color:var(--maroon);font-size:1.4rem" }, "Explore by the Body"),
      el("p", { class: "subtle", style: "margin-bottom:12px" }, "Click a region to open its notes."),
      Body2D.render(go => location.hash = "#/ap/" + go)
    );

    hero.appendChild(welcome);
    hero.appendChild(mapCard);
    contentEl.appendChild(hero);

    // today's goals + past lists
    contentEl.appendChild(goalsCard());

    // study calendar heatmap
    contentEl.appendChild(heatCard());

    // A&P progress grid
    contentEl.appendChild(sectionHeading("Anatomy & Physiology", "Per-system progress, from your outlines."));
    const apGrid = el("div", { class: "prog-grid" });
    GUIDE.ap.forEach(s => apGrid.appendChild(progCell(s)));
    contentEl.appendChild(apGrid);

    // Clinical grid
    contentEl.appendChild(sectionHeading("Clinical Medicine I", "Disease tables by specialty."));
    const clGrid = el("div", { class: "prog-grid" });
    GUIDE.clinical.specialties.forEach(s => clGrid.appendChild(clinCell(s)));
    contentEl.appendChild(clGrid);

    contentEl.appendChild(el("div", { class: "khan-note", style: "margin-top:20px" },
      "Knowledge checks & quizzes live on ",
      el("a", { href: "https://www.khanacademy.org/science/health-and-medicine", target: "_blank", rel: "noopener" }, "Khan Academy"),
      " — this Atlas is your notebook and progress tracker."));
  }

  function stat(cls, num, lbl) {
    return el("div", { class: "stat " + cls }, el("div", { class: "num" }, String(num)), el("div", { class: "lbl" }, lbl));
  }

  function sectionHeading(title, sub) {
    return el("div", { style: "margin:30px 0 14px" },
      el("div", { class: "section-title" }, el("span", { class: "lotus", html: SVG.paisley }),
        el("h2", { style: "margin:0;color:var(--maroon);font-size:1.6rem" }, title)),
      el("p", { class: "subtle", style: "margin:4px 0 0" }, sub));
  }

  function progCell(sys) {
    const p = Store.checklistProgress(sys);
    const st = statusOf(sys);
    const cell = el("a", { class: "prog-cell", href: "#/ap/" + sys.id },
      el("div", { class: "pc-top" },
        el("span", { class: "pc-name" }, sys.name),
        el("span", { class: "badge " + st }, st === "done" ? "Mastered" : st === "in" ? "In progress" : "Not started")),
      el("div", { class: "bar" + (st === "done" ? " teal" : "") }, el("i", { style: "width:" + p.pct + "%" })),
      el("div", { class: "pc-meta" }, el("span", {}, p.done + " / " + p.total + " topics"), el("span", {}, p.pct + "%")));
    return cell;
  }

  function clinCell(spec) {
    const st = Store.getStatus("st:clin:" + spec.id);
    return el("a", { class: "prog-cell", href: "#/clin/" + spec.id },
      el("div", { class: "pc-top" },
        el("span", { class: "pc-name" }, spec.name),
        el("span", { class: "badge " + st }, st === "done" ? "Mastered" : st === "in" ? "In progress" : "Not started")),
      el("div", { class: "pc-meta", style: "margin-top:10px" }, el("span", {}, spec.blurb)));
  }

  function heatCard() {
    const weeks = 16;
    const today = new Date();
    const grid = el("div", { class: "heat" });
    const start = new Date(today);
    start.setDate(start.getDate() - (weeks * 7 - 1));
    // align to weeks: iterate columns(weeks) x rows(7)
    const cells = [];
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const on = !!Store.log[key];
      const isToday = key === Store.today();
      cells.push(el("i", { class: (on ? "on " : "") + (isToday ? "today" : ""), title: key }));
    }
    cells.forEach(c => grid.appendChild(c));
    return el("div", { class: "card" },
      el("h2", { style: "margin:0 0 10px;color:var(--maroon);font-size:1.3rem" }, "Study Streak"),
      el("p", { class: "subtle", style: "margin:0 0 12px" }, "Every day you add or check something lights a square."),
      grid);
  }

  /* --------------------------- daily goals ----------------------------- */
  function prettyDate(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined,
      { weekday: "long", month: "long", day: "numeric" });
  }

  function goalsCard() {
    const today = Store.today();
    const card = el("div", { class: "card framed goals-card" });
    card.appendChild(el("div", { class: "goals-head" },
      el("h2", {}, el("span", { class: "lotus", html: SVG.lotus }), "Today's Goals"),
      el("span", { class: "goals-date" }, prettyDate(today))));

    const list = el("ul", { class: "goal-list" });
    const renderList = () => {
      list.innerHTML = "";
      const goals = Store.getGoals(today);
      if (!goals.length) {
        list.appendChild(el("li", { class: "goal-empty" },
          "Nothing yet — add what you want to tackle today."));
      } else {
        goals.forEach((g, i) => list.appendChild(goalItem(today, i, renderList)));
      }
    };
    renderList();
    card.appendChild(list);

    const input = el("input", { class: "goal-input", type: "text",
      placeholder: "Add a goal for today…", "aria-label": "Add a goal for today" });
    const add = () => {
      const t = input.value.trim();
      if (!t) return;
      const goals = Store.getGoals(today);
      goals.push({ t, d: false });
      Store.setGoals(today, goals);
      input.value = "";
      renderList();
    };
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); add(); } });
    card.appendChild(el("div", { class: "goal-add" },
      input, el("button", { class: "btn btn-gold", onclick: add }, "Add")));

    card.appendChild(pastGoals(today));
    return card;
  }

  function goalItem(date, i, rerender) {
    const g = Store.getGoals(date)[i];
    const li = el("li", { class: "goal-item" + (g.d ? " done" : "") });
    const cb = el("input", { type: "checkbox", "aria-label": "Mark goal done" });
    cb.checked = g.d;
    cb.addEventListener("change", () => {
      const arr = Store.getGoals(date);
      arr[i].d = cb.checked;
      Store.setGoals(date, arr);
      rerender();
    });
    const txt = el("span", { class: "goal-text", contenteditable: "true" }, g.t);
    txt.addEventListener("input", () => {
      const arr = Store.getGoals(date);
      arr[i].t = txt.textContent;
      Store.setGoals(date, arr);
    });
    const del = el("button", { class: "goal-del", title: "Remove goal", "aria-label": "Remove goal" }, "×");
    del.addEventListener("click", () => {
      const arr = Store.getGoals(date);
      arr.splice(i, 1);
      Store.setGoals(date, arr);
      rerender();
    });
    li.appendChild(cb);
    li.appendChild(txt);
    li.appendChild(del);
    return li;
  }

  function pastGoals(today) {
    const dates = Store.goalDates().filter(d => d !== today);
    const details = el("details", { class: "past-goals" });
    details.appendChild(el("summary", {},
      "Past goal lists" + (dates.length ? ` (${dates.length})` : "")));
    if (!dates.length) {
      details.appendChild(el("p", { class: "subtle", style: "margin:10px 4px 4px" },
        "Your previous daily lists will collect here, newest first."));
      return details;
    }
    dates.forEach(d => {
      const goals = Store.getGoals(d);
      const done = goals.filter(x => x.d).length;
      const ul = el("ul", { class: "goal-list readonly" });
      goals.forEach(g => ul.appendChild(el("li", { class: "goal-item" + (g.d ? " done" : "") },
        el("span", { class: "goal-bullet" + (g.d ? " on" : "") }, g.d ? "✓" : "○"),
        el("span", { class: "goal-text" }, g.t))));
      details.appendChild(el("div", { class: "past-day" },
        el("div", { class: "past-day-head" },
          el("span", { class: "past-date" }, prettyDate(d)),
          el("span", { class: "past-count" }, `${done}/${goals.length} done`)),
        ul));
    });
    return details;
  }

  /* ----------------------------- 3D view ------------------------------- */
  function threeView(sys) {
    contentEl.innerHTML = "";
    contentEl.appendChild(el("div", { class: "section-title" },
      el("span", { class: "lotus", html: SVG.lotus }), el("h1", {}, sys.name + " · 3D")));
    contentEl.appendChild(el("div", { class: "toolbar" },
      el("div", { class: "view-toggle" },
        el("button", { onclick: () => location.hash = "#/ap/" + sys.id }, "2D Notes"),
        el("button", { class: "on" }, "3D Model")),
      el("a", { class: "btn btn-outline", href: "#/ap/" + sys.id }, "← Back to muscle tables")));

    const host = el("div", { id: "three-host" });
    contentEl.appendChild(host);

    const jump = el("div", { class: "region-jump" });
    sys.regions.forEach((r, i) => jump.appendChild(
      el("a", { href: "#/ap/" + sys.id, onclick: () => { pendingRegionScroll = i; } }, r)));
    contentEl.appendChild(el("div", { class: "card" },
      el("p", { class: "subtle", style: "margin:0 0 8px" }, "Or jump straight to a region's table:"), jump));

    requestAnimationFrame(() => Body3D.mount(host, sys, regionIdx => {
      pendingRegionScroll = regionIdx;
      location.hash = "#/ap/" + sys.id;
    }));
  }

  /* ------------------------------ router ------------------------------- */
  function route() {
    // cleanup any live 3D loop
    const old = document.getElementById("three-host");
    if (old && old._cleanup) old._cleanup();

    const hash = location.hash || "#/";
    const parts = hash.replace(/^#\//, "").split("/").filter(Boolean);
    highlightActive();
    window.scrollTo(0, 0);

    if (parts.length === 0) { dashboard(); return; }

    if (parts[0] === "ap") {
      const sys = GUIDE.ap.find(s => s.id === parts[1]);
      if (!sys) { dashboard(); return; }
      if (parts[2] === "3d" && sys.has3d) { threeView(sys); return; }
      Notes.apSystem(sys, contentEl);
      if (pendingRegionScroll != null) {
        const idx = pendingRegionScroll; pendingRegionScroll = null;
        requestAnimationFrame(() => {
          const t = document.getElementById("region-" + idx);
          if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return;
    }

    if (parts[0] === "clin") {
      const spec = GUIDE.clinical.specialties.find(s => s.id === parts[1]);
      if (!spec) { dashboard(); return; }
      Notes.clinical(spec, contentEl);
      return;
    }
    dashboard();
  }

  /* ------------------------------ toolbar ------------------------------ */
  function wireToolbar() {
    document.getElementById("btn-print").addEventListener("click", () => Print.booklet());
    document.getElementById("btn-export").addEventListener("click", () => { Store.download(); toast("Backup downloaded ✓"); });

    const fileInput = document.getElementById("import-file");
    document.getElementById("btn-import").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { Store.importJSON(rd.result); toast("Notes restored ✓"); buildRail(); route(); }
        catch (err) { toast("Couldn't read that file"); }
      };
      rd.readAsText(f);
      fileInput.value = "";
    });
  }

  function init() {
    railEl = document.getElementById("rail");
    contentEl = document.getElementById("content");
    buildRail();
    wireToolbar();
    window.addEventListener("hashchange", route);
    // refresh rail dots + dashboard stats when data changes
    Store.subscribe(() => {
      buildRail();
      if ((location.hash || "#/") === "#/") { /* light refresh of stats only on home */ }
    });
    route();
  }

  return { init, toast };
})();

document.addEventListener("DOMContentLoaded", App.init);
