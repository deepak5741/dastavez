<script setup lang="ts">
import type { DocumentDetail } from "~/utils/types";

const route = useRoute();
const { t, lang } = useSite();
const { user, saved, stepsDone, toggleStep, toggleSaved, visitDocument } = useAuth();
const { open } = useModal();
const { show } = useToast();

const id = computed(() => String(route.params.id));
const { data, error } = await useFetch<{ document: DocumentDetail }>(() => `/api/documents/${id.value}`, {
  query: computed(() => ({ lang: lang.value })),
  key: `document-${id.value}`,
});
const doc = computed(() => data.value?.document ?? null);

if (import.meta.server && error.value) {
  setResponseStatus(useRequestEvent()!, error.value.statusCode === 404 ? 404 : 502);
}

// Remember this guide for "Continue where you left off" (only guides that exist).
onMounted(() => doc.value && visitDocument(id.value));
watch(id, (v) => doc.value && visitDocument(v));

const done = computed(() => stepsDone(id.value));
const isSaved = computed(() => saved.value.includes(id.value));
const percent = computed(() => (doc.value ? (done.value.length / doc.value.steps.length) * 100 : 0));

async function onToggleStep(i: number) {
  if (!doc.value) return;
  const nowDone = await toggleStep(id.value, i);
  if (nowDone && done.value.length === doc.value.steps.length) show(t("toastAllDone", { name: doc.value.name }));
}

async function onSave() {
  if (!user.value) return open({ name: "auth", mode: "signup", reason: t("saveReason") });
  try {
    show((await toggleSaved(id.value)) ? t("toastSaved") : t("toastRemoved"));
  } catch {
    show(t("errGeneric"));
  }
}

useHead(() => ({
  title: doc.value?.name ?? t("notFoundTitle"),
  meta: doc.value
    ? [{ name: "description", content: `${doc.value.name}: ${doc.value.eligibility} ${t("fee")}: ${doc.value.fee}.` }]
    : [],
}));
</script>

<template>
  <section class="wrap">
    <div v-if="!doc" class="state">
      <h1>{{ error?.statusCode === 404 ? t("notFoundTitle") : t("errGeneric") }}</h1>
      <p v-if="error?.statusCode === 404">{{ t("notFoundBody") }}</p>
      <NuxtLink class="btn primary" to="/">{{ t("goHome") }}</NuxtLink>
    </div>

    <template v-else>
      <NuxtLink class="btn back" to="/">{{ t("back") }}</NuxtLink>
      <div class="detail-head">
        <div style="min-width: 0">
          <h1>{{ doc.name }}</h1>
          <div class="hi">{{ doc.subtitle }}</div>
          <div class="issuer">{{ t("issuedBy", { x: doc.issuer }) }}</div>
        </div>
        <div class="head-actions">
          <button class="btn" :aria-pressed="isSaved" @click="onSave">{{ isSaved ? t("savedBtn") : t("save") }}</button>
          <a class="btn primary" :href="doc.portalUrl" target="_blank" rel="noopener">{{ t("official") }}</a>
        </div>
      </div>

      <div class="facts">
        <div class="fact"><div class="k">{{ t("fee") }}</div><div class="v">{{ doc.fee }}</div></div>
        <div class="fact"><div class="k">{{ t("timeToGet") }}</div><div class="v">{{ doc.time }}</div></div>
        <div class="fact"><div class="k">{{ t("how") }}</div><div class="v">{{ doc.mode }}</div></div>
        <div class="fact"><div class="k">{{ t("steps") }}</div><div class="v">{{ doc.steps.length }}</div></div>
      </div>

      <div class="layout">
        <div class="panel">
          <div class="progress-row">
            <h2>{{ t("process") }}</h2>
            <div>
              <div class="progress-txt">{{ t("nOfM", { n: done.length, m: doc.steps.length }) }}</div>
              <div class="bar"><i :style="{ width: `${percent}%` }" /></div>
            </div>
          </div>
          <ol class="steps">
            <li v-for="(s, i) in doc.steps" :key="i" class="step" :class="{ done: done.includes(i) }">
              <button class="num" :aria-label="t('markStep', { n: i + 1 })" @click="onToggleStep(i)">
                <AppIcon v-if="done.includes(i)" name="check" :size="18" :stroke="2.4" />
                <template v-else>{{ i + 1 }}</template>
              </button>
              <div>
                <h3>{{ s.title }}</h3>
                <p>{{ s.body }}</p>
                <template v-if="s.linkUrl">
                  <a class="where" :href="s.linkUrl" target="_blank" rel="noopener">{{ s.linkLabel }} ↗</a><br>
                </template>
                <button class="mark" @click="onToggleStep(i)">{{ done.includes(i) ? t("undo") : t("markDone") }}</button>
              </div>
            </li>
          </ol>
          <p class="note">{{ user ? t("noteUser") : t("noteGuest") }}</p>
        </div>

        <aside class="side">
          <div class="panel">
            <h2>{{ t("whoCan") }}</h2>
            <p class="elig">{{ doc.eligibility }}</p>
          </div>
          <div class="panel">
            <h2>{{ t("docsReady") }}</h2>
            <ul class="check">
              <li v-for="(x, i) in doc.requiredDocs" :key="i"><AppIcon name="check" :size="18" :stroke="2.4" /><span>{{ x }}</span></li>
            </ul>
          </div>
          <div class="panel">
            <h2>{{ t("watch") }}</h2>
            <div class="yt-list">
              <a v-for="v in doc.videos" :key="v.url" class="yt" :href="v.url" target="_blank" rel="noopener">
                <span class="thumb">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                </span>
                <span><b>{{ v.title }}</b><small>{{ t("ytSub") }}</small></span>
              </a>
            </div>
            <p class="note">{{ t("ytNote") }}</p>
          </div>
          <div class="panel portal">
            <h2>{{ t("officialHelp") }}</h2>
            <a class="btn primary" :href="doc.portalUrl" target="_blank" rel="noopener">{{ doc.portalLabel }} ↗</a>
            <div v-if="doc.helpline" class="help"><span>{{ t("helpline") }}</span><code>{{ doc.helpline }}</code></div>
          </div>
          <div v-if="doc.tips.length" class="panel">
            <h2>{{ t("goodToKnow") }}</h2>
            <ul class="tips"><li v-for="(x, i) in doc.tips" :key="i">{{ x }}</li></ul>
          </div>
        </aside>
      </div>
    </template>
  </section>
</template>
