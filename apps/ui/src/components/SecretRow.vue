<script setup lang="ts">
defineProps<{
  secret: {
    id: string;
    key: string;
    env: string;
    updatedAt: string;
  };
}>();

defineEmits<{
  delete: [id: string];
}>();

function short(env: string): string {
  const map: Record<string, string> = {
    production: "prod",
    preview: "prev",
    development: "dev",
  };
  return map[env] ?? env.slice(0, 4);
}

function formatDate(d: string): string {
  return new Date(d).toISOString().slice(0, 10);
}
</script>

<template>
  <tr class="secret-row">
    <td class="key">{{ secret.key }}</td>
    <td>
      <span :class="['env-badge', secret.env === 'production' ? 'production' : '']">
        {{ short(secret.env) }}
      </span>
    </td>
    <td class="meta">{{ formatDate(secret.updatedAt) }}</td>
    <td class="action">
      <button @click="$emit('delete', secret.id)">×</button>
    </td>
  </tr>
</template>

<style scoped>
.secret-row {
  border-bottom: 1px solid #1f1f1f;
}
.secret-row:hover {
  background: #141414;
}
td {
  padding: 6px 12px;
  font-size: 12px;
  color: #e8e8e8;
}
.key {
  font-family: monospace;
}
.meta {
  color: #555;
  font-size: 11px;
}
.env-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid #2a2a2a;
  color: #666;
  background: #161616;
}
.env-badge.production {
  color: #a78bfa;
  border-color: #3b1f6e;
  background: #1a0f2e;
}
.action button {
  background: none;
  border: none;
  color: #3a3a3a;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  transition: color 100ms;
}
.action button:hover {
  color: #dc2626;
}
</style>
