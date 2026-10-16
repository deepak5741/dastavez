<script setup lang="ts">
const { t } = useSite();
const { user, saved, logout } = useAuth();
const { close } = useModal();
const { show } = useToast();

async function signOut() {
  await logout();
  close();
  show(t("toastLoggedOut"));
}
</script>

<template>
  <BaseModal
    v-if="user"
    :title="user.name"
    :subtitle="`${user.email} · ${t('savedCount', { n: saved.length })}`"
    @close="close"
  >
    <div class="modal-actions">
      <button class="btn" @click="close">{{ t("close") }}</button>
      <button class="btn primary" @click="signOut">{{ t("logout") }}</button>
    </div>
  </BaseModal>
</template>
