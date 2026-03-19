<script setup lang="ts">
import { ref, onMounted, watch } from "vue";

const props = defineProps<{
  token: string;
  projectId: string;
}>();

interface AuditEntry {
  id: string;
  projectId: string;
  action: string;
  env: string | null;
  requestedAt: string;
  ip: string | null;
}

const entries = ref<AuditEntry[]>([]);
const loading = ref(false);
const error = ref("");
const filterProject = ref(props.projectId);

const VAULT_URL = import.meta.env.VITE_VAULT_URL ?? "";

async function loadAudit(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    const params = new URLSearchParams({ limit: "100" });
    if (filterProject.value) params.set("projectId", filterProject.value);

    const res = await fetch(`${VAULT_URL}/v1/admin/audit?${params}`, {
      headers: { authorization: `Bearer ${props.token}` },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    entries.value = (await res.json()) as AuditEntry[];
  } catch (err) {
    error.value = `Failed to load audit log: ${(err as Error).message}`;
  } finally {
    loading.value = false;
  }
}

function formatDate(d: string): string {
  return new Date(d).toISOString().replace("T", " ").slice(0, 19);
}

watch(
  () => props.projectId,
  (id) => {
    filterProject.value = id;
    void loadAudit();
  },
);

onMounted(() => loadAudit());
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <span class="page-title">Audit log</span>
      <input
        v-model="filterProject"
        placeholder="filter by project"
        class="filter-input mono"
        @keyup.enter="loadAudit"
      />
      <button class="btn-reload" @click="loadAudit">↺</button>
    </div>

    <div v-if="error" class="error-bar">{{ error }}</div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>TIMESTAMP</th>
            <th>PROJECT</th>
            <th>ACTION</th>
            <th>ENV</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="5" class="state-cell">Loading…</td>
          </tr>
          <tr v-else-if="entries.length === 0">
            <td colspan="5" class="state-cell">No audit entries.</td>
          </tr>
          <tr v-for="e in entries" :key="e.id" class="row">
            <td class="mono meta">{{ formatDate(e.requestedAt) }}</td>
            <td class="mono">{{ e.projectId }}</td>
            <td class="action-cell">{{ e.action }}</td>
            <td>
              <span v-if="e.env" :class="['env-badge', e.env === 'production' ? 'production' : '']">
                {{ e.env.slice(0, 4) }}
              </span>
              <span v-else class="meta">—</span>
            </td>
            <td class="meta">{{ e.ip ?? "—" }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid #1f1f1f;
}

.page-title {
  font-size: 12px;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
}

.filter-input {
  background: #0a0a0a;
  border: 1px solid #1f1f1f;
  color: #e8e8e8;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 3px;
  font-family: system-ui, sans-serif;
  width: 160px;
}
.filter-input.mono {
  font-family: monospace;
}
.filter-input:focus {
  outline: none;
  border-color: #3b1f6e;
}

.btn-reload {
  background: none;
  border: none;
  color: #555;
  cursor: pointer;
  font-size: 13px;
  padding: 0 4px;
  transition: opacity 100ms;
}
.btn-reload:hover {
  opacity: 0.7;
}

.error-bar {
  background: #1a0505;
  border-bottom: 1px solid #3a0a0a;
  color: #dc2626;
  font-size: 11px;
  padding: 6px 16px;
}

.table-wrap {
  flex: 1;
  overflow-y: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead tr {
  border-bottom: 1px solid #1f1f1f;
}

th {
  padding: 6px 12px;
  font-size: 10px;
  color: #555;
  text-align: left;
  font-weight: 400;
  letter-spacing: 0.06em;
}

.row {
  border-bottom: 1px solid #1a1a1a;
}
.row:hover {
  background: #111111;
}

td {
  padding: 6px 12px;
  font-size: 12px;
  color: #e8e8e8;
}

.mono {
  font-family: monospace;
}
.meta {
  color: #555;
  font-size: 11px;
}

.action-cell {
  font-size: 11px;
  color: #a78bfa;
}

.state-cell {
  padding: 24px;
  text-align: center;
  color: #555;
  font-size: 12px;
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
</style>
