// OCR wrapper around tesseract.js. Runs locally (no API key). The English
// language data is downloaded and cached on first use.
const Tesseract = require("tesseract.js");

/** Recognize text from an image buffer. Returns the raw text. */
async function readText(buffer) {
  const { data } = await Tesseract.recognize(buffer, "eng");
  return (data.text || "").trim();
}

module.exports = { readText };
