<script setup lang="ts">
// Dialog shell: dims the page, closes on Escape or a click outside, and returns focus when done.
defineProps<{ title: string; subtitle?: string }>();
const emit = defineEmits<{ close: [] }>();
const box = ref<HTMLElement | null>(null);
let previous: Element | null = null;

const onKey = (e: KeyboardEvent) => e.key === "Escape" && emit("close");

onMounted(() => {
  previous = document.activeElement;
  document.addEventListener("keydown", onKey);
  nextTick(() => box.value?.querySelector<HTMLElement>("[autofocus], input, button[aria-pressed='true'], button")?.focus());
});
onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKey);
  (previous as HTMLElement | null)?.focus?.();
});
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <div ref="box" class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">{{ title }}</h2>
      <p v-if="subtitle" class="sub">{{ subtitle }}</p>
      <slot />
    </div>
  </div>
</template>
