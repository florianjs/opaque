<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import ProjectsPage from "./pages/Projects.vue";
import SecretsPage from "./pages/Secrets.vue";
import AuditPage from "./pages/Audit.vue";

type Page = "projects" | "secrets" | "audit";

const currentPage = ref<Page>("secrets");
const selectedProjectId = ref<string>("");
const adminToken = ref<string>("");
const tokenInput = ref<string>("");
const tokenSaved = ref(false);

onMounted(() => {
  const stored = localStorage.getItem("opaque_admin_token");
  if (stored) {
    adminToken.value = stored;
    tokenSaved.value = true;
  }
});

function saveToken(): void {
  adminToken.value = tokenInput.value.trim();
  localStorage.setItem("opaque_admin_token", adminToken.value);
  tokenSaved.value = true;
}

function clearToken(): void {
  adminToken.value = "";
  tokenInput.value = "";
  tokenSaved.value = false;
  localStorage.removeItem("opaque_admin_token");
}

function navigate(page: Page): void {
  currentPage.value = page;
}

function selectProject(id: string): void {
  selectedProjectId.value = id;
  currentPage.value = "secrets";
}
</script>

<template>
  <div class="layout">
    <!-- Topbar -->
    <header class="topbar">
      <span class="brand">opaque</span>
      <nav class="nav">
        <button
          :class="['nav-btn', { active: currentPage === 'secrets' }]"
          @click="navigate('secrets')"
        >
          secrets
        </button>
        <button
          :class="['nav-btn', { active: currentPage === 'projects' }]"
          @click="navigate('projects')"
        >
          projects
        </button>
        <button
          :class="['nav-btn', { active: currentPage === 'audit' }]"
          @click="navigate('audit')"
        >
          audit
        </button>
      </nav>
      <div class="token-area">
        <template v-if="!tokenSaved">
          <input
            v-model="tokenInput"
            type="password"
            placeholder="Admin token"
            class="token-input"
            @keyup.enter="saveToken"
          />
          <button class="btn" @click="saveToken">Save</button>
        </template>
        <template v-else>
          <span class="token-dot">● connected</span>
          <button class="btn-ghost" @click="clearToken">×</button>
        </template>
      </div>
    </header>

    <!-- Body -->
    <div class="body">
      <template v-if="!tokenSaved">
        <div class="empty-state">
          <p>Enter your admin token above to connect to the vault.</p>
        </div>
      </template>
      <template v-else>
        <ProjectsPage
          v-if="currentPage === 'projects'"
          :token="adminToken"
          @select="selectProject"
        />
        <SecretsPage
          v-else-if="currentPage === 'secrets'"
          :token="adminToken"
          :project-id="selectedProjectId"
        />
        <AuditPage
          v-else-if="currentPage === 'audit'"
          :token="adminToken"
          :project-id="selectedProjectId"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0a0a0a;
}

.topbar {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 16px;
  background: #111111;
  border-bottom: 1px solid #1f1f1f;
  gap: 16px;
  flex-shrink: 0;
}

.brand {
  font-size: 13px;
  font-weight: 600;
  color: #a78bfa;
  letter-spacing: 0.05em;
  margin-right: 8px;
}

.nav {
  display: flex;
  gap: 4px;
}

.nav-btn {
  background: none;
  border: none;
  color: #555;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
  border-radius: 3px;
  font-family: system-ui, sans-serif;
  transition: opacity 100ms;
}
.nav-btn:hover {
  opacity: 0.8;
  color: #e8e8e8;
}
.nav-btn.active {
  color: #e8e8e8;
  background: #1f1f1f;
}

.token-area {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.token-input {
  background: #0a0a0a;
  border: 1px solid #1f1f1f;
  color: #e8e8e8;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 3px;
  font-family: system-ui, sans-serif;
  width: 180px;
}
.token-input:focus {
  outline: none;
  border-color: #3b1f6e;
}

.btn {
  background: #1a0f2e;
  border: 1px solid #3b1f6e;
  color: #a78bfa;
  font-size: 11px;
  padding: 3px 10px;
  cursor: pointer;
  border-radius: 3px;
  font-family: system-ui, sans-serif;
  transition: opacity 100ms;
}
.btn:hover {
  opacity: 0.8;
}

.btn-ghost {
  background: none;
  border: none;
  color: #3a3a3a;
  font-size: 14px;
  cursor: pointer;
  padding: 0 4px;
  transition: color 100ms;
}
.btn-ghost:hover {
  color: #dc2626;
}

.token-dot {
  font-size: 11px;
  color: #16a34a;
}

.body {
  flex: 1;
  overflow: hidden;
  display: flex;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #555;
  font-size: 13px;
}
</style>
