<script setup lang="ts">
// One horizontal row that slides. Arrow buttons appear only when there is more to see in that direction.
defineProps<{ label?: string }>();
const track = ref<HTMLElement | null>(null);
const canPrev = ref(false);
const canNext = ref(false);

function update() {
  const el = track.value;
  if (!el) return;
  canPrev.value = el.scrollLeft > 2;
  canNext.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
}

function slide(dir: 1 | -1) {
  const el = track.value;
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
}

let observer: ResizeObserver | undefined;
onMounted(() => {
  update();
  observer = new ResizeObserver(update);
  if (track.value) {
    observer.observe(track.value);
    // Re-check when the chips change (e.g. after switching language).
    new MutationObserver(update).observe(track.value, { childList: true, subtree: true, characterData: true });
  }
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div class="scroll-row">
    <span v-if="label" class="scroll-label">{{ label }}</span>
    <!-- Each arrow sits over a fully faded edge, so it never covers a chip and the row stays flush left. -->
    <div class="scroll-viewport" :class="{ 'fade-l': canPrev, 'fade-r': canNext }">
      <button v-show="canPrev" class="scroll-arrow prev" type="button" aria-label="Previous" tabindex="-1" @click="slide(-1)">
        ‹
      </button>
      <div ref="track" class="scroll-track" @scroll.passive="update">
        <slot />
      </div>
      <button v-show="canNext" class="scroll-arrow next" type="button" aria-label="Next" tabindex="-1" @click="slide(1)">
        ›
      </button>
    </div>
  </div>
</template>
