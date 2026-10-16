<script setup lang="ts">
// Line icons for documents and controls. Unknown names fall back to a generic document.
const props = withDefaults(defineProps<{ name: string; size?: number; stroke?: number }>(), { size: 22, stroke: 1.8 });

const paths: Record<string, string> = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
  car: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v2H3z"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/>',
  finger: '<path d="M8 20c-1.5-2-2-4-2-7a6 6 0 0 1 12 0"/><path d="M12 13v3c0 2 .5 3 1.5 4.5"/><path d="M9 13a3 3 0 0 1 6 0c0 3 .5 5 2 7"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M6 16h5M14 10h4M14 13h4"/>',
  vote: '<path d="M4 20h16M6 20V10h12v10"/><path d="M9 6l2 2 4-4"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
  baby: '<circle cx="12" cy="8" r="4"/><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  rupee: '<path d="M7 4h10M7 8h10M7 4c5 0 7 2 7 4s-2 4-7 4l7 8"/>',
  rings: '<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M10 5l2-2 2 2"/>',
  health: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M9.5 11h5M12 8.5v5"/>',
  worker: '<path d="M5 12a7 7 0 0 1 14 0z"/><path d="M4 12h16M12 5v3"/><path d="M8 16v4M16 16v4M8 18h8"/>',
  lang: '<path d="M4 5h9M8.5 3v2M6 5c.5 3 2.5 5.5 5 7M11 5c-.8 3.5-3 6.5-6.5 8"/><path d="M13 21l4-9 4 9M14.5 18h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};

const body = computed(() => paths[props.name] ?? paths.doc);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="body"
  />
</template>
