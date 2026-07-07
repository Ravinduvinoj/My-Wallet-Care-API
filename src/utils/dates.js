// Date-range helpers used by dashboard, reports, and notifications.

function monthRange(ref = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function yearRange(ref = new Date()) {
  const start = new Date(ref.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { start, end };
}

/** Resolve a report period keyword (or explicit from/to) into a date range. */
function rangeForPeriod(period, from, to, ref = new Date()) {
  if (from && to) return { start: new Date(from), end: new Date(to) };
  const now = new Date(ref);
  switch (period) {
    case "daily": {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case "weekly": {
      const start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case "yearly":
      return yearRange(now);
    case "monthly":
    default:
      return monthRange(now);
  }
}

/** Last N months as [{ key: 'YYYY-MM', start, end, label }]. */
function lastMonths(n, ref = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const { start, end } = monthRange(d);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-US", { month: "short" }),
      start,
      end,
    });
  }
  return out;
}

module.exports = { monthRange, yearRange, rangeForPeriod, lastMonths };
