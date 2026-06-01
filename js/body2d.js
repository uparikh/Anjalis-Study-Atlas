// ==========================================================================
//  body2d.js  —  interactive 2D body map navigator (Indian-styled SVG).
//  A smooth human silhouette (built from a Catmull-Rom spline) with labeled,
//  clickable organ hotspots. Clicking a region routes to that A&P system.
// ==========================================================================

const Body2D = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const VB_W = 460, CX = 230; // body width and centerline
  const PAD_X = 64;           // horizontal breathing room so side labels don't clip

  // ---- organ hotspots (centerline at x=230). part = visible label. ----
  const ZONES = [
    { region: "brain",  sys: "nervous",          part: "Brain",           label: "Nervous · Brain",        shape: "circle",  cx: 230, cy: 60,  r: 22,           side: "l", ly: 60 },
    { region: "endo",   sys: "endocrine",         part: "Glands",          label: "Endocrine · Glands",     shape: "ellipse", cx: 230, cy: 106, rx: 13, ry: 8,   side: "r", ly: 102 },
    { region: "lymph",  sys: "lymphatic",         part: "Lymph Nodes",     label: "Lymphatic / Immune",     shape: "circle",  cx: 201, cy: 152, r: 9,            side: "l", ly: 142 },
    { region: "lungs",  sys: "pulmonary",         part: "Lungs",           label: "Pulmonary · Lungs",      shape: "ellipse", cx: 251, cy: 170, rx: 25, ry: 30,  side: "r", ly: 168 },
    { region: "heart",  sys: "cardiovascular",    part: "Heart",           label: "Cardiovascular · Heart", shape: "ellipse", cx: 217, cy: 176, rx: 14, ry: 16,  side: "l", ly: 196 },
    { region: "gi",     sys: "gastrointestinal",  part: "GI Tract",        label: "Gastrointestinal",       shape: "ellipse", cx: 230, cy: 242, rx: 29, ry: 30,  side: "r", ly: 252 },
    { region: "kidney", sys: "urinary",           part: "Kidneys",         label: "Urinary · Kidneys",      shape: "ellipse", cx: 230, cy: 296, rx: 30, ry: 12,  side: "l", ly: 296 },
    { region: "skin",   sys: "integumentary",     part: "Skin",            label: "Integumentary · Skin",   shape: "circle",  cx: 296, cy: 232, r: 13,           side: "r", ly: 332 },
    { region: "repro",  sys: "reproductive",      part: "Reproductive",    label: "Reproductive",           shape: "ellipse", cx: 230, cy: 330, rx: 19, ry: 12,  side: "r", ly: 392 },
    { region: "msk",    sys: "musculoskeletal",   part: "Muscles",         label: "Musculoskeletal",        shape: "circle",  cx: 206, cy: 430, r: 15,           side: "l", ly: 430 },
    { region: "core",   sys: "body-org",          part: "Cells & Tissues", label: "Body Organization",      shape: "circle",  cx: 254, cy: 430, r: 14,           side: "r", ly: 452 }
  ];

  // ---- progress -> tint ----
  function statusOf(sys) {
    const manual = Store.getStatus("st:" + sys.id);
    if (manual !== "not") return manual;
    const p = Store.checklistProgress(sys);
    return p.pct === 100 ? "done" : p.pct > 0 ? "in" : "not";
  }
  function statusFill(sys) {
    const s = statusOf(sys);
    return s === "done" ? "rgba(15,113,115,.42)"
         : s === "in"   ? "rgba(193,154,107,.5)"
         : "rgba(152,118,84,.16)";
  }

  // ---- Catmull-Rom -> smooth closed bezier path ----
  function spline(pts) {
    const n = pts.length, get = i => pts[((i % n) + n) % n];
    let d = `M ${pts[0][0]} ${pts[0][1]} `;
    for (let i = 0; i < n; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0]} ${p2[1]} `;
    }
    return d + "Z";
  }

  // left-half boundary, head-top -> down arm -> torso -> leg -> foot -> crotch
  const LEFT = [
    [230, 20], [206, 26], [194, 54], [197, 82], [209, 96],   // head + jaw + neck
    [216, 106], [205, 116], [181, 122],                       // shoulder
    [167, 152], [158, 200], [152, 250], [151, 298],           // arm outer
    [153, 320], [161, 333], [172, 330],                       // hand
    [171, 300], [175, 250], [185, 200], [197, 152],           // arm inner
    [206, 136], [203, 176], [198, 216],                       // armpit -> waist
    [202, 256], [197, 296], [201, 318],                       // hip
    [198, 372], [200, 442], [197, 514], [199, 582],           // leg outer
    [197, 604], [213, 610], [227, 605],                       // foot
    [229, 560], [231, 460], [231, 360], [230, 330]            // leg inner -> crotch
  ];

  function buildFigure() {
    const right = LEFT.slice(1, LEFT.length - 1).map(([x, y]) => [VB_W - x, y]).reverse();
    const outline = spline(LEFT.concat(right));

    return `
      <path d="${outline}" fill="#f1d9b8" stroke="#cB9b6e" stroke-width="2.5" stroke-linejoin="round"/>
    `;
  }

  function render(onPick) {
    const wrap = el("div", { class: "bodywrap" });
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "bodymap");
    svg.setAttribute("viewBox", `${-PAD_X} 0 ${VB_W + PAD_X * 2} 640`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Interactive labeled body map");
    svg.innerHTML = buildFigure();

    ZONES.forEach(z => {
      const sys = GUIDE.ap.find(s => s.id === z.sys);
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "zone");
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", z.label);

      // hotspot
      const hit = document.createElementNS(NS, z.shape);
      if (z.shape === "circle") { hit.setAttribute("cx", z.cx); hit.setAttribute("cy", z.cy); hit.setAttribute("r", z.r); }
      else { hit.setAttribute("cx", z.cx); hit.setAttribute("cy", z.cy); hit.setAttribute("rx", z.rx); hit.setAttribute("ry", z.ry); }
      hit.setAttribute("class", "hit");
      hit.style.fill = statusFill(sys);
      g.appendChild(hit);

      // leader line + label
      const rad = z.r || z.rx;
      const leader = document.createElementNS(NS, "polyline");
      let pts, tx, anchor;
      if (z.side === "l") {
        pts = `120,${z.ly} ${z.cx - rad - 10},${z.ly} ${z.cx - rad},${z.cy}`;
        tx = 116; anchor = "end";
      } else {
        pts = `${VB_W - 120},${z.ly} ${z.cx + rad + 10},${z.ly} ${z.cx + rad},${z.cy}`;
        tx = VB_W - 116; anchor = "start";
      }
      leader.setAttribute("points", pts);
      leader.setAttribute("class", "leader");
      g.appendChild(leader);

      const t1 = document.createElementNS(NS, "text");
      t1.setAttribute("x", tx); t1.setAttribute("y", z.ly - 3);
      t1.setAttribute("text-anchor", anchor); t1.setAttribute("class", "blabel part");
      t1.textContent = z.part;
      g.appendChild(t1);

      const t2 = document.createElementNS(NS, "text");
      t2.setAttribute("x", tx); t2.setAttribute("y", z.ly + 11);
      t2.setAttribute("text-anchor", anchor); t2.setAttribute("class", "blabel sys");
      t2.textContent = sys.name;
      g.appendChild(t2);

      const go = () => onPick(z.sys);
      g.addEventListener("click", go);
      g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      svg.appendChild(g);
    });

    wrap.appendChild(svg);

    // quick-link legend (also covers everything for small screens)
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

window.Body2D = Body2D;
