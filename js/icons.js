// ==========================================================================
//  icons.js  —  inline Indian-inspired SVG motifs used around the UI.
// ==========================================================================
window.SVG = {
  mandala: `<svg width="46" height="46" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="50" cy="50" r="46" stroke="#e7cf8f" stroke-width="2"/>
    <circle cx="50" cy="50" r="34" stroke="#f4a300" stroke-width="1.5"/>
    <circle cx="50" cy="50" r="10" fill="#f4a300"/>
    ${Array.from({length:12}).map((_,i)=>{const a=i*30*Math.PI/180;const x1=50+18*Math.cos(a),y1=50+18*Math.sin(a),x2=50+34*Math.cos(a),y2=50+34*Math.sin(a);return `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="4" fill="#e7cf8f"/><line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#e7cf8f" stroke-width="1.5"/>`;}).join("")}
    ${Array.from({length:12}).map((_,i)=>{const a=(i*30+15)*Math.PI/180;const x=50+44*Math.cos(a),y=50+44*Math.sin(a);return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="#f4a300"/>`;}).join("")}
  </svg>`,

  lotus: `<svg width="26" height="26" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M32 12c4 8 4 18 0 28-4-10-4-20 0-28z" fill="#e8820c"/>
    <path d="M32 40c-7-6-16-7-24-4 4 9 14 14 24 12 10 2 20-3 24-12-8-3-17-2-24 4z" fill="#f4a300"/>
    <path d="M18 20c1 9 6 16 14 20-2-9-7-16-14-20zM46 20c-1 9-6 16-14 20 2-9 7-16 14-20z" fill="#c9a227"/>
  </svg>`,

  paisley: `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M22 4c6 3 8 12 2 18-5 5-13 4-15-2 4 3 9 2 11-2 2-5-1-9-4-11 2-1 4-1 6-1z" fill="currentColor"/>
    <circle cx="13" cy="20" r="2.5" fill="currentColor"/>
  </svg>`
};
