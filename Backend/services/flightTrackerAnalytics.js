const providers = new Map();

function ensure(provider) {
  const key = String(provider || 'unknown');
  if (!providers.has(key)) {
    providers.set(key, {
      provider: key,
      calls: 0,
      cacheHits: 0,
      staleCacheHits: 0,
      throttledRequests: 0,
      deduplicatedRequests: 0,
      failures: 0,
      totalResponseTimeMs: 0,
      lastResponseTimeMs: null,
      lastError: null,
      lastCallAt: null,
    });
  }
  return providers.get(key);
}

function recordCall(provider, responseTimeMs = 0) {
  const item = ensure(provider);
  item.calls += 1;
  item.lastCallAt = new Date().toISOString();
  if (Number.isFinite(Number(responseTimeMs))) {
    item.lastResponseTimeMs = Math.round(Number(responseTimeMs));
    item.totalResponseTimeMs += item.lastResponseTimeMs;
  }
}

function recordCacheHit(provider, { stale = false } = {}) {
  const item = ensure(provider);
  item.cacheHits += 1;
  if (stale) item.staleCacheHits += 1;
}

function recordThrottle(provider) {
  ensure(provider).throttledRequests += 1;
}

function recordDedup(provider) {
  ensure(provider).deduplicatedRequests += 1;
}

function recordFailure(provider, error) {
  const item = ensure(provider);
  item.failures += 1;
  item.lastError = String(error?.message || error || 'Provider request failed').slice(0, 240);
}

function getAnalytics() {
  return [...providers.values()].map((item) => ({
    ...item,
    averageResponseTimeMs: item.calls ? Math.round(item.totalResponseTimeMs / item.calls) : null,
  }));
}

module.exports = {
  recordCall,
  recordCacheHit,
  recordThrottle,
  recordDedup,
  recordFailure,
  getAnalytics,
};
