<script setup lang="ts">
import type { DocumentSummary } from "~/utils/types";

// "Continue where you left off": the guide opened last, with its progress. Hidden when there is none.
const { t, lang } = useSite();
const { lastDocument, stepsDone } = useAuth();

const doc = ref<DocumentSummary | null>(null);

watch(
  [lastDocument, lang],
  async ([id]) => {
    if (!id) return (doc.value = null);
    const res = await $fetch<{ items: DocumentSummary[] }>("/api/documents", { query: { lang: lang.value, ids: id } })
      .catch(() => ({ items: [] }));
    doc.value = res.items[0] ?? null;
  },
  { immediate: true },
);

const done = computed(() => (doc.value ? stepsDone(doc.value.id).length : 0));
</script>

<template>
  <NuxtLink v-if="doc" class="continue" :to="`/documents/${doc.id}`">
    <span class="icon"><AppIcon :name="doc.icon" /></span>
    <span class="continue-text">
      <small>{{ t("continueTitle") }}</small>
      <b>{{ doc.name }}</b>
      <span class="continue-progress">
        {{ t("nOfM", { n: done, m: doc.stepCount }) }}
        <span class="bar"><i :style="{ width: `${(done / doc.stepCount) * 100}%` }" /></span>
      </span>
    </span>
    <span class="btn primary continue-btn">{{ t("continueBtn") }} →</span>
  </NuxtLink>
</template>
