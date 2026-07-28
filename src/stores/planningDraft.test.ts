import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { usePlanningDraftStore } from "./planningDraft";

const source = {
  startDate: "2026-07-01",
  weeklyDedicatedEggs: 2,
  weeklyRegularEggs: 2,
  weeklySilverWan: 50,
  thisWeekInnerShards: 0,
  weeklyInnerShards: 25,
  eggPriceWan: 5.5,
};

describe("planning draft store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("keeps parameter, task-price and market inputs across platform remounts", () => {
    const draft = usePlanningDraftStore();
    draft.initialize(source);
    draft.numeric.weeklySilverWan = "72.";
    draft.taskPriceDrafts["FC:task"] = "18.";
    draft.marketPriceDrafts["太阳石"] = "801";

    const remounted = usePlanningDraftStore();
    remounted.initialize({ ...source, weeklySilverWan: 99 });

    expect(remounted.numeric.weeklySilverWan).toBe("72.");
    expect(remounted.taskPriceValue("FC:task", 20)).toBe("18.");
    expect(remounted.marketPriceDrafts["太阳石"]).toBe("801");
  });
});
