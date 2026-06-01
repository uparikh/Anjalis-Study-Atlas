// ==========================================================================
//  uditbody.js  —  "Udit Mode" body map. Swaps the 2D SVG silhouette for a
//  photo of Udit, with simple clickable dots labeling the same 11 systems.
//  Each dot routes to its A&P system. Mirrors Body2D's public API.
// ==========================================================================

const UditBody = (() => {
  // dot positions as % of the photo box (left, top). part = hover label.
  const DOTS = [
    { sys: "nervous",         part: "Brain",           x: 50, y: 4  },
    { sys: "endocrine",       part: "Glands",          x: 49, y: 19 },
    { sys: "lymphatic",       part: "Lymph Nodes",     x: 36, y: 21 },
    { sys: "pulmonary",       part: "Lungs",           x: 64, y: 29 },
    { sys: "cardiovascular",  part: "Heart",           x: 44, y: 31 },
    { sys: "gastrointestinal",part: "GI Tract",        x: 49, y: 43 },
    { sys: "urinary",         part: "Kidneys",         x: 35, y: 48 },
    { sys: "integumentary",   part: "Skin",            x: 76, y: 46 },
    { sys: "reproductive",    part: "Reproductive",    x: 49, y: 56 },
    { sys: "musculoskeletal", part: "Muscles",         x: 39, y: 73 },
    { sys: "body-org",        part: "Cells & Tissues", x: 59, y: 85 }
  ];

  // ---- progress -> tint (mirrors Body2D) ----
  function statusOf(sys) {
    const manual = Store.getStatus("st:" + sys.id);
    if (manual !== "not") return manual;
    const p = Store.checklistProgress(sys);
    return p.pct === 100 ? "done" : p.pct > 0 ? "in" : "not";
  }
  function statusFill(sys) {
    const s = statusOf(sys);
    return s === "done" ? "rgba(15,113,115,.92)"
         : s === "in"   ? "rgba(193,154,107,.95)"
         : "rgba(152,118,84,.85)";
  }

  function render(onPick) {
    const wrap = el("div", { class: "bodywrap udit" });
    const stage = el("div", { class: "udit-stage" });

    const img = el("img", {
      class: "udit-img",
      src: "assets/udit.jpg",
      alt: "Udit — body map (Udit Mode)"
    });
    stage.appendChild(img);

    DOTS.forEach(d => {
      const sys = GUIDE.ap.find(s => s.id === d.sys);
      const dot = el("button", {
        class: "udit-dot",
        "aria-label": d.part + " · " + sys.name,
        style: `left:${d.x}%;top:${d.y}%`
      });
      dot.style.background = statusFill(sys);
      dot.appendChild(el("span", { class: "udit-tip" }, d.part + " · " + sys.name));
      dot.addEventListener("click", () => onPick(d.sys));
      stage.appendChild(dot);
    });

    wrap.appendChild(stage);

    // same quick-link legend as Body2D
    const legend = el("div", { class: "map-legend" });
    GUIDE.ap.forEach(s => {
      const b = el("button", { onclick: () => onPick(s.id) });
      const dot = el("span", { class: "dot" });
      dot.style.background = statusFill(s).replace(/,[^,]+\)$/, ",1)");
      b.appendChild(dot); b.appendChild(document.createTextNode(s.name));
      legend.appendChild(b);
    });

    return el("div", {}, wrap, legend);
  }

  return { render };
})();

window.UditBody = UditBody;
