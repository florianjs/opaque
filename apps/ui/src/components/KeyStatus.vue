<script setup lang="ts">
defineProps<{
  active: boolean;
}>();
</script>

<template>
  <span :class="['key-status', active ? 'active' : 'inactive']">●</span>
</template>

<style scoped>
.key-status {
  font-size: 10px;
}
.key-status.active {
  color: #16a34a;
}
.key-status.inactive {
  color: #3a3a3a;
}
</style>
