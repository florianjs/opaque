<script setup lang="ts">
import { ref, onMounted } from "vue";

const props = defineProps<{
  token: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

interface Project {
  id: string;
  name: string;
  createdAt: string;
}

const projects = ref<Project[]>([]);
const loading = ref(false);
const error = ref("");
const newProjectId = ref("");
const newProjectName = ref("");
const adding = ref(false);

const VAULT_URL = import.meta.env.VITE_VAULT_URL ?? "";

async function loadProjects(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    const res = await fetch(`${VAULT_URL}/v1/admin/projects`, {
      headers: { authorization: `Bearer ${props.token}` },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    projects.value = (await res.json()) as Project[];
  } catch (err) {
    error.value = `Failed to load projects: ${(err as Error).message}`;
  } finally {
    loading.value = false;
  }
}

async function deleteProject(id: string): Promise<void> {
  if (!confirm(`Delete project "${id}"? This will remove all its secrets.`)) return;
  const res = await fetch(`${VAULT_URL}/v1/admin/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${props.token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    error.value = `Failed to delete: ${body}`;
    return;
  }
  await loadProjects();
}

async function addProject(): Promise<void> {
  const id = newProjectId.value.trim();
  if (!id) return;
  adding.value = true;
  error.value = "";

  // Generate a placeholder public key via WebCrypto
  // In real usage, caller uses CLI register command
  try {
    const res = await fetch(`${VAULT_URL}/v1/admin/projects`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${props.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id,
        name: newProjectName.value.trim() || id,
        // Placeholder — real key registration done via `opaque register`
        publicKey: "0".repeat(64),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      error.value = `Failed to create: ${body}`;
      return;
    }
    newProjectId.value = "";
    newProjectName.value = "";
    await loadProjects();
  } finally {
    adding.value = false;
  }
}

function formatDate(d: string): string {
  return new Date(d).toISOString().slice(0, 10);
}

onMounted(() => loadProjects());
</script>

<template>
  <div class="page">
    <div class="page-header">
      <span class="page-title">Projects</span>
      <button class="btn-reload" @click="loadProjects">↺</button>
    </div>

    <div v-if="error" class="error-bar">{{ error }}</div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>NAME</th>
            <th>CREATED</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="4" class="loading-cell">Loading…</td>
          </tr>
          <tr v-else-if="projects.length === 0">
            <td colspan="4" class="empty-cell">No projects yet.</td>
          </tr>
          <tr v-for="p in projects" :key="p.id" class="row" @click="emit('select', p.id)">
            <td class="mono">{{ p.id }}</td>
            <td>{{ p.name }}</td>
            <td class="meta">{{ formatDate(p.createdAt) }}</td>
            <td class="action">
              <button @click.stop="deleteProject(p.id)">×</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Inline add form -->
      <div class="add-row">
        <input
          v-model="newProjectId"
          placeholder="project-id"
          class="add-input mono"
          @keyup.enter="addProject"
        />
        <input
          v-model="newProjectName"
          placeholder="display name (optional)"
          class="add-input"
          @keyup.enter="addProject"
        />
        <button class="add-btn" :disabled="adding" @click="addProject">+</button>
      </div>
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

.page-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 8px;
  border-bottom: 1px solid #1f1f1f;
}

.page-title {
  font-size: 12px;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.06em;
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
  cursor: pointer;
  transition: background 100ms;
}
.row:hover {
  background: #141414;
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
.loading-cell,
.empty-cell {
  color: #555;
  text-align: center;
  padding: 24px;
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
