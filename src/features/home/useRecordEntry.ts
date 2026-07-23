import { ref } from "vue";
import { useRouter } from "vue-router";

type RecordPageModule = typeof import("../mobile/RecordPage.vue");

let recordPagePromise: Promise<RecordPageModule> | undefined;

export function preloadRecordPage() {
  if (!recordPagePromise) {
    recordPagePromise = import("../mobile/RecordPage.vue").catch((error: unknown) => {
      recordPagePromise = undefined;
      throw error;
    });
  }
  return recordPagePromise;
}

export function useRecordEntry() {
  const router = useRouter();
  const recordOpening = ref(false);

  function warmRecordEntry() {
    void preloadRecordPage().catch(() => undefined);
  }

  async function handleRecordEntryClick(event: MouseEvent) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (recordOpening.value) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const link = event.currentTarget as HTMLAnchorElement | null;
    const target = link?.hash?.startsWith("#") ? link.hash.slice(1) : "/record";
    event.preventDefault();
    recordOpening.value = true;
    try {
      await preloadRecordPage();
      const navigationFailure = await router.push(target);
      if (navigationFailure) recordOpening.value = false;
    } catch {
      recordOpening.value = false;
    }
  }

  return {
    recordOpening,
    warmRecordEntry,
    handleRecordEntryClick,
  };
}
