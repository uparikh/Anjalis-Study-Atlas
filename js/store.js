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

  // --- cloud sync (Cloudflare Worker + KV) ---------------------------------
  // localStorage stays the fast local cache; this mirrors it to the cloud so
  // notes survive a browser-memory wipe with no login. Last-write-wins.
  const CLOUD = {
    url: "https://anjali-atlas.uditparikh28.workers.dev/",
    key: "atlas_9f3c7a1e8b4d62059e7c"
  };
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
      pushCloud();
    }, 250);
  }

  // --- cloud push/pull -----------------------------------------------------
  function isEmpty(s) {
    return s && !Object.keys(s.fields || {}).length
      && !Object.keys(s.checks || {}).length
      && !Object.keys(s.status || {}).length
      && !Object.keys(s.rows || {}).length
      && !Object.keys(s.topics || {}).length
      && !Object.keys(s.goals || {}).length
      && !Object.keys((s.streak && s.streak.log) || {}).length;
  }

  // Background cloud save: wait until she stops editing for SAVE_IDLE ms, but
  // never hold unsaved changes longer than SAVE_MAX ms during nonstop typing.
  // Also flushes instantly when the tab is hidden or closed. Each save is a
  // full snapshot, so a dropped/late save never loses data — the next one
  // re-syncs everything. This keeps writes far under the free 1,000/day cap.
  const SAVE_IDLE = 10000;   // save 10s after the last change
  const SAVE_MAX  = 60000;   // ...but at least once a minute while actively editing
  let cloudTimer = null, firstDirtyAt = 0, dirty = false;

  // Browsers cap the *total* body of any keepalive fetch at 64 KiB. Notes that
  // include pasted diagrams (data-URL images) sail past that, so keepalive can
  // only be used for the small-snapshot case on tab hide/close. Normal saves
  // use a regular fetch, which has no such limit and completes while the tab is
  // open. Without this, every save silently failed once notes grew past ~64 KB.
  const KEEPALIVE_LIMIT = 60000; // stay safely under the 64 KiB ceiling

  function flushCloud(opts) {
    clearTimeout(cloudTimer); cloudTimer = null; firstDirtyAt = 0;
    const body = JSON.stringify(state);
    const unloading = !!(opts && opts.unload);
    return fetch(CLOUD.url, {
      method: "PUT",
      headers: { "x-atlas-key": CLOUD.key, "Content-Type": "application/json" },
      body,
      // only opt into keepalive on unload, and only when the body fits its cap
      keepalive: unloading && body.length < KEEPALIVE_LIMIT
    }).then(r => {
      if (r.ok) { dirty = false; return true; }
      dirty = true; console.error("Cloud save rejected:", r.status); return false;
    }).catch(() => { dirty = true; return false; }); // offline: localStorage holds it; retry next change
  }

  // Force an immediate push to the cloud, bypassing the debounce. Persists the
  // latest to localStorage first, then resolves true on a confirmed save.
  function saveNow() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
    return flushCloud();
  }

  function pushCloud(immediate) {
    dirty = true;
    if (immediate) { flushCloud(); return; }
    if (!firstDirtyAt) firstDirtyAt = Date.now();
    clearTimeout(cloudTimer);
    const wait = Math.min(SAVE_IDLE, Math.max(0, SAVE_MAX - (Date.now() - firstDirtyAt)));
    cloudTimer = setTimeout(flushCloud, wait);
  }

  // Always back up the latest before the tab is hidden or closed.
  if (typeof window !== "undefined") {
    const flushIfDirty = () => { if (dirty) flushCloud({ unload: true }); };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushIfDirty();
    });
    window.addEventListener("pagehide", flushIfDirty);
  }

  const remoteSubs = new Set();
  function onRemote(fn) { remoteSubs.add(fn); return () => remoteSubs.delete(fn); }

  // Pull cloud copy once at startup. Adopt it if local is empty (e.g. a fresh
  // device or a wiped browser) or if the cloud copy is newer; otherwise push
  // the local copy up so the cloud catches up.
  async function cloudSync() {
    let remote = null;
    try {
      const r = await fetch(CLOUD.url, { headers: { "x-atlas-key": CLOUD.key } });
      if (!r.ok) return;
      remote = JSON.parse(await r.text());
    } catch (e) { return; } // offline / unreachable: keep working from localStorage

    const remoteHasData = remote && remote.fields && !isEmpty(remote);
    if (remoteHasData && (isEmpty(state) || (remote.updated || 0) > (state.updated || 0))) {
      state = Object.assign(blank(), remote);
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
      emit();
      remoteSubs.forEach(fn => { try { fn(); } catch (_) {} });
      return;
    }
    if (!isEmpty(state)) pushCloud(true); // local wins (or cloud empty): seed cloud
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
    onRemote, cloudSync, saveNow,
    get log() { return state.streak.log; }
  };
})();

window.Store = Store;
