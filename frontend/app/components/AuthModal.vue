<script setup lang="ts">
const props = defineProps<{ mode: "login" | "signup"; reason?: string }>();
const { t } = useSite();
const { login, signup } = useAuth();
const { close } = useModal();
const { show } = useToast();

const mode = ref(props.mode);
const name = ref("");
const email = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);

watch(mode, () => (error.value = ""));

async function submit() {
  error.value = "";
  if (mode.value === "signup" && !name.value.trim()) return (error.value = t("errName"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return (error.value = t("errEmail"));
  if (mode.value === "signup" && password.value.length < 8) return (error.value = t("errPassword"));
  busy.value = true;
  try {
    if (mode.value === "signup") {
      await signup(name.value.trim(), email.value.trim(), password.value);
      show(t("toastCreated", { name: name.value.trim().split(" ")[0] }));
    } else {
      await login(email.value.trim(), password.value);
      show(t("toastLoggedIn", { name: email.value.trim() }));
    }
    close();
  } catch (err) {
    error.value = t(errorKey(err));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <BaseModal
    :title="mode === 'signup' ? t('createAcct') : t('welcomeBack')"
    :subtitle="[reason, t('authSub')].filter(Boolean).join(' ')"
    @close="close"
  >
    <div class="seg">
      <button type="button" :aria-pressed="mode === 'login'" @click="mode = 'login'">{{ t("login") }}</button>
      <button type="button" :aria-pressed="mode === 'signup'" @click="mode = 'signup'">{{ t("signup") }}</button>
    </div>
    <form novalidate @submit.prevent="submit">
      <div v-if="mode === 'signup'" class="field">
        <label for="a-name">{{ t("yourName") }}</label>
        <input id="a-name" v-model="name" autocomplete="name" placeholder="Priya Sharma" autofocus>
      </div>
      <div class="field">
        <label for="a-email">{{ t("email") }}</label>
        <input id="a-email" v-model="email" type="email" autocomplete="email" placeholder="you@example.com">
      </div>
      <div class="field">
        <label for="a-password">{{ t("password") }}</label>
        <input
          id="a-password"
          v-model="password"
          type="password"
          :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
        >
        <span v-if="mode === 'signup'" class="hint">{{ t("passwordHint") }}</span>
      </div>
      <p class="err" role="alert">{{ error }}</p>
      <div class="modal-actions">
        <button type="button" class="btn" @click="close">{{ t("guest") }}</button>
        <button class="btn primary" type="submit" :disabled="busy">
          {{ mode === "signup" ? t("signup") : t("login") }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
