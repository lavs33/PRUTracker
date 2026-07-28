const test = require("node:test");
const assert = require("node:assert/strict");

const { orphanEndorsementIsResolved } = require("./notificationsController");

test("resolves only the long-leave endorsement whose reassignments are complete", () => {
  const completedLeave = {
    affectedProspects: [{ reassigned: true }],
    affectedPolicyholders: [{ reassignedAt: new Date() }],
  };
  const incompleteLeave = {
    affectedProspects: [{ reassigned: true }],
    affectedPolicyholders: [{ reassigned: false }],
  };

  assert.equal(orphanEndorsementIsResolved("longLeave", completedLeave), true);
  assert.equal(orphanEndorsementIsResolved("longLeave", incompleteLeave), false);
});

test("evaluates retirement endorsements independently", () => {
  const completedRetirement = { affectedProspects: [{ reassignedToAgentId: "agent-2" }] };
  const incompleteRetirement = { affectedProspects: [{ reassigned: false }] };

  assert.equal(orphanEndorsementIsResolved("retirement", completedRetirement), true);
  assert.equal(orphanEndorsementIsResolved("retirement", incompleteRetirement), false);
  assert.equal(orphanEndorsementIsResolved("retirement", null), false);
});

