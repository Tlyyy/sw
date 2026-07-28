import {
  defineAsyncComponent,
  defineComponent,
  h,
  type Component,
} from "vue";
import { useAppDeviceMode, type AppDeviceMode } from "./device";

export interface PlatformPageModule {
  default: Component;
}

export type PlatformPageLoader = () => Promise<PlatformPageModule>;

export interface PlatformPageDefinition {
  component: Component;
  preload: (mode: AppDeviceMode) => Promise<PlatformPageModule>;
}

function retryableLoader(loader: PlatformPageLoader): PlatformPageLoader {
  let pending: Promise<PlatformPageModule> | undefined;

  return () => {
    if (!pending) {
      pending = loader().catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
}

export function definePlatformPage(
  name: string,
  loaders: Record<AppDeviceMode, PlatformPageLoader>,
): PlatformPageDefinition {
  const mobileLoader = retryableLoader(loaders.mobile);
  const desktopLoader = retryableLoader(loaders.desktop);
  const MobilePage = defineAsyncComponent(mobileLoader);
  const DesktopPage = defineAsyncComponent(desktopLoader);

  return {
    component: defineComponent({
      name,
      setup() {
        const deviceMode = useAppDeviceMode();
        return () => h(
          deviceMode.value === "mobile" ? MobilePage : DesktopPage,
          { key: deviceMode.value },
        );
      },
    }),
    preload(mode) {
      return mode === "mobile" ? mobileLoader() : desktopLoader();
    },
  };
}

export const recordPlatformPage = definePlatformPage("PlatformRecordPage", {
  mobile: () => import("../platforms/mobile/pages/MobileRecordPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopRecordPage.vue"),
});

export const taskPlatformPage = definePlatformPage("PlatformTaskPage", {
  mobile: () => import("../platforms/mobile/pages/MobileTaskPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopTaskPage.vue"),
});

export const weekPlatformPage = definePlatformPage("PlatformWeekPage", {
  mobile: () => import("../platforms/mobile/pages/MobileWeekPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopWeekPage.vue"),
});

export const resourcesPlatformPage = definePlatformPage("PlatformResourcesPage", {
  mobile: () => import("../platforms/mobile/pages/MobileResourcesPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopResourcesPage.vue"),
});

export const earningsPlatformPage = definePlatformPage("PlatformEarningsPage", {
  mobile: () => import("../platforms/mobile/pages/MobileEarningsPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopEarningsPage.vue"),
});

export const accountPlatformPage = definePlatformPage("PlatformAccountPage", {
  mobile: () => import("../platforms/mobile/pages/MobileAccountPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopAccountPage.vue"),
});

export const petsPlatformPage = definePlatformPage("PlatformPetsPage", {
  mobile: () => import("../platforms/mobile/pages/MobilePetsPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopPetsPage.vue"),
});

export const equipmentPlatformPage = definePlatformPage("PlatformEquipmentPage", {
  mobile: () => import("../platforms/mobile/pages/MobileEquipmentPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopEquipmentPage.vue"),
});

export const skillsPlatformPage = definePlatformPage("PlatformSkillsPage", {
  mobile: () => import("../platforms/mobile/pages/MobileSkillsPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopSkillsPage.vue"),
});

export const evidencePlatformPage = definePlatformPage("PlatformEvidencePage", {
  mobile: () => import("../platforms/mobile/pages/MobileEvidencePage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopEvidencePage.vue"),
});

export const planParametersPlatformPage = definePlatformPage("PlatformPlanParametersPage", {
  mobile: () => import("../platforms/mobile/pages/MobilePlanParametersPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopPlanParametersPage.vue"),
});

export const dataMarketPlatformPage = definePlatformPage("PlatformDataMarketPage", {
  mobile: () => import("../platforms/mobile/pages/MobileDataMarketPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopDataMarketPage.vue"),
});

export const gemPlanPlatformPage = definePlatformPage("PlatformGemPlanPage", {
  mobile: () => import("../platforms/mobile/pages/MobileGemPlanPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopGemPlanPage.vue"),
});

export const beastsPlatformPage = definePlatformPage("PlatformBeastsPage", {
  mobile: () => import("../platforms/mobile/pages/MobileBeastsPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopBeastsPage.vue"),
});

export const timelinePlatformPage = definePlatformPage("PlatformTimelinePage", {
  mobile: () => import("../platforms/mobile/pages/MobileTimelinePage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopTimelinePage.vue"),
});

export const dataInventoryPlatformPage = definePlatformPage("PlatformDataInventoryPage", {
  mobile: () => import("../platforms/mobile/pages/MobileDataInventoryPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopDataInventoryPage.vue"),
});

export const dataSourcesPlatformPage = definePlatformPage("PlatformDataSourcesPage", {
  mobile: () => import("../platforms/mobile/pages/MobileDataSourcesPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopDataSourcesPage.vue"),
});

export const recommendationsPlatformPage = definePlatformPage("PlatformRecommendationsPage", {
  mobile: () => import("../platforms/mobile/pages/MobileRecommendationsPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopRecommendationsPage.vue"),
});

export const speciesPlatformPage = definePlatformPage("PlatformSpeciesPage", {
  mobile: () => import("../platforms/mobile/pages/MobileSpeciesPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopSpeciesPage.vue"),
});

export const matrixPlatformPage = definePlatformPage("PlatformMatrixPage", {
  mobile: () => import("../platforms/mobile/pages/MobileMatrixPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopMatrixPage.vue"),
});

export const publishPlatformPage = definePlatformPage("PlatformPublishPage", {
  mobile: () => import("../platforms/mobile/pages/MobilePublishPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopPublishPage.vue"),
});

export const settingsPlatformPage = definePlatformPage("PlatformSettingsPage", {
  mobile: () => import("../platforms/mobile/pages/MobileSettingsPage.vue"),
  desktop: () => import("../platforms/desktop/pages/DesktopSettingsPage.vue"),
});
