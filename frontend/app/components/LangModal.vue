<script setup lang="ts">
const { t, languages, lang, setLang } = useSite();
const { close } = useModal();
const { show } = useToast();
const busy = ref<string | null>(null);

async function choose(code: string) {
  if (code === lang.value) return close();
  busy.value = code;
  try {
    await setLang(code);
    close();
  } catch {
    const l = languages.value.find((x) => x.code === code);
    show(t("toastLangFail", { lang: l?.englishName ?? code }));
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <BaseModal :title="t('chooseLang')" subtitle="Choose your language · अपनी भाषा चुनें" @close="close">
    <div class="lang-grid">
      <button
        v-for="l in languages"
        :key="l.code"
        class="lang-opt"
        :aria-pressed="l.code === lang"
        :disabled="busy !== null"
        @click="choose(l.code)"
      >
        <b>{{ l.nativeName }}</b>
        <small>{{ l.englishName }}</small>
      </button>
    </div>
  </BaseModal>
</template>
