// ==========================================================================
//  notes.js  —  renders the editable note views that mirror Anjali's docs.
//  Three view builders: A&P system page, muscle region tables, Clinical
//  specialty page. Everything is bound to Store and auto-saves.
// ==========================================================================

/* tiny DOM helper */
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
  }
  return n;
}

/* ---- shared rich-text toolbar (one per page, floats by the focused field) ---- */
let _rtBar = null, _rtActive = null;

function rtToolbar() {
  if (_rtBar) return _rtBar;
  const bar = el("div", { class: "rt-toolbar", role: "toolbar", "aria-label": "Text formatting" });

  const apply = (command, value) => {
    if (!_rtActive) return;
    _rtActive.focus();
    document.execCommand(command, false, value);
    Store.setField(_rtActive.dataset.field, _rtActive.innerHTML);
  };
  const btn = (label, title, command, value, style) => {
    const b = el("button", { class: "rt-btn", type: "button", title }, label);
    if (style) b.setAttribute("style", style);
    b.addEventListener("mousedown", e => { e.preventDefault(); apply(command, value); });
    return b;
  };

  bar.appendChild(btn("B", "Bold (Ctrl/Cmd+B)", "bold", null, "font-weight:800"));
  bar.appendChild(btn("I", "Italic", "italic", null, "font-style:italic"));
  bar.appendChild(btn("U", "Underline", "underline", null, "text-decoration:underline"));
  bar.appendChild(el("span", { class: "rt-sep" }));
  bar.appendChild(btn("•", "Bullet list", "insertUnorderedList"));
  bar.appendChild(btn("1.", "Numbered list", "insertOrderedList"));
  bar.appendChild(btn("⇤", "Outdent", "outdent"));
  bar.appendChild(btn("⇥", "Indent (nest bullet / number)", "indent"));
  bar.appendChild(el("span", { class: "rt-sep" }));
  [["#7a1f2b", "Maroon"], ["#0f7173", "Teal"], ["#f4a300", "Marigold"],
   ["#c79a3b", "Gold"], ["#2a2118", "Ink"]].forEach(([c, name]) => {
    const s = el("button", { class: "rt-swatch", type: "button", title: name + " text" });
    s.style.background = c;
    s.addEventListener("mousedown", e => { e.preventDefault(); apply("foreColor", c); });
    bar.appendChild(s);
  });
  bar.appendChild(el("span", { class: "rt-sep" }));
  bar.appendChild(btn("⌫", "Clear formatting", "removeFormat"));

  document.body.appendChild(bar);
  window.addEventListener("scroll", () => { if (_rtActive) placeRtBar(_rtActive); }, true);
  window.addEventListener("resize", () => { if (_rtActive) placeRtBar(_rtActive); });
  _rtBar = bar;
  return bar;
}

function placeRtBar(target) {
  const bar = rtToolbar();
  bar.classList.add("show");
  const r = target.getBoundingClientRect();
  const bw = bar.offsetWidth || 300, bh = bar.offsetHeight || 38;
  let left = window.scrollX + r.left;
  left = Math.max(8, Math.min(left, window.scrollX + document.documentElement.clientWidth - bw - 8));
  let top = window.scrollY + r.top - bh - 6;
  if (top < window.scrollY + 4) top = window.scrollY + r.bottom + 6; // flip below if no room above
  bar.style.left = left + "px";
  bar.style.top = top + "px";
}

function hideRtBar() { if (_rtBar) _rtBar.classList.remove("show"); }

/* rich, auto-growing note field bound to a Store field */
function noteArea(fieldId, placeholder = "") {
  const ed = el("div", {
    class: "note", contenteditable: "true", role: "textbox", "aria-multiline": "true",
    "data-field": fieldId, "data-placeholder": placeholder, "aria-label": placeholder || "Notes"
  });
  ed.innerHTML = Store.getField(fieldId);
  ed.addEventListener("input", () => {
    if (!ed.textContent.trim() && !ed.querySelector("img,li")) ed.innerHTML = ""; // restore placeholder
    Store.setField(fieldId, ed.innerHTML);
  });
  ed.addEventListener("focus", () => { _rtActive = ed; placeRtBar(ed); });
  ed.addEventListener("blur", () => {
    setTimeout(() => {                               // keep open if focus went into the toolbar
      const a = document.activeElement;
      if (!_rtBar || !_rtBar.contains(a)) { if (_rtActive === ed) _rtActive = null; hideRtBar(); }
    }, 120);
  });
  return ed;
}

const Notes = {
  /* ---- status picker (Not started / In progress / Mastered) ---- */
  statusPicker(sectionId, onChange) {
    const cur = Store.getStatus(sectionId);
    const wrap = el("div", { class: "status-pick" });
    const opts = [["not", "Not started"], ["in", "In progress"], ["done", "Mastered"]];
    opts.forEach(([val, lbl]) => {
      const b = el("button", { class: (cur === val ? "on " : "") + val }, lbl);
      b.addEventListener("click", () => {
        Store.setStatus(sectionId, val);
        wrap.querySelectorAll("button").forEach(x => x.className = "");
        b.className = "on " + val;
        onChange && onChange(val);
      });
      wrap.appendChild(b);
    });
    return el("div", { class: "status-pick-host", title: "Track your progress on this section" }, wrap);
  },

  /* ====================== A&P SYSTEM PAGE ============================ */
  apSystem(sys, mount) {
    mount.innerHTML = "";
    mount.appendChild(el("div", { class: "section-title" },
      el("span", { class: "lotus", html: SVG.lotus }),
      el("h1", {}, sys.name)
    ));
    mount.appendChild(el("p", { class: "subtle" }, sys.blurb));

    const prog = Store.checklistProgress(sys);
    const toolbar = el("div", { class: "toolbar" },
      this.statusPicker("st:" + sys.id),
      el("span", { class: "badge " + (prog.pct === 100 ? "done" : prog.pct ? "in" : "not") },
        `Checklist ${prog.done}/${prog.total}`)
    );
    if (sys.has3d) {
      toolbar.appendChild(el("a", { class: "btn btn-teal", href: "#/ap/" + sys.id + "/3d" }, "View in 3D"));
    }
    mount.appendChild(toolbar);

    // outline + checklist + notes, per topic
    const card = el("div", { class: "card framed" });
    sys.outline.forEach((t, ti) => {
      const block = el("div", { class: "topic-block" });
      block.appendChild(el("h3", {}, el("span", { class: "paisley", html: SVG.paisley }), t.topic));

      const list = el("ul", { class: "checks" });
      const items = t.subs.length ? t.subs : [t.topic];
      items.forEach((sub, si) => {
        const checkId = `chk:${sys.id}:${ti}:${si}`;
        const fieldId = `f:${sys.id}:${ti}:${si}`;
        const li = el("li", {});
        const cb = el("input", { type: "checkbox" });
        cb.checked = Store.getCheck(checkId);
        if (cb.checked) li.classList.add("done");
        cb.addEventListener("change", () => {
          Store.setCheck(checkId, cb.checked);
          li.classList.toggle("done", cb.checked);
        });
        const label = el("label", {}, cb, el("span", { class: "sub-name" }, sub));
        li.appendChild(label);
        li.appendChild(noteArea(fieldId, "Notes on " + sub + "…"));
        list.appendChild(li);
      });
      block.appendChild(list);
      card.appendChild(block);
    });
    mount.appendChild(card);

    // muscle region tables
    if (sys.regions) {
      mount.appendChild(el("div", { class: "section-title", style: "margin-top:28px" },
        el("span", { class: "lotus", html: SVG.paisley }),
        el("h2", { style: "color:var(--maroon);margin:0;font-size:1.5rem" }, "Muscle Tables by Region")));
      mount.appendChild(el("p", { class: "subtle" }, "Origin · Insertion · Action · Nerve Supply — the way you laid it out."));
      sys.regions.forEach((region, ri) => {
        mount.appendChild(this.muscleTable(sys, region, ri));
      });
    }
  },

  /* muscle region table (dynamic rows) */
  muscleTable(sys, region, ri) {
    const tableId = `msk:${sys.id}:${ri}`;
    const cols = sys.muscleColumns;
    const host = el("div", { class: "card", id: "region-" + ri });
    const scroll = el("div", { class: "tbl-scroll" });
    const table = el("table", { class: "grid" });
    table.appendChild(el("caption", {}, region));
    const thead = el("tr", {}, ...cols.map(c => el("th", {}, c)));
    table.appendChild(el("thead", {}, thead));
    const tbody = el("tbody", {});
    table.appendChild(tbody);

    const renderRows = () => {
      tbody.innerHTML = "";
      const n = Store.getRows(tableId, 6);
      for (let r = 0; r < n; r++) {
        const tr = el("tr", {});
        cols.forEach((c, ci) => {
          const td = el("td", ci === 0 ? { class: "rowhead" } : {});
          td.appendChild(noteArea(`${tableId}:${r}:${ci}`, ci === 0 ? "Muscle" : ""));
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }
    };
    renderRows();
    scroll.appendChild(table);
    host.appendChild(scroll);
    host.appendChild(el("div", { class: "row-actions" },
      el("button", { class: "btn btn-outline", onclick: () => { Store.setRows(tableId, Store.getRows(tableId, 6) + 1); renderRows(); } }, "+ Add muscle"),
      el("button", { class: "btn btn-outline", onclick: () => { const c = Store.getRows(tableId, 6); if (c > 1) { Store.setRows(tableId, c - 1); renderRows(); } } }, "– Remove last")
    ));
    return host;
  },

  /* ==================== CLINICAL SPECIALTY PAGE ====================== */
  clinical(spec, mount) {
    const C = GUIDE.clinical;
    mount.innerHTML = "";
    mount.appendChild(el("div", { class: "section-title" },
      el("span", { class: "lotus", html: SVG.lotus }),
      el("h1", {}, spec.name)));
    mount.appendChild(el("p", { class: "subtle" }, spec.blurb));
    mount.appendChild(el("div", { class: "toolbar" }, this.statusPicker("st:clin:" + spec.id)));

    // ---- Overview / Need to Know table ----
    const ovId = `ov:${spec.id}`;
    const ovHost = el("div", { class: "card framed" });
    const ovScroll = el("div", { class: "tbl-scroll" });
    const ovTable = el("table", { class: "grid overview" });
    ovTable.appendChild(el("caption", {}, "Topic Overview / Need to Know"));
    ovTable.appendChild(el("thead", {}, el("tr", {}, ...C.overviewColumns.map(c => el("th", {}, c)))));
    const ovBody = el("tbody", {});
    ovTable.appendChild(ovBody);
    const renderOv = () => {
      ovBody.innerHTML = "";
      const n = Store.getRows(ovId, C.defaultOverviewRows);
      for (let r = 0; r < n; r++) {
        ovBody.appendChild(el("tr", {},
          el("td", { class: "rowhead" }, noteArea(`${ovId}:${r}:0`, "Topic")),
          el("td", {}, noteArea(`${ovId}:${r}:1`, "What she needs to know…"))
        ));
      }
    };
    renderOv();
    ovScroll.appendChild(ovTable);
    ovHost.appendChild(ovScroll);
    ovHost.appendChild(el("div", { class: "row-actions" },
      el("button", { class: "btn btn-outline", onclick: () => { Store.setRows(ovId, Store.getRows(ovId, C.defaultOverviewRows) + 1); renderOv(); } }, "+ Add topic row")));
    mount.appendChild(ovHost);

    // ---- disease tables (one per "Topic", expandable) ----
    const topicsHost = el("div", {});
    mount.appendChild(topicsHost);

    const renderTopics = () => {
      topicsHost.innerHTML = "";
      const count = Store.getTopics(spec.id, 1);
      for (let t = 0; t < count; t++) {
        topicsHost.appendChild(this.clinicalTable(spec, t));
      }
    };
    renderTopics();

    mount.appendChild(el("div", { class: "row-actions" },
      el("button", { class: "btn btn-gold", onclick: () => { Store.setTopics(spec.id, Store.getTopics(spec.id, 1) + 1); renderTopics(); } }, "+ Add another topic table")));
  },

  clinicalTable(spec, t) {
    const C = GUIDE.clinical;
    const tableId = `clt:${spec.id}:${t}`;
    const cols = C.tableColumns;
    const host = el("div", { class: "card" });
    const scroll = el("div", { class: "tbl-scroll" });
    const table = el("table", { class: "grid" });
    // editable topic title
    const titleField = noteArea(`cltitle:${spec.id}:${t}`, `Topic ${t + 1} name…`);
    const cap = el("caption", {});
    cap.appendChild(titleField);
    table.appendChild(cap);
    table.appendChild(el("thead", {}, el("tr", {}, ...cols.map(c => el("th", {}, c)))));
    const tbody = el("tbody", {});
    table.appendChild(tbody);
    const render = () => {
      tbody.innerHTML = "";
      const n = Store.getRows(tableId, C.defaultTableRows);
      for (let r = 0; r < n; r++) {
        const tr = el("tr", {});
        cols.forEach((c, ci) => {
          const td = el("td", ci === 0 ? { class: "rowhead" } : {});
          td.appendChild(noteArea(`${tableId}:${r}:${ci}`, ci === 0 ? "Type" : ""));
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }
    };
    render();
    scroll.appendChild(table);
    host.appendChild(scroll);
    host.appendChild(el("div", { class: "row-actions" },
      el("button", { class: "btn btn-outline", onclick: () => { Store.setRows(tableId, Store.getRows(tableId, C.defaultTableRows) + 1); render(); } }, "+ Add row"),
      el("button", { class: "btn btn-outline", onclick: () => { const c = Store.getRows(tableId, C.defaultTableRows); if (c > 1) { Store.setRows(tableId, c - 1); render(); } } }, "– Remove last")
    ));
    return host;
  }
};

window.Notes = Notes;
window.el = el;
