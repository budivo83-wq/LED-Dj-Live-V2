/* STEP37BB: physical output route registry.
   One small browser-side authority layer for live LED writers.
   Goal: make it visible and enforceable which route is allowed to touch
   physical LED output while Performance/preview/debug continue to run safely. */
(function(){
  const REGISTRY_NAME = '__budilightOutputRouteRegistry37BB';
  const LEGACY_LOCK_NAME = '__budilightOutputLock37AP';
  const VERSION = 'STEP37BB_OUTPUT_ROUTE_REGISTRY';
  const DEFAULT_TTL_MS = 1600;
  const OWNER_PRIORITY = {
    'artnet-master-framebus-mirror': 100,
    'live-serial-app-mirror': 90,
    'multi-output-router': 80,
    'output-runner': 70,
    'preview-render': 5,
    'debug': 1
  };

  function now(){
    try { return performance.now(); } catch { return Date.now(); }
  }
  function epoch(){ return Date.now(); }
  function cleanName(value){
    return String(value || '').trim().replace(/[^a-zA-Z0-9_.:-]/g, '-').slice(0, 80) || 'unknown';
  }
  function priorityOf(name, route){
    const explicit = Number(route && route.priority);
    if (Number.isFinite(explicit)) return explicit;
    return Number(OWNER_PRIORITY[cleanName(name)] || 10);
  }
  function cloneRoute(route){
    return {
      name: cleanName(route && route.name),
      type: String(route && route.type || 'unknown').slice(0, 32),
      active: route && route.active === true,
      allowed: route && route.allowed === true,
      priority: Number(route && route.priority || 0),
      lastClaimAt: Number(route && route.lastClaimAt || 0),
      lastClaimEpoch: Number(route && route.lastClaimEpoch || 0),
      lastReleaseAt: Number(route && route.lastReleaseAt || 0),
      ttlMs: Number(route && route.ttlMs || DEFAULT_TTL_MS),
      reason: String(route && route.reason || '').slice(0, 120),
      suppressed: Number(route && route.suppressed || 0),
      writes: Number(route && route.writes || 0)
    };
  }
  function createRegistry(){
    const registry = {
      version: VERSION,
      routes: {},
      owner: '',
      ownerType: '',
      ownerSince: 0,
      ownerEpoch: 0,
      active: false,
      conflicts: 0,
      denied: 0,
      writes: 0,
      releases: 0,
      staleReleases: 0,
      updatedAt: 0,
      lastDecision: '',
      lastDeniedOwner: '',
      lastDeniedBy: '',
      register,
      claim,
      release,
      canWrite,
      markWrite,
      snapshot,
      prune
    };
    return registry;

    function routeFor(name, data){
      const key = cleanName(name);
      const existing = registry.routes[key] || {};
      const route = registry.routes[key] = {
        ...existing,
        name: key,
        type: String((data && data.type) || existing.type || 'unknown').slice(0, 32),
        priority: priorityOf(key, data || existing),
        ttlMs: Math.max(250, Math.min(10000, Number((data && data.ttlMs) || existing.ttlMs || DEFAULT_TTL_MS))),
        reason: String((data && data.reason) || existing.reason || '').slice(0, 120),
        active: existing.active === true,
        allowed: existing.allowed === true,
        suppressed: Number(existing.suppressed || 0),
        writes: Number(existing.writes || 0),
        lastClaimAt: Number(existing.lastClaimAt || 0),
        lastClaimEpoch: Number(existing.lastClaimEpoch || 0),
        lastReleaseAt: Number(existing.lastReleaseAt || 0)
      };
      return route;
    }
    function updateLegacyLock(reason){
      try {
        const lock = window[LEGACY_LOCK_NAME] || { version: 'STEP37AP_OUTPUT_LOCK', owner: '', active: false, updatedAt: 0, reason: '' };
        lock.owner = registry.active ? registry.owner : '';
        lock.active = registry.active === true;
        lock.reason = reason || registry.lastDecision || (registry.active ? 'route-registry-owner' : 'route-registry-idle');
        lock.updatedAt = epoch();
        lock.registryVersion = VERSION;
        window[LEGACY_LOCK_NAME] = lock;
      } catch {}
    }
    function activeOwnerRoute(t){
      if (!registry.owner) return null;
      const ownerRoute = registry.routes[registry.owner];
      if (!ownerRoute || ownerRoute.active !== true) return null;
      if (t - Number(ownerRoute.lastClaimAt || 0) > Number(ownerRoute.ttlMs || DEFAULT_TTL_MS)) {
        ownerRoute.active = false;
        ownerRoute.allowed = false;
        registry.staleReleases += 1;
        registry.owner = '';
        registry.ownerType = '';
        registry.active = false;
        registry.lastDecision = 'stale-owner-released';
        updateLegacyLock('stale-owner-released');
        return null;
      }
      return ownerRoute;
    }
    function register(name, data){
      const route = routeFor(name, data || {});
      registry.updatedAt = now();
      return snapshot().routes[route.name];
    }
    function claim(name, data){
      const t = now();
      const key = cleanName(name);
      const route = routeFor(key, data || {});
      const wantsActive = !(data && data.active === false);
      const current = activeOwnerRoute(t);
      route.lastClaimAt = t;
      route.lastClaimEpoch = epoch();
      route.reason = String((data && data.reason) || route.reason || '').slice(0, 120);
      route.active = wantsActive;
      if (!wantsActive) {
        route.allowed = false;
        if (registry.owner === key) {
          registry.owner = '';
          registry.ownerType = '';
          registry.active = false;
          registry.releases += 1;
        }
        registry.lastDecision = key + ':inactive';
        registry.updatedAt = t;
        updateLegacyLock(registry.lastDecision);
        return { allowed: false, owner: registry.owner, reason: 'inactive' };
      }
      if (!current || current.name === key || Number(route.priority || 0) >= Number(current.priority || 0)) {
        if (current && current.name !== key) {
          current.allowed = false;
          current.active = false;
          current.suppressed += 1;
          registry.conflicts += 1;
        }
        route.allowed = true;
        registry.owner = key;
        registry.ownerType = route.type;
        registry.ownerSince = registry.ownerSince && registry.owner === key ? registry.ownerSince : t;
        registry.ownerEpoch = registry.ownerEpoch && registry.owner === key ? registry.ownerEpoch : epoch();
        registry.active = true;
        registry.lastDecision = key + ':allowed';
        registry.updatedAt = t;
        updateLegacyLock(registry.lastDecision);
        return { allowed: true, owner: key, reason: 'owner' };
      }
      route.allowed = false;
      route.active = false;
      route.suppressed += 1;
      registry.conflicts += 1;
      registry.denied += 1;
      registry.lastDeniedOwner = key;
      registry.lastDeniedBy = current.name;
      registry.lastDecision = key + ':denied-by:' + current.name;
      registry.updatedAt = t;
      updateLegacyLock(registry.lastDecision);
      return { allowed: false, owner: current.name, reason: 'owned-by-' + current.name };
    }
    function release(name, reason){
      const t = now();
      const key = cleanName(name);
      const route = routeFor(key, {});
      route.active = false;
      route.allowed = false;
      route.lastReleaseAt = t;
      route.reason = String(reason || 'released').slice(0, 120);
      if (registry.owner === key) {
        registry.owner = '';
        registry.ownerType = '';
        registry.active = false;
        registry.releases += 1;
      }
      registry.lastDecision = key + ':released';
      registry.updatedAt = t;
      updateLegacyLock(registry.lastDecision);
      return snapshot();
    }
    function canWrite(name){
      const t = now();
      const key = cleanName(name);
      const route = routeFor(key, {});
      const current = activeOwnerRoute(t);
      const allowed = current && current.name === key && route.allowed === true;
      if (!allowed) {
        route.suppressed += 1;
        registry.denied += 1;
        registry.lastDeniedOwner = key;
        registry.lastDeniedBy = current ? current.name : '';
        registry.lastDecision = key + ':write-denied' + (current ? '-by-' + current.name : '-no-owner');
        registry.updatedAt = t;
        updateLegacyLock(registry.lastDecision);
      }
      return { allowed: Boolean(allowed), owner: current ? current.name : '', reason: allowed ? 'allowed' : registry.lastDecision };
    }
    function markWrite(name, bytes){
      const key = cleanName(name);
      const decision = canWrite(key);
      if (!decision.allowed) return decision;
      const route = routeFor(key, {});
      route.writes += 1;
      route.lastWriteAt = now();
      route.lastBytes = Math.max(0, Number(bytes || 0));
      registry.writes += 1;
      registry.updatedAt = route.lastWriteAt;
      return decision;
    }
    function prune(){
      activeOwnerRoute(now());
      return snapshot();
    }
    function snapshot(){
      const routes = {};
      Object.keys(registry.routes || {}).sort().forEach((key) => { routes[key] = cloneRoute(registry.routes[key]); });
      return {
        version: VERSION,
        active: registry.active === true,
        owner: registry.owner,
        ownerType: registry.ownerType,
        ownerSince: Number(registry.ownerSince || 0),
        conflicts: Number(registry.conflicts || 0),
        denied: Number(registry.denied || 0),
        writes: Number(registry.writes || 0),
        releases: Number(registry.releases || 0),
        staleReleases: Number(registry.staleReleases || 0),
        updatedAt: Number(registry.updatedAt || 0),
        lastDecision: registry.lastDecision,
        lastDeniedOwner: registry.lastDeniedOwner,
        lastDeniedBy: registry.lastDeniedBy,
        routes
      };
    }
  }

  const existing = window[REGISTRY_NAME];
  if (existing && existing.version === VERSION && typeof existing.claim === 'function') return;
  const registry = createRegistry();
  window[REGISTRY_NAME] = registry;
  try { window.__budilightOutputRouteRegistrySnapshot37BB = () => registry.snapshot(); } catch {}
  // STEP37CY: prune is housekeeping only; let the central loop registry slow it
  // down during active output/hidden UI instead of waking the main thread at a
  // fixed cadence.
  try {
    const loops = window.__budilightRuntimeLoopRegistry37CE;
    if (loops && typeof loops.adaptiveInterval === 'function') {
      loops.adaptiveInterval('route-registry:prune', () => registry.prune(), 1500, { group: 'route-registry', liveFactor: 3.5, hiddenFactor: 6, maxMs: 15000 });
    } else {
      setInterval(() => registry.prune(), 1800);
    }
  } catch {}
})();
