// PDF (pdfkit) and Excel (exceljs) generators for transactions and reports.
// Each streams directly to the Express response.
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const d = (v) => new Date(v).toISOString().slice(0, 10);
const n = (v) => Number(v || 0).toFixed(2);

// --- transactions ----------------------------------------------------------

function transactionsPdf(res, items) {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="transactions.pdf"');
  doc.pipe(res);

  doc.fontSize(18).text("WalletCare — Transactions", { align: "left" });
  doc.fontSize(9).fillColor("#666").text(`Generated ${new Date().toLocaleString()}`);
  doc.moveDown();

  const cols = [
    { label: "Date", w: 70 }, { label: "Type", w: 55 }, { label: "Category", w: 90 },
    { label: "Merchant", w: 140 }, { label: "Amount", w: 80, right: true },
  ];
  const startX = doc.x;
  const rowY = (y) => y;

  function row(cells, opts = {}) {
    const y = doc.y;
    let x = startX;
    doc.fontSize(9).fillColor(opts.head ? "#000" : "#222").font(opts.head ? "Helvetica-Bold" : "Helvetica");
    cells.forEach((c, i) => {
      doc.text(String(c), x, rowY(y), { width: cols[i].w, align: cols[i].right ? "right" : "left", lineBreak: false });
      x += cols[i].w;
    });
    doc.moveDown(0.6);
  }

  row(cols.map((c) => c.label), { head: true });
  doc.moveTo(startX, doc.y).lineTo(startX + cols.reduce((s, c) => s + c.w, 0), doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.3);

  let total = 0;
  items.forEach((t) => {
    total += t.type === "income" ? t.amount : -t.amount;
    row([d(t.date), t.type, t.category, t.merchant || "", `${t.type === "income" ? "+" : "-"}${n(t.amount)}`]);
    if (doc.y > 760) { doc.addPage(); }
  });

  doc.moveDown();
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000").text(`Net: ${n(total)}`, { align: "right" });
  doc.end();
}

async function transactionsXlsx(res, items) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Transactions");
  ws.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Type", key: "type", width: 10 },
    { header: "Category", key: "category", width: 18 },
    { header: "Merchant", key: "merchant", width: 24 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Account", key: "account", width: 18 },
    { header: "Notes", key: "notes", width: 30 },
  ];
  ws.getRow(1).font = { bold: true };
  items.forEach((t) =>
    ws.addRow({
      date: d(t.date), type: t.type, category: t.category, merchant: t.merchant || "",
      amount: t.type === "income" ? t.amount : -t.amount,
      account: t.account?.name || "", notes: t.notes || "",
    })
  );
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="transactions.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}

// --- reports ---------------------------------------------------------------

function reportPdf(res, data, label = "") {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="report.pdf"');
  doc.pipe(res);

  doc.fontSize(18).text("WalletCare — Financial Report");
  doc.fontSize(9).fillColor("#666").text(`${label} · generated ${new Date().toLocaleString()}`);
  doc.moveDown();

  doc.fillColor("#000").fontSize(12).font("Helvetica-Bold").text("Summary");
  doc.font("Helvetica").fontSize(10);
  doc.text(`Income:  ${n(data.income)}`);
  doc.text(`Expenses: ${n(data.expense)}`);
  doc.text(`Net (profit/loss): ${n(data.net)}`);
  if (data.netWorth) {
    doc.text(`Net worth: ${n(data.netWorth.net)}  (assets ${n(data.netWorth.assets)} − liabilities ${n(data.netWorth.liabilities)})`);
  }
  doc.moveDown();

  const section = (title, rows) => {
    doc.font("Helvetica-Bold").fontSize(12).text(title);
    doc.font("Helvetica").fontSize(10);
    if (!rows.length) doc.fillColor("#666").text("No data.").fillColor("#000");
    rows.forEach((r) => doc.text(`${r.category}: ${n(r.total)} (${r.count})`));
    doc.moveDown();
  };
  section("Income by category", data.incomeByCategory || []);
  section("Expense by category", data.expenseByCategory || []);
  doc.end();
}

async function reportXlsx(res, data) {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet("Summary");
  summary.addRows([
    ["Income", Number(data.income)],
    ["Expenses", Number(data.expense)],
    ["Net", Number(data.net)],
    ["Net worth", Number(data.netWorth?.net || 0)],
  ]);
  summary.getColumn(1).width = 20;

  const cat = wb.addWorksheet("Categories");
  cat.columns = [
    { header: "Type", key: "type", width: 12 },
    { header: "Category", key: "category", width: 20 },
    { header: "Total", key: "total", width: 14 },
    { header: "Count", key: "count", width: 10 },
  ];
  cat.getRow(1).font = { bold: true };
  (data.incomeByCategory || []).forEach((c) => cat.addRow({ type: "income", ...c }));
  (data.expenseByCategory || []).forEach((c) => cat.addRow({ type: "expense", ...c }));

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="report.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}

module.exports = { transactionsPdf, transactionsXlsx, reportPdf, reportXlsx };
