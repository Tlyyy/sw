import { ref } from "vue";
import { defineStore } from "pinia";

export const useWorkspaceDraftStore = defineStore("workspace-draft", () => {
  const recommendationQuery = ref("");
  const speciesQuery = ref("");
  const publishQuery = ref("");
  const publishAccount = ref("ALL");
  const publishSelectedOnly = ref(false);
  const publishStatus = ref("");
  const nextPassword = ref("");
  const confirmPassword = ref("");
  const backupNotice = ref("");
  const passwordNotice = ref("");

  return {
    recommendationQuery,
    speciesQuery,
    publishQuery,
    publishAccount,
    publishSelectedOnly,
    publishStatus,
    nextPassword,
    confirmPassword,
    backupNotice,
    passwordNotice,
  };
});
