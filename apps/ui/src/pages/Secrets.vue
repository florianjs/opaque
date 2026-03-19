<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import SecretRow from "../components/SecretRow.vue";

const props = defineProps<{
  token: string;
  projectId: string;
}>();

interface SecretEntry {
  id: string;
  key: string;
  env: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
}

const projects = ref<Project[]>([]);
const activeProjectId = ref(props.projectId);
const secrets = ref<SecretEntry[]>([]);
const loading = ref(false);
const error = ref("");
const envFilter = ref("");
const newKey = ref("");
const newValue = ref("");
const newEnv = ref("production");
const adding = ref(false);

const VAULT_URL = import.meta.env.VITE_VAULT_URL ?? "";

async function loadProjects(): Promise<void> {
  const res = await fetch(`${VAULT_URL}/v1/admin/projects`, {
    headers: { authorization: `Bearer ${props.token}` },
  });
  if (res.ok) {
    projects.value = (await res.json()) as Project[];
    if (!activeProjectId.value && projects.value.length > 0) {
      activeProjectId.value = projects.value[0].id;
    }
  }
}

async function loadSecrets(): Promise<void> {
  if (!activeProjectId.value) return;
  loading.value = true;
  error.value = "";
  try {
    const envParam = envFilter.value ? `?env=${envFilter.value}` : "";
    const res = await fetch(
      `${VAULT_URL}/v1/admin/projects/${encodeURIComponent(activeProjectId.value)}/secrets${envParam}`,
      { headers: { authorization: `Bearer ${props.token}` } },
    );
    if (!res.ok) throw new Error(`${res.status}`);
    secrets.value = (await res.json()) as SecretEntry[];
  } catch (err) {
    error.value = `Failed to load secrets: ${(err as Error).message}`;
  } finally {
    loading.value = false;
  }
}

async function deleteSecret(id: string): Promise<void> {
  const res = await fetch(`${VAULT_URL}/v1/admin/projects/secrets/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${props.token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    error.value = `Failed to delete: ${body}`;
    return;
  }
  secrets.value = secrets.value.filter((s) => s.id !== id);
}

async function addSecret(): Promise<void> {
  const key = newKey.value.trim();
  if (!key || !newValue.value || !activeProjectId.value) return;
  adding.value = true;
  error.value = "";

  // Admin can create secrets via admin endpoint — but creation requires Ed25519 auth.
  // The dashboard uses the admin endpoint to set secrets for a project.
  // We POST to a special admin write endpoint.
  try {
    const res = await fetch(
      `${VAULT_URL}/v1/admin/projects/${encodeURIComponent(activeProjectId.value)}/secrets`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${props.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ key, value: newValue.value, env: newEnv.value }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      error.value = `Failed to add: ${body}`;
      return;
    }
    newKey.value = "";
    newValue.value = "";
    await loadSecrets();
  } finally {
    adding.value = false;
  }
}

watch(() => activeProjectId.value, loadSecrets);
watch(
  () => props.projectId,
  (id) => {
    if (id) activeProjectId.value = id;
  },
);

onMounted(async () => {
  await loadProjects();
  await loadSecrets();
});
</script>

<template>
  <div class="layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div
        v-for="p in projects"
        :key="p.id"
        :class="['project-item', { active: p.id === activeProjectId }]"
        @click="activeProjectId = p.id"
      >
        {{ p.id }}
      </div>
      <div v-if="projects.length === 0" class="sidebar-empty">No projects</div>
    </aside>

    <!-- Main content -->
    <div class="main">
      <div class="toolbar">
        <span class="project-label">{{ activeProjectId || "Select a project" }}</span>
        <input
          v-model="envFilter"
          placeholder="env filter"
          class="env-filter"
          @change="loadSecrets"
        />
        <button class="btn-reload" @click="loadSecrets">↺</button>
      </div>

      <div v-if="error" class="error-bar">{{ error }}</div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>KEY</th>
              <th>ENV</th>
              <th>UPDATED</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="4" class="state-cell">Loading…</td>
            </tr>
            <tr v-else-if="!activeProjectId">
              <td colspan="4" class="state-cell">Select a project from the sidebar.</td>
            </tr>
            <tr v-else-if="secrets.length === 0">
              <td colspan="4" class="state-cell">No secrets. Add one below.</td>
            </tr>
            <SecretRow v-for="s in secrets" :key="s.id" :secret="s" @delete="deleteSecret" />
          </tbody>
        </table>

        <!-- Inline add form -->
        <div class="add-row">
          <input
            v-model="newKey"
            placeholder="KEY_NAME"
            class="add-input mono"
            @keyup.enter="addSecret"
          />
          <input
            v-model="newValue"
            type="password"
            placeholder="value"
            class="add-input"
            @keyup.enter="addSecret"
          />
          <select v-model="newEnv" class="add-select">
            <option value="production">production</option>
            <option value="preview">preview</option>
            <option value="development">development</option>
          </select>
          <button class="add-btn" :disabled="adding" @click="addSecret">+</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 140px;
  flex-shrink: 0;
  background: #111111;
  border-right: 1px solid #1f1f1f;
  overflow-y: auto;
  padding: 8px 0;
}

.project-item {
  padding: 6px 12px;
  font-size: 12px;
  color: #555;
  cursor: pointer;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 100ms;
}
.project-item:hover {
  color: #e8e8e8;
}
.project-item.active {
  color: #e8e8e8;
  background: #1a1a1a;
}

.sidebar-empty {
  padding: 12px;
  font-size: 11px;
  color: #3a3a3a;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #1f1f1f;
}

.project-label {
  font-size: 12px;
  color: #e8e8e8;
  font-family: monospace;
  flex: 1;
}

.env-filter {
  background: #0a0a0a;
  border: 1px solid #1f1f1f;
  color: #e8e8e8;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 3px;
  font-family: system-ui, sans-serif;
  width: 120px;
}
.env-filter:focus {
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

.state-cell {
  padding: 24px;
  text-align: center;
  color: #555;
  font-size: 12px;
}

.add-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #1f1f1f;
  background: #0d0d0d;
}

.add-input {
  background: #0a0a0a;
  border: 1px solid #1f1f1f;
  color: #e8e8e8;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 3px;
  font-family: system-ui, sans-serif;
  flex: 1;
}
.add-input.mono {
  font-family: monospace;
}
.add-input:focus {
  outline: none;
  border-color: #3b1f6e;
}

.add-select {
  background: #0a0a0a;
  border: 1px solid #1f1f1f;
  color: #e8e8e8;
  font-size: 11px;
  padding: 4px 6px;
  border-radius: 3px;
  font-family: system-ui, sans-serif;
}
.add-select:focus {
  outline: none;
  border-color: #3b1f6e;
}

.add-btn {
  background: none;
  border: 1px solid #1f1f1f;
  color: #555;
  font-size: 16px;
  cursor: pointer;
  padding: 2px 10px;
  border-radius: 3px;
  transition:
    color 100ms,
    border-color 100ms;
}
.add-btn:hover:not(:disabled) {
  color: #e8e8e8;
  border-color: #3b1f6e;
}
.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
