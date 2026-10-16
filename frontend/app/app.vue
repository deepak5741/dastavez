<script setup lang="ts">
import type { Bootstrap, User, UserState } from "~/utils/types";

const site = useSite();
const auth = useAuth();
const { dark } = useTheme();
const { modal } = useModal();
const toast = useToast();
// On the server this forwards the visitor's cookies (session, language) to our /api routes.
const requestFetch = useRequestFetch();

// Interface text, languages and categories for the chosen language, rendered on the server.
await useAsyncData("bootstrap", async () => {
  const b = await requestFetch<Bootstrap>("/api/bootstrap", { query: { lang: site.lang.value } });
  site.data.value = b;
  site.lang.value = b.lang;
  return true;
});

// Who is signed in, with their saved documents and progress.
await useAsyncData("me", async () => {
  try {
    const [{ user }, state] = await Promise.all([
      requestFetch<{ user: User }>("/api/me"),
      requestFetch<UserState>("/api/me/state"),
    ]);
    auth.user.value = user;
    auth.applyState(state);
  } catch {
    auth.user.value = null; // not signed in
  }
  return true;
});

onMounted(() => auth.loadGuest());

useHead(() => ({
  htmlAttrs: { lang: site.lang.value },
  bodyAttrs: { class: dark.value ? "dark" : "" },
}));
</script>

<template>
  <NuxtLoadingIndicator color="#0B6E66" :height="3" />
  <AppHeader />
  <main>
    <NuxtPage />
  </main>
  <div class="wrap">
    <p class="disclaimer">{{ site.t("disclaimer") }}</p>
  </div>

  <LangModal v-if="modal?.name === 'lang'" />
  <AuthModal v-else-if="modal?.name === 'auth'" :key="modal.mode" :mode="modal.mode" :reason="modal.reason" />
  <AccountModal v-else-if="modal?.name === 'account'" />

  <div aria-live="polite">
    <div v-if="toast.message.value" class="toast" role="status">{{ toast.message.value }}</div>
  </div>
</template>
