import { describe, expect, it } from "vitest";
import {
  mobileAppMaxWidth,
  mobileAppMediaQuery,
  resolveAppDeviceMode,
} from "./device";

describe("app device mode", () => {
  it("keeps the application breakpoint in one shared definition", () => {
    expect(mobileAppMaxWidth).toBe(980);
    expect(mobileAppMediaQuery).toBe("(max-width: 980px)");
  });

  it("maps the media-query result to the matching UI tree", () => {
    expect(resolveAppDeviceMode(true)).toBe("mobile");
    expect(resolveAppDeviceMode(false)).toBe("desktop");
  });
});
