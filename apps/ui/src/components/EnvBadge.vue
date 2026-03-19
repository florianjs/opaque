<script setup lang="ts">
const props = defineProps<{
  env: string;
}>();

function short(env: string): string {
  const map: Record<string, string> = {
    production: "prod",
    preview: "prev",
    development: "dev",
  };
  return map[env] ?? env.slice(0, 4);
}

const isProduction = props.env === "production";
</script>

<template>
  <span :class="['env-badge', isProduction ? 'production' : '']">
    {{ short(env) }}
  </span>
</template>

<style scoped>
.env-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid #2a2a2a;
  color: #666;
  background: #161616;
  display: inline-block;
}
.env-badge.production {
  color: #a78bfa;
  border-color: #3b1f6e;
  background: #1a0f2e;
}
</style>
