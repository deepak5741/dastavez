<script setup lang="ts">
// Shown for unknown pages and crashes. Interface text may be unavailable here, so English is built in.
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();
const notFound = computed(() => props.error.statusCode === 404);
useHead({ title: notFound.value ? "Page not found" : "Something went wrong" });
</script>

<template>
  <div class="wrap state">
    <h1>{{ notFound ? "Page not found" : "Something went wrong" }}</h1>
    <p>
      {{ notFound
        ? "This page doesn't exist. It may have moved."
        : "We couldn't load this page. Check your internet and try again in a minute." }}
    </p>
    <button class="btn primary" @click="clearError({ redirect: '/' })">Go to all documents</button>
  </div>
</template>
