const ActivityLog = require("../models/ActivityLog");

/** Fire-and-forget audit log (never blocks the request on failure). */
function log(user, action, detail = "", ip = "") {
  ActivityLog.create({ user, action, detail, ip }).catch(() => {});
}

module.exports = { log };
