import { onBeforeUnmount, onMounted, ref } from "vue";

export function useVisualViewport(prefix: string) {
  const visualViewportStyle = ref<Record<string, string>>({});
  const keyboardOpen = ref(false);
  let baselineHeight = 0;
  let viewport: VisualViewport | null = null;

  function syncVisualViewport() {
    const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
    const width = Math.max(1, Math.round(viewport?.width ?? window.innerWidth));
    const offsetTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
    const offsetLeft = Math.max(0, Math.round(viewport?.offsetLeft ?? 0));
    const scale = Math.max(1, viewport?.scale ?? 1);
    baselineHeight = Math.max(baselineHeight, height);
    keyboardOpen.value = height < baselineHeight - 120;
    visualViewportStyle.value = {
      [`--${prefix}-height`]: `${height}px`,
      [`--${prefix}-width`]: `${width}px`,
      [`--${prefix}-top`]: `${offsetTop}px`,
      [`--${prefix}-left`]: `${offsetLeft}px`,
      [`--${prefix}-scale`]: String(scale),
    };
  }

  function resetForOrientationChange() {
    baselineHeight = 0;
    window.requestAnimationFrame(syncVisualViewport);
  }

  onMounted(() => {
    viewport = window.visualViewport;
    syncVisualViewport();
    viewport?.addEventListener("resize", syncVisualViewport);
    viewport?.addEventListener("scroll", syncVisualViewport);
    window.addEventListener("orientationchange", resetForOrientationChange);
  });

  onBeforeUnmount(() => {
    viewport?.removeEventListener("resize", syncVisualViewport);
    viewport?.removeEventListener("scroll", syncVisualViewport);
    window.removeEventListener("orientationchange", resetForOrientationChange);
  });

  return {
    keyboardOpen,
    visualViewportStyle,
  };
}
