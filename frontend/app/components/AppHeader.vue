<script setup lang="ts">
const { t, current } = useSite();
const { user, saved } = useAuth();
const { dark, toggle } = useTheme();
const { open } = useModal();
</script>

<template>
  <header class="top">
    <div class="wrap">
      <NuxtLink class="brand" to="/">
        <span class="brand-mark" aria-hidden="true">द</span>
        <span><b>Dastavez</b><small>{{ t("brandSub") }}</small></span>
      </NuxtLink>
      <div class="top-actions">
        <button class="btn lang-btn" :aria-label="t('chooseLang')" :title="t('chooseLang')" @click="open({ name: 'lang' })">
          <AppIcon name="lang" :size="17" />
          <span>{{ current?.nativeName }}</span>
        </button>
        <button
          class="btn theme-btn"
          :aria-label="dark ? t('toLight') : t('toDark')"
          :title="dark ? t('toLight') : t('toDark')"
          @click="toggle"
        >
          <AppIcon :name="dark ? 'sun' : 'moon'" :size="18" :stroke="2" />
        </button>
        <template v-if="user">
          <NuxtLink class="btn" to="/?cat=saved" :title="t('saved')">
            <AppIcon name="doc" :size="16" />
            <span class="lbl">{{ t("saved") }} ({{ saved.length }})</span>
          </NuxtLink>
          <button class="btn" :title="t('account')" @click="open({ name: 'account' })">
            <span class="avatar">{{ user.name[0]?.toUpperCase() }}</span>
            <span class="lbl">{{ user.name.split(" ")[0] }}</span>
          </button>
        </template>
        <template v-else>
          <button id="login-btn" class="btn" @click="open({ name: 'auth', mode: 'login' })">{{ t("login") }}</button>
          <button class="btn primary" @click="open({ name: 'auth', mode: 'signup' })">{{ t("signup") }}</button>
        </template>
      </div>
    </div>
  </header>
</template>
