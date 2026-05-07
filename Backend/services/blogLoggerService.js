function sanitize(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitize);
  return Object.entries(value).reduce((acc, [key, item]) => {
    if (/key|token|secret|password|credential/i.test(key)) {
      acc[key] = '[redacted]';
    } else {
      acc[key] = sanitize(item);
    }
    return acc;
  }, {});
}

function blogLog(event, payload = {}, level = 'info') {
  const entry = {
    ts: new Date().toISOString(),
    scope: 'ai-blog',
    event,
    level,
    ...sanitize(payload),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

module.exports = { blogLog, sanitize };
