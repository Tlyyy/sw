import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAppDeviceMode, type AppDeviceMode } from "../../app/device";
import { recordPlatformPage } from "../../app/platformPages";

export function preloadRecordPage(mode: AppDeviceMode) {
  return recordPlatformPage.preload(mode);
}

export function useRecordEntry() {
  const router = useRouter();
  const deviceMode = useAppDeviceMode();
  const recordOpening = ref(false);

  function warmRecordEntry() {
    void preloadRecordPage(deviceMode.value).catch(() => undefined);
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
      await preloadRecordPage(deviceMode.value);
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
