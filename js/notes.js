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
  [["#987654", "Maroon"], ["#0f7173", "Teal"], ["#c19a6b", "Marigold"],
   ["#b89a6a", "Gold"], ["#2a2118", "Ink"]].forEach(([c, name]) => {
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
  // keep the toolbar up while editing; only dismiss on a real click outside notes + bar, or Escape
  document.addEventListener("mousedown", e => {
    if (!_rtBar || !_rtBar.classList.contains("show")) return;
    const t = e.target;
    if (t.closest && (t.closest(".note") || _rtBar.contains(t))) return;
    _rtActive = null; hideRtBar();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && _rtBar) { _rtActive = null; hideRtBar(); }
  });
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

/* downscale a chosen/pasted/dropped image to a compact data URL */
function downscaleToDataURL(file, cb, maxSide = 1100) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      const scale = Math.min(1, maxSide / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      // PNG keeps text/diagrams crisp; fall back to JPEG if it gets too heavy
      let url = canvas.toDataURL("image/png");
      if (url.length > 900000) url = canvas.toDataURL("image/jpeg", 0.85);
      cb(url);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* downscale a pasted/dropped image to a compact data URL, then insert at caret */
function insertImageFile(ed, file, savedRange) {
  downscaleToDataURL(file, url => {
      const node = new Image();
      node.src = url;
      node.alt = "pasted image";

      ed.focus();
      const sel = window.getSelection();
      if (savedRange) { sel.removeAllRanges(); sel.addRange(savedRange); }
      const range = sel.rangeCount ? sel.getRangeAt(0) : null;
      if (range && ed.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(node);
        range.setStartAfter(node); range.collapse(true);
        sel.removeAllRanges(); sel.addRange(range);
      } else {
        ed.appendChild(node);
      }
      Store.setField(ed.dataset.field, ed.innerHTML);
  });
}

/* ---- crash-course video links box (one or more links per section) ---- */
function videoLinks(key) {
  const raw = Store.getField(key);
  if (!raw) return [];
  if (/^https?:\/\//i.test(raw)) return [raw];      // legacy single-link value
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter(Boolean) : []; }
  catch (e) { return []; }
}

function videoBox(key) {
  const host = el("div", { class: "video-box" });
  const normalize = u => {
    u = String(u || "").trim();
    if (!u) return "";
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    return u;
  };
  const load = () => videoLinks(key);
  const save = arr => Store.setField(key, arr.length ? JSON.stringify(arr) : "");
  const labelFor = url => {
    try { return "Watch on " + new URL(url).hostname.replace(/^www\./, ""); }
    catch (e) { return "Watch the video"; }
  };

  function render() {
    host.innerHTML = "";
    const arr = load();
    arr.forEach((url, idx) => {
      const a = el("a", { class: "video-link", href: url, target: "_blank", rel: "noopener" },
        el("span", { class: "vb-play" }, "▶"),
        el("span", { class: "vb-text" }, labelFor(url)));
      const del = el("button", { class: "vb-del", type: "button", title: "Remove link" }, "×");
      del.addEventListener("click", () => { const x = load(); x.splice(idx, 1); save(x); render(); });
      host.appendChild(el("div", { class: "video-row" }, a, del));
    });

    const input = el("input", { class: "video-input", type: "url",
      placeholder: arr.length ? "Add another video link…" : "Paste a Crash Course (or any) video link…" });
    const add = el("button", { class: "btn btn-gold vb-save", type: "button" }, "Add link");
    const commit = () => {
      const url = normalize(input.value);
      if (!url) return;
      const x = load(); x.push(url); save(x);
      render();
      const ni = host.querySelector(".video-input"); if (ni) ni.focus();   // ready for the next one
    };
    add.addEventListener("click", commit);
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); commit(); } });
    host.appendChild(el("div", { class: "video-add" }, input, add));
  }

  render();
  return el("div", { class: "video-host" },
    el("div", { class: "video-label" }, el("span", { class: "vb-ico" }, "🎬"), "Crash Course videos"),
    host);
}

/* ---- resizable diagram box holding one or more images (per section/region) ---- */
function diagramImages(key) {
  const raw = Store.getField(key);
  if (!raw) return [];
  if (raw.indexOf("data:") === 0) {                 // legacy single-image value
    const sz = Store.getField(key + ":size");
    const o = { src: raw };
    if (sz && /^\d+x\d+$/.test(sz)) { const [w, h] = sz.split("x").map(Number); o.w = w; o.h = h; }
    return [o];
  }
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}

function diagramBox(key) {
  const host = el("div", { class: "diagram-box", tabindex: "0" });

  const load = () => diagramImages(key);
  const save = arr => Store.setField(key, arr.length ? JSON.stringify(arr) : "");
  const addImage = url => { const arr = load(); arr.push({ src: url }); save(arr); render(); };
  const handleFile = file => { if (file && file.type.startsWith("image/")) downscaleToDataURL(file, addImage); };

  function filePicker() {
    const fi = el("input", { type: "file", accept: "image/*", multiple: "", hidden: "" });
    fi.addEventListener("change", e => { [...e.target.files].forEach(handleFile); e.target.value = ""; });
    return fi;
  }

  function frameFor(item, idx) {
    const frame = el("div", { class: "diagram-frame" });
    if (item.w && item.h) { frame.style.width = item.w + "px"; frame.style.height = item.h + "px"; }
    frame.appendChild(el("img", { src: item.src, alt: "Diagram", draggable: "false" }));
    if (window.ResizeObserver) {
      let t;
      new ResizeObserver(() => {
        clearTimeout(t);
        t = setTimeout(() => {
          const a = load();
          if (a[idx]) { a[idx].w = Math.round(frame.clientWidth); a[idx].h = Math.round(frame.clientHeight); save(a); }
        }, 250);
      }).observe(frame);
    }
    const del = el("button", { class: "diagram-del", type: "button", title: "Remove image" }, "×");
    del.addEventListener("click", () => { const a = load(); a.splice(idx, 1); save(a); render(); });
    return el("div", { class: "diagram-wrap" }, frame, del);
  }

  function render() {
    host.innerHTML = "";
    const arr = load();
    if (arr.length) {
      const grid = el("div", { class: "diagram-grid" });
      arr.forEach((item, idx) => grid.appendChild(frameFor(item, idx)));
      host.appendChild(grid);
      const fi = filePicker();
      const add = el("button", { class: "btn btn-outline", type: "button" }, "＋ Add another image");
      add.addEventListener("click", () => fi.click());
      host.appendChild(el("div", { class: "diagram-actions" }, add, fi,
        el("span", { class: "diagram-hint" }, "Drag a corner to resize · paste or drop to add more.")));
    } else {
      const fi = filePicker();
      const add = el("button", { class: "btn btn-outline", type: "button" }, "＋ Add image");
      add.addEventListener("click", () => fi.click());
      host.appendChild(el("div", { class: "diagram-empty" },
        el("p", {}, "Paste a diagram, drop an image, or add one (you can add several):"), add, fi));
    }
  }

  host.addEventListener("paste", e => {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    let used = false;
    for (const it of items) {
      if (it.kind === "file" && it.type.startsWith("image/")) { handleFile(it.getAsFile()); used = true; }
    }
    if (used) e.preventDefault();
  });
  host.addEventListener("dragover", e => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  host.addEventListener("drop", e => {
    const files = e.dataTransfer && [...e.dataTransfer.files].filter(x => x.type.startsWith("image/"));
    if (files && files.length) { e.preventDefault(); files.forEach(handleFile); }
  });

  render();
  return el("div", { class: "diagram-host" },
    el("div", { class: "diagram-title" }, el("span", { class: "paisley", html: SVG.paisley }), "Diagram"),
    host);
}

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
  ed.addEventListener("paste", e => {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (const it of items) {
      if (it.kind === "file" && it.type.startsWith("image/")) {
        e.preventDefault();
        const file = it.getAsFile();
        const sel = window.getSelection();
        const savedRange = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
        if (file) insertImageFile(ed, file, savedRange);
        return;                                        // image handled; skip default paste
      }
    }
  });
  ed.addEventListener("dragover", e => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  ed.addEventListener("drop", e => {
    const files = e.dataTransfer && e.dataTransfer.files;
    const file = files && [...files].find(f => f.type.startsWith("image/"));
    if (file) { e.preventDefault(); ed.focus(); insertImageFile(ed, file, null); }
  });
  // Tab / Shift+Tab indents or outdents the current bullet / numbered item
  ed.addEventListener("keydown", e => {
    if (e.key !== "Tab") return;
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return;
    let node = sel.anchorNode;
    if (node.nodeType === 3) node = node.parentNode;          // text node -> element
    const li = node && node.closest ? node.closest("li") : null;
    if (!li || !ed.contains(li)) return;                      // only hijack Tab inside a list
    e.preventDefault();
    document.execCommand(e.shiftKey ? "outdent" : "indent");
    Store.setField(ed.dataset.field, ed.innerHTML);
  });
  ed.addEventListener("focus", () => { _rtActive = ed; placeRtBar(ed); });
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
    mount.appendChild(videoBox(`vid:${sys.id}`));

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
      block.appendChild(diagramBox(`dia:${sys.id}:${ti}`));
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
    host.appendChild(diagramBox(`${tableId}:diagram`));
    return host;
  },

  /* ==================== CLINICAL SPECIALTY PAGE ====================== */
  clinical(spec, mount) {
    const C = GUIDE.clinical;
    mount.innerHTML = "";
    mount.appendChild(el("div", { class: "section-title" },
      el("span", { class: "lotus", html: SVG.lotus }),
      el("h1", {}, spec.name)));
    mount.appendChild(videoBox(`vid:clin:${spec.id}`));
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
