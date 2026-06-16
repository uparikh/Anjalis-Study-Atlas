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
  // per-key last-modified timestamps power field-level merge (see mergeStates)
  const BUCKETS = ["fields", "checks", "status", "rows", "topics", "goals"];
  const emptyMeta = () => ({ fields: {}, checks: {}, status: {}, rows: {}, topics: {}, goals: {} });
  const blank = () => ({
    v: 2, fields: {}, checks: {}, status: {}, rows: {}, topics: {},
    goals: {}, streak: { log: {} }, meta: emptyMeta(), updated: Date.now()
  });

  // Record when a key in a bucket last changed (a set OR a delete -> tombstone).
  // This lets a merge tell a real edit/deletion apart from a device that simply
  // never had that key, which is what protects a richer copy from being wiped
  // by whole-document last-write-wins.
  function touch(bucket, id) {
    if (!state.meta) state.meta = emptyMeta();
    if (!state.meta[bucket]) state.meta[bucket] = {};
    state.meta[bucket][id] = Date.now();
  }

  // --- local persistence ---------------------------------------------------
  // Safari caps localStorage near 5 MB; a notebook with pasted diagrams blows
  // past that, so setItem throws and the save is silently lost — that's what
  // cost real work. IndexedDB has a far larger quota, so it is now the
  // authoritative local store. localStorage stays only as a fast mirror for
  // instant first paint; its failures are harmless because IndexedDB holds the
  // real copy. The cloud and in-memory state remain full and unchanged.
  const LocalDB = (() => {
    const DB = "anjali_atlas", STORE = "kv", ID = "state";
    let dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise((res, rej) => {
        try {
          if (typeof indexedDB === "undefined") return rej(new Error("no indexedDB"));
          const req = indexedDB.open(DB, 1);
          req.onupgradeneeded = () => req.result.createObjectStore(STORE);
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error);
        } catch (e) { rej(e); }
      });
      return dbp;
    }
    function put(value) {
      return open().then(db => new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, ID);
        tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error);
      })).catch(() => false);
    }
    function get() {
      return open().then(db => new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readonly");
        const r = tx.objectStore(STORE).get(ID);
        r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error);
      })).catch(() => null);
    }
    return { put, get };
  })();

  // Persist locally: IndexedDB is authoritative (no practical size limit),
  // localStorage is a best-effort mirror.
  function saveLocal() {
    LocalDB.put(state);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
  }

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
      saveLocal();
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

  // Raw write of the current state to the cloud.
  function putCloud(opts) {
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

  // Once we've successfully merged the cloud into memory at least once this
  // session, our in-memory state is a superset of the cloud, so writing it back
  // can't drop anything. Until then (e.g. a session that started offline), we
  // must NOT blind-write our possibly-thinner copy over the cloud.
  let syncedThisSession = false;

  // Read-merge-write: pull the current cloud copy, field-merge it into ours,
  // then write the union back, so a save can't clobber edits another device
  // made since our last sync. CRITICAL: if we can't READ the cloud, we do NOT
  // write — overwriting an unread cloud with a thinner local copy is exactly
  // the data-loss bug. Instead we keep the change pending and retry.
  let flushing = false;
  async function flushCloud(opts) {
    const unloading = !!(opts && opts.unload);
    clearTimeout(cloudTimer); cloudTimer = null; firstDirtyAt = 0;
    // On unload there's no time for a round-trip. Only push if we've already
    // merged the cloud this session (so memory ⊇ cloud); otherwise skip — the
    // change is safe in localStorage and will sync on the next load.
    if (unloading) return syncedThisSession ? putCloud(opts) : Promise.resolve(false);
    if (flushing) { cloudTimer = setTimeout(() => flushCloud(), 1500); return false; }
    flushing = true;
    try {
      let reachedCloud = false;
      try {
        const r = await fetch(CLOUD.url, { headers: { "x-atlas-key": CLOUD.key } });
        if (r.ok) {
          reachedCloud = true; // we know what's up there now; safe to write back
          const remote = JSON.parse(await r.text());
          if (remote && typeof remote === "object" && remote.fields) {
            state = mergeStates(state, remote);
            syncedThisSession = true;
            saveLocal();
            emit();
          }
        }
      } catch (_) { /* read failed */ }
      if (!reachedCloud) {
        // Couldn't read the cloud to merge — never overwrite it blind. Keep the
        // edit pending in localStorage and retry shortly.
        dirty = true;
        clearTimeout(cloudTimer);
        cloudTimer = setTimeout(() => flushCloud(), 15000);
        return false;
      }
      return await putCloud(opts);
    } finally { flushing = false; }
  }

  // Force an immediate sync, bypassing the debounce. Persists locally first,
  // then resolves true on a confirmed cloud save.
  function saveNow() {
    saveLocal();
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

  // --- field-level merge (last-write-wins per key, not per document) -------
  // Each side timestamps every key it has touched. For each key we keep the
  // value from whichever side changed it most recently; a key a side never had
  // (no value AND no meta) carries no opinion, so it can't erase the other
  // side's value. Deletions leave a tombstone timestamp, so they still
  // propagate instead of being resurrected.
  function keyTs(side, bucket, id) {
    const m = side.meta && side.meta[bucket];
    if (m && m[id] != null) return m[id];
    // legacy data with no per-key meta: fall back to the document timestamp for
    // keys it actually has, otherwise 0 (no opinion).
    const has = side[bucket] && Object.prototype.hasOwnProperty.call(side[bucket], id);
    return has ? (side.updated || 0) : 0;
  }

  function mergeStates(a, b) {
    const out = blank();
    out.updated = Math.max(a.updated || 0, b.updated || 0);
    BUCKETS.forEach(bucket => {
      const ids = new Set([
        ...Object.keys(a[bucket] || {}), ...Object.keys(b[bucket] || {}),
        ...Object.keys((a.meta && a.meta[bucket]) || {}),
        ...Object.keys((b.meta && b.meta[bucket]) || {})
      ]);
      ids.forEach(id => {
        const ta = keyTs(a, bucket, id), tb = keyTs(b, bucket, id);
        const win = ta >= tb ? a : b;          // newer wins; ties favor local (a)
        out.meta[bucket][id] = Math.max(ta, tb);
        if (win[bucket] && Object.prototype.hasOwnProperty.call(win[bucket], id)) {
          out[bucket][id] = win[bucket][id];   // winner has a value -> keep it
        }                                      // winner deleted it -> stays gone
      });
    });
    // the study streak is append-only: union every recorded day so none is lost
    out.streak = { log: Object.assign({},
      (b.streak && b.streak.log) || {}, (a.streak && a.streak.log) || {}) };
    return out;
  }

  // Startup sync. First fold in the authoritative IndexedDB copy (localStorage
  // may be a stale/truncated mirror if a past save hit Safari's cap), then pull
  // and field-merge the cloud. Everything is a merge, so nothing is lost. We
  // re-render at most once (avoiding repeated work on a big, image-heavy state).
  async function cloudSync() {
    let merged = false;

    // 1) local IndexedDB copy
    try {
      const idb = await LocalDB.get();
      if (idb && typeof idb === "object" && idb.fields) { state = mergeStates(state, idb); merged = true; }
    } catch (_) {}

    // 2) cloud copy
    let reached = false, remote = null;
    try {
      const r = await fetch(CLOUD.url, { headers: { "x-atlas-key": CLOUD.key } });
      if (r.ok) { reached = true; remote = JSON.parse(await r.text()); }
    } catch (_) {} // offline / unreachable: keep working from the local copy

    if (reached && remote && typeof remote === "object" && remote.fields) {
      state = mergeStates(state, remote); merged = true; syncedThisSession = true;
    }

    if (merged) {                       // single redraw + local save
      saveLocal();
      emit();
      remoteSubs.forEach(fn => { try { fn(); } catch (_) {} });
    }
    if (reached && !isEmpty(state)) putCloud({}); // converge / seed the cloud
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
    touch("fields", id); markActive(); persist();
  }

  function getCheck(id) { return !!state.checks[id]; }
  function setCheck(id, on) {
    if (on) state.checks[id] = true; else delete state.checks[id];
    touch("checks", id); markActive(); persist();
  }

  function getStatus(id) { return state.status[id] || "not"; }
  function setStatus(id, val) {
    if (val === "not") delete state.status[id]; else state.status[id] = val;
    touch("status", id); markActive(); persist();
  }

  function getRows(id, fallback) {
    return state.rows[id] != null ? state.rows[id] : fallback;
  }
  function setRows(id, n) { state.rows[id] = n; touch("rows", id); persist(); }

  function getTopics(id, fallback) {
    return state.topics[id] != null ? state.topics[id] : fallback;
  }
  function setTopics(id, n) { state.topics[id] = n; touch("topics", id); persist(); }

  // --- daily goals (todo lists keyed by date) ------------------------------
  // shape: goals[ "YYYY-MM-DD" ] = [ { t: "text", d: false } ]
  function getGoals(date) { return (state.goals[date] || []).map(g => ({ t: g.t, d: !!g.d })); }
  function setGoals(date, arr) {
    if (!arr || !arr.length) delete state.goals[date];
    else state.goals[date] = arr.map(g => ({ t: g.t, d: !!g.d }));
    touch("goals", date); markActive(); persist();
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
