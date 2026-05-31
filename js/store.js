// ==========================================================================
//  store.js  —  all persistence lives in the browser (localStorage).
//  Shape:
//  {
//    v: 2,
//    fields:  { fieldId: "text" },          // every editable cell / note
//    checks:  { checkId: true },            // checklist ticks
//    status:  { sectionId: "not|in|done" }, // per-topic progress
//    rows:    { tableId: <int> },           // dynamic row counts for tables
//    topics:  { specialtyId: <int> },       // dynamic disease-table count
//    streak:  { log: { "YYYY-MM-DD": true } },
//    updated: <ms>
//  }
// ==========================================================================

const Store = (() => {
  const KEY = "anjali_study_v2";
  const blank = () => ({
    v: 2, fields: {}, checks: {}, status: {}, rows: {}, topics: {},
    goals: {}, streak: { log: {} }, updated: Date.now()
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const parsed = JSON.parse(raw);
      return Object.assign(blank(), parsed);
    } catch (e) {
      console.warn("Could not read saved notes, starting fresh.", e);
      return blank();
    }
  }

  let saveTimer = null;
  function persist() {
    state.updated = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { console.error("Save failed (storage full?)", e); }
      emit();
    }, 250);
  }

  // --- study streak --------------------------------------------------------
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function markActive() {
    const t = today();
    if (!state.streak.log[t]) { state.streak.log[t] = true; }
  }
  function streakCount() {
    const log = state.streak.log;
    let count = 0;
    const d = new Date();
    // count back from today (today optional) through consecutive days
    if (!log[today()]) d.setDate(d.getDate() - 1); // allow streak if studied yesterday
    while (true) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (log[key]) { count++; d.setDate(d.getDate() - 1); } else break;
    }
    return count;
  }
  function activeDays() { return Object.keys(state.streak.log).length; }

  // --- field accessors -----------------------------------------------------
  function getField(id) { return state.fields[id] || ""; }
  function setField(id, val) {
    if (val === "") delete state.fields[id]; else state.fields[id] = val;
    markActive(); persist();
  }

  function getCheck(id) { return !!state.checks[id]; }
  function setCheck(id, on) {
    if (on) state.checks[id] = true; else delete state.checks[id];
    markActive(); persist();
  }

  function getStatus(id) { return state.status[id] || "not"; }
  function setStatus(id, val) {
    if (val === "not") delete state.status[id]; else state.status[id] = val;
    markActive(); persist();
  }

  function getRows(id, fallback) {
    return state.rows[id] != null ? state.rows[id] : fallback;
  }
  function setRows(id, n) { state.rows[id] = n; persist(); }

  function getTopics(id, fallback) {
    return state.topics[id] != null ? state.topics[id] : fallback;
  }
  function setTopics(id, n) { state.topics[id] = n; persist(); }

  // --- daily goals (todo lists keyed by date) ------------------------------
  // shape: goals[ "YYYY-MM-DD" ] = [ { t: "text", d: false } ]
  function getGoals(date) { return (state.goals[date] || []).map(g => ({ t: g.t, d: !!g.d })); }
  function setGoals(date, arr) {
    if (!arr || !arr.length) delete state.goals[date];
    else state.goals[date] = arr.map(g => ({ t: g.t, d: !!g.d }));
    markActive(); persist();
  }
  function goalDates() { return Object.keys(state.goals).sort().reverse(); }

  // --- progress rollups ----------------------------------------------------
  // Checklist completion for a system, derived from its outline sub-bullets.
  function checklistProgress(sys) {
    let total = 0, done = 0;
    sys.outline.forEach((t, ti) => {
      const items = t.subs.length ? t.subs : [t.topic];
      items.forEach((_, si) => {
        total++;
        if (getCheck(`chk:${sys.id}:${ti}:${si}`)) done++;
      });
    });
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  // --- export / import -----------------------------------------------------
  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }
  function download() {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = today();
    a.href = url;
    a.download = `anjali-notes-${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || !parsed.fields) throw new Error("Not a valid notes backup.");
    state = Object.assign(blank(), parsed);
    persist();
    return true;
  }

  // --- subscriptions (for live progress UI) --------------------------------
  const subs = new Set();
  function emit() { subs.forEach(fn => { try { fn(); } catch (_) {} }); }
  function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

  return {
    getField, setField, getCheck, setCheck, getStatus, setStatus,
    getRows, setRows, getTopics, setTopics,
    getGoals, setGoals, goalDates,
    checklistProgress, streakCount, activeDays,
    today, exportJSON, download, importJSON, subscribe,
    get log() { return state.streak.log; }
  };
})();

window.Store = Store;
