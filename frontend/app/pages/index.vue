<script setup lang="ts">
import type { DocumentSummary } from "~/utils/types";

const route = useRoute();
const router = useRouter();
const { t, lang, categories } = useSite();
const { user, saved } = useAuth();

// Search text and category tab live in the URL (?q=…&cat=…) so results can be shared.
const q = ref(String(route.query.q ?? ""));
const searchQ = ref(q.value);
const cat = computed(() => String(route.query.cat ?? "all"));

let timer: ReturnType<typeof setTimeout> | undefined;
watch(q, (v) => {
  clearTimeout(timer);
  timer = setTimeout(() => (searchQ.value = v), 250);
});

const listQuery = computed(() => ({
  lang: lang.value,
  q: searchQ.value.trim() || undefined,
  category: cat.value !== "all" && cat.value !== "saved" ? cat.value : undefined,
  ids: cat.value === "saved" ? saved.value.join(",") || "-" : undefined,
}));

const { data: list, pending } = await useFetch<{ items: DocumentSummary[] }>("/api/documents", {
  query: listQuery,
  key: "documents",
});
const { data: popular } = await useFetch<{ items: DocumentSummary[] }>("/api/documents", {
  query: computed(() => ({ lang: lang.value, popular: "1" })),
  key: "popular",
});

const tabs = computed(() => [
  { id: "all", label: t("cat_all") },
  ...categories.value,
  ...(user.value ? [{ id: "saved", label: t("cat_saved") }] : []),
]);

const title = computed(() => {
  if (searchQ.value.trim()) return t("resultsFor", { q: searchQ.value.trim() });
  if (cat.value === "all") return t("allDocs");
  if (cat.value === "saved") return t("yourSaved");
  return tabs.value.find((c) => c.id === cat.value)?.label ?? t("allDocs");
});

function setCat(id: string) {
  router.replace({ query: { ...route.query, cat: id === "all" ? undefined : id } });
}

// The Saved tab only exists while signed in.
watch(user, (u) => {
  if (!u && cat.value === "saved") setCat("all");
});

const grid = ref<HTMLElement | null>(null);
function submitSearch() {
  router.replace({ query: { ...route.query, q: q.value.trim() || undefined } });
  searchQ.value = q.value;
  grid.value?.scrollIntoView({ behavior: "smooth" });
}

useHead(() => ({ title: t("allDocs") }));
</script>

<template>
  <div>
    <section class="hero wrap">
      <h1 v-if="user">{{ t("greet", { name: user.name.split(" ")[0] ?? "" }) }} <em>{{ t("greetB") }}</em></h1>
      <h1 v-else>{{ t("heroA") }} <em>{{ t("heroB") }}</em></h1>
      <p class="lead">{{ t("lead") }}</p>
      <SearchBox v-model="q" @submit="submitSearch" />
      <div class="popular">
        <span>{{ t("popular") }}</span>
        <NuxtLink v-for="d in popular?.items ?? []" :key="d.id" class="chip" :to="`/documents/${d.id}`">
          {{ d.name }}
        </NuxtLink>
      </div>
    </section>

    <section class="wrap">
      <div class="section-head">
        <h2 id="grid-title">{{ title }}</h2>
        <div class="tabs" role="tablist">
          <button
            v-for="c in tabs"
            :key="c.id"
            class="tab"
            role="tab"
            :aria-pressed="cat === c.id"
            :aria-selected="cat === c.id"
            @click="setCat(c.id)"
          >
            {{ c.label }}
          </button>
        </div>
      </div>
      <div ref="grid" class="grid" :aria-busy="pending">
        <DocCard v-for="d in list?.items ?? []" :key="d.id" :doc="d" />
        <div v-if="!pending && !(list?.items ?? []).length" class="no-results">
          {{ cat === "saved" ? t("noSaved") : t("noResults") }}
        </div>
      </div>
    </section>
  </div>
</template>
