// Exchange-rate service. Fetches USD-based rates from a free, no-key API and
// caches them for an hour. Falls back to a small static table if the network
// is unavailable, so conversion always returns something.

const RATES_URL = "https://open.er-api.com/v6/latest/USD";
const TTL = 60 * 60 * 1000; // 1 hour

const FALLBACK = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 155, INR: 83, AUD: 1.52,
  CAD: 1.36, CHF: 0.9, CNY: 7.24, LKR: 300, AED: 3.67,
};

let cache = { rates: null, base: "USD", fetchedAt: 0, live: false };

async function getRates() {
  const fresh = cache.rates && Date.now() - cache.fetchedAt < TTL;
  if (fresh) return cache;
  try {
    const res = await fetch(RATES_URL);
    const json = await res.json();
    if (json.result === "success" && json.rates) {
      cache = { rates: json.rates, base: "USD", fetchedAt: Date.now(), live: true };
      return cache;
    }
    throw new Error("bad response");
  } catch {
    // Keep any previous cache; otherwise use the fallback table.
    if (!cache.rates) cache = { rates: FALLBACK, base: "USD", fetchedAt: Date.now(), live: false };
    return cache;
  }
}

/** Convert an amount between two currencies via the USD-based rate table. */
async function convert(amount, from, to) {
  const { rates } = await getRates();
  const f = rates[from?.toUpperCase()];
  const t = rates[to?.toUpperCase()];
  if (!f || !t) throw new Error(`Unsupported currency: ${!f ? from : to}`);
  const inUsd = Number(amount) / f;
  return inUsd * t;
}

module.exports = { getRates, convert, FALLBACK };
