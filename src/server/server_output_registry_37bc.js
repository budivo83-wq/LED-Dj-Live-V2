export const SERVER_OUTPUT_REGISTRY_37BC_VERSION = 'step37bc-server-output-registry';

const DEFAULT_STALE_MS = 2500;

function nowMs() { return Date.now(); }
function cleanOwner(owner) { return String(owner || '').trim() || 'unknown'; }
function cleanKind(kind) { return String(kind || '').trim() || 'physical'; }

export function createServerOutputRegistry37BC({ staleMs = DEFAULT_STALE_MS, logger = console } = {}) {
  const state = {
    owner: null,
    kind: null,
    acquiredAt: 0,
    touchedAt: 0,
    acquireCount: 0,
    releaseCount: 0,
    deniedCount: 0,
    conflictCount: 0,
    lastDenied: null,
    lastConflict: null,
    lastEvent: null
  };

  function isStale(now = nowMs()) {
    return Boolean(state.owner && staleMs > 0 && state.touchedAt && now - state.touchedAt > staleMs);
  }

  function clearIfStale(now = nowMs()) {
    if (!isStale(now)) return false;
    const previous = { owner: state.owner, kind: state.kind, ageMs: now - state.touchedAt };
    state.owner = null;
    state.kind = null;
    state.acquiredAt = 0;
    state.touchedAt = 0;
    state.lastEvent = { type: 'stale-release', at: now, previous };
    logger?.warn?.(`[server-output-registry-37bc] stale owner released ${previous.owner} age=${previous.ageMs}ms`);
    return true;
  }

  function acquire({ owner, kind = 'physical', force = false } = {}) {
    const now = nowMs();
    const clean = cleanOwner(owner);
    const routeKind = cleanKind(kind);
    clearIfStale(now);
    if (state.owner && state.owner !== clean && !force) {
      state.deniedCount += 1;
      state.conflictCount += 1;
      state.lastDenied = { at: now, owner: clean, kind: routeKind, activeOwner: state.owner, activeKind: state.kind, reason: 'ACTIVE_OWNER_CONFLICT' };
      state.lastConflict = state.lastDenied;
      return { ok: false, allowed: false, reason: 'ACTIVE_OWNER_CONFLICT', activeOwner: state.owner, activeKind: state.kind, requestedOwner: clean, requestedKind: routeKind, status: snapshot() };
    }
    const changed = state.owner !== clean || state.kind !== routeKind;
    state.owner = clean;
    state.kind = routeKind;
    if (changed || !state.acquiredAt) {
      state.acquiredAt = now;
      state.acquireCount += 1;
    }
    state.touchedAt = now;
    state.lastEvent = { type: changed ? 'acquire' : 'touch', at: now, owner: clean, kind: routeKind };
    return { ok: true, allowed: true, owner: clean, kind: routeKind, changed, status: snapshot() };
  }

  function canWrite({ owner, kind = 'physical', acquireIfFree = false } = {}) {
    const now = nowMs();
    const clean = cleanOwner(owner);
    const routeKind = cleanKind(kind);
    clearIfStale(now);
    if (!state.owner) {
      if (acquireIfFree) return acquire({ owner: clean, kind: routeKind });
      return { ok: true, allowed: true, owner: clean, kind: routeKind, free: true, status: snapshot() };
    }
    if (state.owner === clean) {
      state.touchedAt = now;
      return { ok: true, allowed: true, owner: clean, kind: routeKind, status: snapshot() };
    }
    state.deniedCount += 1;
    state.conflictCount += 1;
    state.lastDenied = { at: now, owner: clean, kind: routeKind, activeOwner: state.owner, activeKind: state.kind, reason: 'ACTIVE_OWNER_CONFLICT' };
    state.lastConflict = state.lastDenied;
    return { ok: false, allowed: false, reason: 'ACTIVE_OWNER_CONFLICT', activeOwner: state.owner, activeKind: state.kind, requestedOwner: clean, requestedKind: routeKind, status: snapshot() };
  }

  function release({ owner, reason = 'manual-release' } = {}) {
    const now = nowMs();
    const clean = cleanOwner(owner);
    if (!state.owner) return { ok: true, released: false, reason: 'NO_ACTIVE_OWNER', status: snapshot() };
    if (state.owner !== clean) {
      state.deniedCount += 1;
      state.lastDenied = { at: now, owner: clean, activeOwner: state.owner, reason: 'RELEASE_DENIED_OWNER_MISMATCH' };
      return { ok: false, released: false, reason: 'RELEASE_DENIED_OWNER_MISMATCH', activeOwner: state.owner, status: snapshot() };
    }
    const previous = { owner: state.owner, kind: state.kind, heldMs: state.acquiredAt ? now - state.acquiredAt : 0 };
    state.owner = null;
    state.kind = null;
    state.acquiredAt = 0;
    state.touchedAt = 0;
    state.releaseCount += 1;
    state.lastEvent = { type: 'release', at: now, reason, previous };
    return { ok: true, released: true, previous, status: snapshot() };
  }

  function snapshot() {
    const now = nowMs();
    const active = Boolean(state.owner && !isStale(now));
    return {
      ok: true,
      version: SERVER_OUTPUT_REGISTRY_37BC_VERSION,
      active,
      owner: active ? state.owner : null,
      kind: active ? state.kind : null,
      ageMs: active && state.acquiredAt ? now - state.acquiredAt : 0,
      idleMs: active && state.touchedAt ? now - state.touchedAt : 0,
      staleMs,
      acquireCount: state.acquireCount,
      releaseCount: state.releaseCount,
      deniedCount: state.deniedCount,
      conflictCount: state.conflictCount,
      lastDenied: state.lastDenied,
      lastConflict: state.lastConflict,
      lastEvent: state.lastEvent
    };
  }

  return Object.freeze({ version: SERVER_OUTPUT_REGISTRY_37BC_VERSION, acquire, canWrite, release, snapshot });
}

export const serverOutputRegistry37BC = createServerOutputRegistry37BC();
