export const instantAppId = "80a03c7e-5599-470a-bafa-497807bda457";
export const instantWorkspaceId = "9c6751f2-b0ed-45d0-9c7b-d3914bddcc1a";

export const syncCryptoConfig = {
  legacyVersion: 1,
  version: 2,
  payloadVersion: 1,
  pbkdf2Iterations: 600_000,
  pbkdf2Salt: "sw-project-ledger:80a03c7e-5599-470a-bafa-497807bda457:v1",
  hkdfSalt: "sw-project-ledger:encrypted-cloud-sync:v1",
} as const;
