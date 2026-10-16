<script setup lang="ts">
import type { DocumentSummary } from "~/utils/types";

defineProps<{ doc: DocumentSummary }>();
const { t } = useSite();
const { saved, stepsDone } = useAuth();
</script>

<template>
  <NuxtLink class="card" :to="`/documents/${doc.id}`">
    <div class="card-top">
      <span class="icon"><AppIcon :name="doc.icon" /></span>
      <span class="cat-pill">{{ doc.categoryLabel }}</span>
    </div>
    <h3>
      {{ doc.name }}
      <span v-if="saved.includes(doc.id)" class="saved-dot" :title="t('saved')">●</span>
    </h3>
    <div class="hi">{{ doc.subtitle }}</div>
    <div class="meta">
      <span>{{ t("fee") }} <b>{{ doc.fee }}</b></span>
      <span>{{ t("time") }} <b>{{ doc.time }}</b></span>
      <ClientOnly>
        <span v-if="stepsDone(doc.id).length">
          {{ t("progress") }} <b>{{ stepsDone(doc.id).length }}/{{ doc.stepCount }}</b>
        </span>
      </ClientOnly>
    </div>
  </NuxtLink>
</template>
