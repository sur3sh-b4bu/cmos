/**
 * The requester's EFFECTIVE branch -- for read-scoping, and (for creates)
 * the branch a new record gets tagged with, since massIntentionService.
 * create() et al read req.user.branchId directly for that. Simply
 * req.user.branchId, already fully resolved per-role by authenticate.js:
 *  - Office Staff/Priest/Accountant: their own home branch_id (from the
 *    token, never overridable). `null` (never assigned one) means
 *    unrestricted -- same "unset = whole church" convention used elsewhere.
 *  - ADMIN: `null` ("All branches" of their own church) by default, or
 *    whichever branch their Settings > Change Branch switcher currently
 *    has selected.
 *  - Master Administrator: whichever branch its Change Church & Branch
 *    switcher currently has selected (church included), or `null` for
 *    "All branches".
 *
 * A `null` value means "don't filter by branch at all" everywhere this is
 * consumed -- never "filter to branch_id IS NULL only".
 */
function effectiveBranchId(req) {
  return req.user.branchId;
}

module.exports = { effectiveBranchId };
