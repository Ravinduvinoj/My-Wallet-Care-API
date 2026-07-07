// Global Mongoose plugin: soft delete.
// Adds a `deletedAt` field, hides soft-deleted docs from normal reads/aggregates,
// and provides softDelete() / softDeleteOne() helpers. Nothing is ever removed
// from the database (except an admin DB restore, which uses deleteMany directly).

module.exports = function softDelete(schema) {
  schema.add({ deletedAt: { type: Date, default: null } });

  // Exclude soft-deleted docs unless the query explicitly mentions deletedAt.
  function excludeDeleted() {
    const filter = this.getFilter();
    if (!("deletedAt" in filter)) this.where({ deletedAt: null });
  }
  ["count", "countDocuments", "find", "findOne", "findOneAndUpdate", "updateMany", "updateOne"].forEach(
    (op) => schema.pre(op, excludeDeleted)
  );

  // Prepend a filter stage so aggregations skip soft-deleted docs too.
  schema.pre("aggregate", function () {
    this.pipeline().unshift({ $match: { deletedAt: null } });
  });

  schema.methods.softDelete = function () {
    this.deletedAt = new Date();
    return this.save();
  };

  // Returns the doc (soft-deleted) or null if not found / already deleted.
  schema.statics.softDeleteOne = function (filter) {
    return this.findOneAndUpdate(filter, { deletedAt: new Date() }, { new: true });
  };
};
