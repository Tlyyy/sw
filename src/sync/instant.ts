import { init } from "@instantdb/core";
import schema from "../../instant.schema";
import { instantAppId } from "../../instant.config";
import { clearMemoryStorage, MemoryStorage } from "./memoryStorage";

function createDatabase() {
  return init({ appId: instantAppId, schema, devtool: false }, MemoryStorage);
}

export type SyncDatabase = ReturnType<typeof createDatabase>;
let database: SyncDatabase | undefined;

export function getSyncDatabase() {
  database ||= createDatabase();
  return database;
}

export function resetSyncDatabase(expected?: SyncDatabase) {
  // Async callers may finish after a newer authenticated session has already
  // replaced the singleton. Never let an old login/rotation shut down the new
  // reactor or clear its in-memory persistence.
  if (expected && database !== expected) return false;
  database?.shutdown();
  database = undefined;
  // A transaction that Instant reports as `enqueued` is still held in the
  // in-memory persistence adapter. Clear it before recreating the reactor so
  // an uncertain, stale optimistic write cannot be replayed after reconnect.
  clearMemoryStorage(instantAppId);
  return true;
}
