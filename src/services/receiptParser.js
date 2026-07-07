// Heuristic parser: turns raw OCR text from a receipt into structured data
// (merchant, line items with qty/price, subtotal, discount, tax, total).
// OCR is imperfect, so results are best-effort and meant to be editable by the
// user before/after saving.

const num = (s) => parseFloat(String(s).replace(/[^0-9.,]/g, "").replace(",", "."));

// A price near the end of a line, e.g. "12.99", "1,250.00", "-3.00".
const TRAILING_PRICE = /(-?\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*$/;

const KEYWORDS = {
  subtotal: /\bsub[\s-]?total\b/i,
  discount: /\b(discount|coupon|savings?|off)\b/i,
  tax: /\b(tax|vat|gst|hst)\b/i,
  total: /\b(grand\s*total|total\s*due|amount\s*due|balance\s*due|total)\b/i,
};

function detectQty(name) {
  // "2 x Coffee", "2X Coffee", "2 @ 1.50", "Coffee x2"
  let qty = 1;
  let m = name.match(/^\s*(\d{1,3})\s*[xX@*]\s*/);
  if (m) qty = parseInt(m[1], 10);
  else if ((m = name.match(/\bx\s*(\d{1,3})\b/i))) qty = parseInt(m[1], 10);
  const clean = name
    .replace(/^\s*\d{1,3}\s*[xX@*]\s*/, "")
    .replace(/\bx\s*\d{1,3}\b/i, "")
    .replace(/^\s*[-*•]\s*/, "")
    .trim();
  return { qty: qty > 0 ? qty : 1, clean };
}

function parseReceipt(text) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const items = [];
  let subtotal = null;
  let discount = 0;
  let tax = 0;
  let total = null;
  let currency = "USD";

  // Currency hint from symbols in the text.
  if (/€/.test(text)) currency = "EUR";
  else if (/£/.test(text)) currency = "GBP";
  else if (/₹/.test(text)) currency = "INR";
  else if (/\$/.test(text)) currency = "USD";

  // Merchant guess: first line with letters and no trailing price.
  const merchant =
    lines.find((l) => /[A-Za-z]{2,}/.test(l) && !TRAILING_PRICE.test(l)) || "";

  for (const line of lines) {
    const priceMatch = line.match(TRAILING_PRICE);
    const amount = priceMatch ? num(priceMatch[1]) : null;
    const lower = line.toLowerCase();

    if (amount == null || Number.isNaN(amount)) continue;

    if (KEYWORDS.subtotal.test(lower)) {
      subtotal = amount;
      continue;
    }
    if (KEYWORDS.discount.test(lower)) {
      discount += Math.abs(amount);
      continue;
    }
    if (KEYWORDS.tax.test(lower)) {
      tax += amount;
      continue;
    }
    if (KEYWORDS.total.test(lower)) {
      total = amount;
      continue;
    }

    // Otherwise treat as a line item.
    const rawName = line.replace(TRAILING_PRICE, "").trim();
    const { qty, clean } = detectQty(rawName);
    if (clean && clean.replace(/[^A-Za-z]/g, "").length >= 2) {
      items.push({
        name: clean,
        qty,
        price: qty ? +(amount / qty).toFixed(2) : amount,
        total: amount,
      });
    }
  }

  const itemsSum = items.reduce((s, i) => s + i.total, 0);
  if (subtotal == null) subtotal = +itemsSum.toFixed(2);
  if (total == null) total = +(subtotal - discount + tax).toFixed(2);

  return { merchant, currency, items, subtotal, discount, tax, total };
}

module.exports = { parseReceipt };
