// Small shared helpers for routes.

/** Copy only the allowed keys that are present in the body. */
function pick(body = {}, keys = []) {
  const out = {};
  for (const k of keys) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

/** Serialize an array of plain objects to CSV. */
function toCSV(rows, columns) {
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => esc(typeof c.value === "function" ? c.value(r) : r[c.value])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

/** async route wrapper so we don't repeat try/catch. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { pick, toCSV, wrap };
