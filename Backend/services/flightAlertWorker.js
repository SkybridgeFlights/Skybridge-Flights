const { checkActiveSubscriptions } = require('./flightAlertService');

const DEFAULT_INTERVAL_MS = 7 * 60 * 1000;
let timer = null;
let running = false;

function startFlightAlertWorker() {
  if (process.env.FLIGHT_ALERT_WORKER_ENABLED === 'false') {
    console.log('[flight-alerts] worker disabled');
    return null;
  }

  if (timer) return timer;

  const intervalMs = Number(process.env.FLIGHT_ALERT_CHECK_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  const limit = Number(process.env.FLIGHT_ALERT_CHECK_LIMIT || 50);

  const run = async () => {
    if (running) {
      console.log('[flight-alerts] worker skipped; previous run still active');
      return;
    }

    running = true;
    const startedAt = Date.now();
    try {
      const summary = await checkActiveSubscriptions({ limit });
      console.log(
        `[flight-alerts] worker checked=${summary.checked} notified=${summary.notified} failed=${summary.failed} ms=${Date.now() - startedAt}`
      );
    } catch (error) {
      console.warn('[flight-alerts] worker failed:', error.message);
    } finally {
      running = false;
    }
  };

  timer = setInterval(run, intervalMs);
  timer.unref?.();
  setTimeout(run, 30 * 1000).unref?.();
  console.log(`[flight-alerts] worker started intervalMs=${intervalMs}`);
  return timer;
}

module.exports = {
  startFlightAlertWorker,
};
