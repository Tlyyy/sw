import { describe, expect, it } from "vitest";
import { createZipArchive } from "./zipArchive";

describe("zip archive", () => {
  it("stores multiple UTF-8 named files in a valid ZIP container", async () => {
    const archive = await createZipArchive([
      { name: "01-FC-祸斗.png", blob: new Blob(["first"], { type: "image/png" }) },
      { name: "02-LG1-雷司.png", blob: new Blob(["second"], { type: "image/png" }) },
    ], new Date("2026-07-20T12:00:00+08:00"));

    const bytes = new Uint8Array(await archive.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    const view = new DataView(bytes.buffer);
    expect(archive.type).toBe("application/zip");
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(bytes.length - 12, true)).toBe(2);
    expect(text).toContain("01-FC-祸斗.png");
    expect(text).toContain("02-LG1-雷司.png");
  });
});
