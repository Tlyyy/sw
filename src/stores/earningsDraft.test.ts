import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useEarningsDraftStore } from "./earningsDraft";

describe("earnings draft store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("starts from the route account and keeps view choices across platform remounts", () => {
    const draft = useEarningsDraftStore();
    draft.initialize("LG2", "PT");
    draft.dailyTableMetric = "silverWan";
    draft.detailView = "intervals";

    const remounted = useEarningsDraftStore();
    remounted.initialize("FC", "PT");

    expect(remounted.selectedScope).toBe("PT");
    expect(remounted.selectedAccount).toBe("PT");
    expect(remounted.dailyTableMetric).toBe("silverWan");
    expect(remounted.detailView).toBe("intervals");
  });

  it("uses the recent account for all-account mode and follows route changes", () => {
    const draft = useEarningsDraftStore();
    draft.initialize("MYT", null);
    expect(draft.selectedScope).toBe("all");
    expect(draft.selectedAccount).toBe("MYT");

    draft.applyRouteAccount("LG1");
    expect(draft.selectedScope).toBe("LG1");
    expect(draft.selectedAccount).toBe("LG1");

    draft.applyRouteAccount(null);
    expect(draft.selectedScope).toBe("all");
    expect(draft.selectedAccount).toBe("LG1");
  });
});
