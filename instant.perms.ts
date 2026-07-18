import type { InstantRules } from "@instantdb/core";
import schema from "./instant.schema";
import { instantWorkspaceId } from "./instant.config";

// This is a public record id, not a credential. Access additionally requires
// the password-derived capability supplied through ruleParams.
const allowedFields = [
  "capability", "cryptoVersion", "payloadVersion", "revision", "iv",
  "ciphertext", "mutationId", "writerId", "updatedAt",
];

const rules = {
  $default: {
    allow: { $default: "false" },
  },
  attrs: {
    allow: { create: "false" },
  },
  workspaces: {
    allow: {
      view: `data.id == '${instantWorkspaceId}' && size(ruleParams.capability) == 43 && data.capability == ruleParams.capability && rateLimit.readWorkspace.limit(request.ip)`,
      // The encrypted workspace has already been provisioned. Keeping create
      // permanently disabled closes the anonymous first-writer takeover window.
      create: "false",
      update: `data.id == '${instantWorkspaceId}' && size(ruleParams.capability) == 43 && data.capability == ruleParams.capability && size(newData.capability) == 43 && newData.revision == data.revision + 1 && data.cryptoVersion >= 1 && data.cryptoVersion <= 2 && ((newData.capability == data.capability && newData.cryptoVersion == data.cryptoVersion) || (ruleParams.operation == 'rotate' && ruleParams.baseRevision == data.revision && ruleParams.mutationId == newData.mutationId && ruleParams.nextCapability == newData.capability && newData.capability != data.capability && newData.cryptoVersion == 2)) && newData.payloadVersion == 1 && newData.iv != data.iv && size(newData.iv) == 16 && size(newData.mutationId) == 36 && size(newData.writerId) == 36 && request.modifiedFields.all(field, field in ${JSON.stringify(allowedFields)}) && size(newData.ciphertext) >= 20 && size(newData.ciphertext) <= 5000000 && rateLimit.writeWorkspace.limit(request.ip)`,
      delete: "false",
    },
  },
  $rateLimits: {
    readWorkspace: {
      limits: [
        { capacity: 120, refill: { amount: 120, period: "1 minute" } },
        { capacity: 2_000, refill: { amount: 2_000, period: "1 day" } },
      ],
    },
    writeWorkspace: {
      limits: [
        { capacity: 90, refill: { amount: 90, period: "1 minute" } },
        { capacity: 2_000, refill: { amount: 2_000, period: "1 day" } },
      ],
    },
  },
} satisfies InstantRules<typeof schema>;

export default rules;
