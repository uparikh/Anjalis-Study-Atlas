// ==========================================================================
//  print.js  —  builds a light, "cute" study booklet from her saved notes
//  and opens it for printing / Save-as-PDF in a clean window. A5 pages,
//  Indian motifs kept, heavy fills dropped so it's printer-friendly.
// ==========================================================================

const Print = (() => {
  // a field counts as content if it has visible text or an image
  const filled = h => !!h && (/<img/i.test(h) ||
    h.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim() !== "");
  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const stripToText = h => String(h || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const statusLabel = s => s === "done" ? "Mastered" : s === "in" ? "In progress" : "Not started";

  function diagramHTML(key, alt) {
    const raw = Store.getField(key);
    if (!raw) return "";
    let arr;
    if (raw.indexOf("data:") === 0) arr = [{ src: raw }];
    else { try { arr = JSON.parse(raw); } catch (e) { arr = []; } }
    if (!Array.isArray(arr) || !arr.length) return "";
    return arr.map(it => `<div class="diagram"><img src="${esc(it.src)}" alt="${esc(alt)}"></div>`).join("");
  }

  function apStatus(sys) {
    const manual = Store.getStatus("st:" + sys.id);
    if (manual !== "not") return manual;
    const p = Store.checklistProgress(sys);
    return p.pct === 100 ? "done" : p.pct > 0 ? "in" : "not";
  }

  function tableHTML(caption, cols, rows) {
    if (!rows.length) return "";
    let h = `<table><caption>${esc(caption)}</caption><thead><tr>` +
      cols.map(c => `<th>${esc(c)}</th>`).join("") + `</tr></thead><tbody>`;
    rows.forEach(cells => {
      h += `<tr>` + cells.map(c => `<td>${filled(c) ? c : ""}</td>`).join("") + `</tr>`;
    });
    return h + `</tbody></table>`;
  }

  function apSection(sys) {
    const st = apStatus(sys);
    let html = `<section class="section"><div class="sec-head">${SVG.lotus}` +
      `<h2>${esc(sys.name)}</h2><span class="pill ${st}">${statusLabel(st)}</span></div>`;
    if (sys.blurb) html += `<p class="blurb">${esc(sys.blurb)}</p>`;
    const vid = Store.getField(`vid:${sys.id}`);
    if (filled(vid)) html += `<p class="vidline">&#9658; Video: <a href="${esc(vid)}">${esc(vid)}</a></p>`;

    sys.outline.forEach((t, ti) => {
      const items = t.subs.length ? t.subs : [t.topic];
      let body = "";
      items.forEach((sub, si) => {
        const checked = Store.getCheck(`chk:${sys.id}:${ti}:${si}`);
        const note = Store.getField(`f:${sys.id}:${ti}:${si}`);
        body += `<div class="sub"><span class="chk">${checked ? "&#9745;" : "&#9744;"}</span>` +
          `<span class="lbl">${esc(sub)}</span>`;
        if (filled(note)) body += `<div class="note">${note}</div>`;
        body += `</div>`;
      });
      body += diagramHTML(`dia:${sys.id}:${ti}`, t.topic + " diagram");
      html += `<div class="topic"><h3>${SVG.paisley}${esc(t.topic)}</h3>${body}</div>`;
    });

    if (sys.regions) {
      sys.regions.forEach((region, ri) => {
        const tableId = `msk:${sys.id}:${ri}`;
        const n = Store.getRows(tableId, 6);
        const rows = [];
        for (let r = 0; r < n; r++) {
          const cells = sys.muscleColumns.map((c, ci) => Store.getField(`${tableId}:${r}:${ci}`));
          if (cells.some(filled)) rows.push(cells);
        }
        html += tableHTML(region, sys.muscleColumns, rows);
        html += diagramHTML(`${tableId}:diagram`, region + " diagram");
      });
    }
    return html + `</section>`;
  }

  function clinSection(spec) {
    const C = GUIDE.clinical;
    const st = Store.getStatus("st:clin:" + spec.id);
    let html = `<section class="section"><div class="sec-head">${SVG.lotus}` +
      `<h2>${esc(spec.name)}</h2><span class="pill ${st}">${statusLabel(st)}</span></div>`;
    if (spec.blurb) html += `<p class="blurb">${esc(spec.blurb)}</p>`;
    const vid = Store.getField(`vid:clin:${spec.id}`);
    if (filled(vid)) html += `<p class="vidline">&#9658; Video: <a href="${esc(vid)}">${esc(vid)}</a></p>`;

    const ovId = `ov:${spec.id}`;
    const ovN = Store.getRows(ovId, C.defaultOverviewRows);
    const ovRows = [];
    for (let r = 0; r < ovN; r++) {
      const cells = C.overviewColumns.map((c, ci) => Store.getField(`${ovId}:${r}:${ci}`));
      if (cells.some(filled)) ovRows.push(cells);
    }
    html += tableHTML("Topic Overview / Need to Know", C.overviewColumns, ovRows);

    const tcount = Store.getTopics(spec.id, 1);
    for (let t = 0; t < tcount; t++) {
      const tableId = `clt:${spec.id}:${t}`;
      const title = Store.getField(`cltitle:${spec.id}:${t}`);
      const n = Store.getRows(tableId, C.defaultTableRows);
      const rows = [];
      for (let r = 0; r < n; r++) {
        const cells = C.tableColumns.map((c, ci) => Store.getField(`${tableId}:${r}:${ci}`));
        if (cells.some(filled)) rows.push(cells);
      }
      if (!rows.length && !filled(title)) continue;
      html += tableHTML(filled(title) ? stripToText(title) : `Topic ${t + 1}`, C.tableColumns, rows);
    }
    return html + `</section>`;
  }

  function build() {
    const date = new Date().toLocaleDateString(undefined,
      { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const streak = Store.streakCount(), days = Store.activeDays();
    const apDone = GUIDE.ap.filter(s => apStatus(s) === "done").length;

    let body = `<div class="cover">
      <div class="mandala">${SVG.mandala}</div>
      <h1>Anjali&rsquo;s Study Atlas</h1>
      <div class="sub">Anatomy &middot; Physiology &middot; Clinical Medicine</div>
      <div class="tag">a little booklet for your PA-school journey &#127807;</div>
      <div class="date">${esc(date)}</div>
      <div class="meta">${days} days studied &middot; ${streak}-day streak &middot; ${apDone}/${GUIDE.ap.length} systems mastered</div>
    </div>`;
    GUIDE.ap.forEach(s => body += apSection(s));
    GUIDE.clinical.specialties.forEach(s => body += clinSection(s));
    return body;
  }

  const CSS = `
    :root{ --maroon:#987654; --teal:#0f7173; --marigold:#c19a6b; --gold:#b89a6a;
      --ink:#2a2118; --ink-soft:#6b5d4f; --line:#e3d6bb; }
    *{ box-sizing:border-box; }
    html,body{ margin:0; padding:0; background:#fff; color:var(--ink);
      font-family:'Mukta',system-ui,sans-serif; font-size:11pt; line-height:1.5; }
    @page{ size:A5; margin:12mm 12mm 14mm; }
    h1,h2,h3{ font-family:'Marcellus',serif; font-weight:400; }
    .cover{ display:flex; flex-direction:column; align-items:center; justify-content:center;
      text-align:center; min-height:248mm; page-break-after:always; }
    .cover .mandala svg{ width:130px; height:130px; }
    .cover h1{ font-size:30pt; color:var(--maroon); margin:16px 0 2px; }
    .cover .sub{ color:var(--ink-soft); letter-spacing:1px; text-transform:uppercase; font-size:9pt; }
    .cover .tag{ margin-top:16px; color:var(--teal); font-style:italic; }
    .cover .date{ margin-top:18px; font-size:10pt; color:var(--ink); }
    .cover .meta{ margin-top:4px; font-size:9pt; color:var(--ink-soft); }
    .section{ page-break-before:always; }
    .sec-head{ display:flex; align-items:center; gap:9px;
      border-bottom:2px solid var(--marigold); padding-bottom:6px; margin-bottom:10px; }
    .sec-head svg{ width:24px; height:24px; flex:0 0 auto; }
    .sec-head h2{ margin:0; color:var(--maroon); font-size:18pt; }
    .sec-head .pill{ margin-left:auto; font-size:7.5pt; padding:2px 9px; border-radius:999px;
      border:1px solid var(--gold); color:var(--gold); text-transform:uppercase; letter-spacing:.5px; }
    .sec-head .pill.done{ border-color:var(--teal); color:var(--teal); }
    .sec-head .pill.in{ border-color:var(--marigold); color:#b5760a; }
    .blurb{ color:var(--ink-soft); font-style:italic; margin:0 0 10px; font-size:10pt; }
    .vidline{ margin:0 0 10px; font-size:9.5pt; color:var(--teal); }
    .vidline a{ color:var(--teal); word-break:break-all; }
    .diagram{ margin:6px 0 12px; text-align:center; break-inside:avoid; }
    .diagram img{ max-width:80%; max-height:90mm; border:1px solid var(--line); border-radius:6px; }
    .topic{ margin:9px 0; break-inside:avoid; }
    .topic h3{ margin:0 0 3px; color:var(--teal); font-size:12.5pt; display:flex; align-items:center; gap:6px; }
    .topic h3 svg{ width:14px; height:14px; color:var(--marigold); flex:0 0 auto; }
    .sub{ margin:3px 0 5px 2px; }
    .sub .chk{ color:var(--teal); margin-right:5px; }
    .sub .lbl{ font-weight:600; }
    .note{ margin:3px 0 7px 20px; padding:6px 10px; background:#fffaf0;
      border:1px solid var(--line); border-left:3px solid var(--marigold); border-radius:6px; }
    .note img{ max-width:100%; height:auto; border-radius:6px; border:1px solid var(--line); margin:4px 0; }
    .note ul,.note ol{ margin:3px 0; padding-left:18px; }
    table{ width:100%; border-collapse:collapse; margin:8px 0; font-size:9pt; }
    caption{ caption-side:top; text-align:left; font-family:'Marcellus',serif;
      color:var(--maroon); font-size:11pt; padding:4px 0; }
    th{ background:#fbeecb; color:var(--maroon); border:1px solid var(--gold);
      padding:4px 6px; text-align:left; font-weight:600; }
    td{ border:1px solid var(--line); padding:4px 6px; vertical-align:top; }
    td img{ max-width:150px; height:auto; }
    tr{ break-inside:avoid; }
    .print-actions{ position:fixed; top:10px; right:10px; z-index:9; }
    .print-actions button{ font-family:'Mukta',sans-serif; font-size:10pt; cursor:pointer;
      background:var(--marigold); color:#3a2410; border:none; border-radius:999px; padding:8px 16px;
      box-shadow:0 3px 10px rgba(0,0,0,.18); }
    @media print{ .print-actions{ display:none; } }
  `;

  function booklet() {
    const w = window.open("", "_blank");
    if (!w) {
      App && App.toast ? App.toast("Allow pop-ups to print the booklet") :
        alert("Please allow pop-ups to print the booklet.");
      return;
    }
    const doc = "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
      "<title>Anjali's Study Atlas — Booklet</title>" +
      "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">" +
      "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>" +
      "<link href=\"https://fonts.googleapis.com/css2?family=Marcellus&family=Mukta:wght@300;400;600;700&display=swap\" rel=\"stylesheet\">" +
      "<style>" + CSS + "</style></head><body>" +
      "<div class=\"print-actions\"><button onclick=\"window.print()\">Print / Save as PDF</button></div>" +
      build() +
      "<scr" + "ipt>window.addEventListener('load',function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},600);});</scr" + "ipt>" +
      "</body></html>";
    w.document.open();
    w.document.write(doc);
    w.document.close();
  }

  return { booklet };
})();

window.Print = Print;
