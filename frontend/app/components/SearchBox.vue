<script setup lang="ts">
import type { DocumentSummary } from "~/utils/types";

// Search field with live suggestions from the API. v-model is the search text.
const query = defineModel<string>({ default: "" });
const emit = defineEmits<{ submit: [] }>();
const { t, lang } = useSite();
const router = useRouter();

const open = ref(false);
const active = ref(-1);
const suggestions = ref<DocumentSummary[]>([]);
const root = ref<HTMLElement | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

watch(query, (q) => {
  active.value = -1;
  clearTimeout(timer);
  if (!q.trim()) {
    suggestions.value = [];
    return;
  }
  timer = setTimeout(async () => {
    const mine = ++seq;
    const res = await $fetch<{ items: DocumentSummary[] }>("/api/documents", { query: { lang: lang.value, q } })
      .catch(() => ({ items: [] }));
    if (mine === seq) suggestions.value = res.items.slice(0, 6); // ignore out-of-order replies
  }, 180);
});

function go(id: string) {
  open.value = false;
  router.push(`/documents/${id}`);
}

function onKey(e: KeyboardEvent) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    open.value = true;
    active.value = Math.min(suggestions.value.length - 1, active.value + 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    active.value = Math.max(-1, active.value - 1);
  } else if (e.key === "Enter") {
    e.preventDefault();
    const pick = suggestions.value[active.value] ?? (suggestions.value.length === 1 ? suggestions.value[0] : null);
    if (pick) go(pick.id);
    else {
      open.value = false;
      emit("submit");
    }
  } else if (e.key === "Escape") {
    open.value = false;
  }
}

function outside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener("click", outside));
onBeforeUnmount(() => document.removeEventListener("click", outside));
</script>

<template>
  <div ref="root" class="search" role="search">
    <div class="search-box">
      <AppIcon name="search" :stroke="2" />
      <input
        id="q"
        v-model="query"
        type="search"
        :aria-label="t('searchLabel')"
        autocomplete="off"
        :placeholder="t('placeholder')"
        aria-autocomplete="list"
        aria-controls="suggest"
        @focus="open = true"
        @input="open = true"
        @keydown="onKey"
      >
      <button class="go" type="button" @click="open = false; emit('submit')">{{ t("search") }}</button>
    </div>
    <div v-if="open && query.trim()" id="suggest" class="suggest" role="listbox">
      <template v-if="suggestions.length">
        <button
          v-for="(d, i) in suggestions"
          :key="d.id"
          role="option"
          :class="{ active: i === active }"
          :aria-selected="i === active"
          @click="go(d.id)"
        >
          <span><span class="s-name">{{ d.name }}</span> <span class="s-hi">{{ d.subtitle }}</span></span>
          <span class="s-cat">{{ d.categoryLabel }}</span>
        </button>
      </template>
      <div v-else class="empty">{{ t("noMatch", { q: query }) }}</div>
    </div>
  </div>
</template>
