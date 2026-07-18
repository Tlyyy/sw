import { i } from "@instantdb/core";

const schema = i.schema({
  entities: {
    workspaces: i.entity({
      capability: i.string(),
      cryptoVersion: i.number(),
      payloadVersion: i.number(),
      revision: i.number(),
      iv: i.string(),
      ciphertext: i.string(),
      mutationId: i.string(),
      writerId: i.string(),
      updatedAt: i.number(),
    }),
  },
  links: {},
  rooms: {},
});

export type AppSchema = typeof schema;
export default schema;
