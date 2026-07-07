const { Schema, model } = require("mongoose");

const itemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    qty: { type: Number, default: 1 },
    price: { type: Number, default: 0 }, // unit price
    total: { type: Number, default: 0 }, // line total (qty * price)
  },
  { _id: false }
);

const receiptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    merchant: { type: String, trim: true, default: "" },
    date: { type: Date, default: Date.now },
    currency: { type: String, default: "USD" },

    items: { type: [itemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    // Raw OCR text, kept so users can see/verify what was read.
    rawText: { type: String, default: "", select: false },

    // The scanned image, stored in the document. `data` is excluded from
    // normal queries (select:false) so lists don't drag the blob around.
    image: {
      data: { type: Buffer, select: false },
      contentType: { type: String },
      filename: { type: String },
      size: { type: Number },
    },
  },
  { timestamps: true }
);

module.exports = model("Receipt", receiptSchema);
