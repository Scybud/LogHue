import { actionMsg } from "../../utils/modals.js";
import { openApiKeyModal, openTransferOwnershipModal } from "../../utils/modals.js";
import { loadApiKeys } from "../../shared/workspace/api.js";
import {
  archiveWorkspace,
  deleteWorkspace,
  editWorkspace,
} from "../../features/workspaceData.js";
import { currentWorkspace, user } from "./state.js";

/**
 * Admin / Owner settings (full danger zone + edit).
 */
export async function loadSettingsAdmin(container, workspace, currentUserId) {
  container.innerHTML = "";

  const section = document.createElement("section");
  section.classList.add("section");

  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = "Workspace Settings";

  const docLink = document.createElement("a");
  docLink.classList.add("docLink");
  docLink.href = "https://docs.loghue.com/workspaces#workspaceSettings";
  docLink.target = "_blank";
  docLink.rel = "noopener";
  docLink.textContent = "Docs";

  const sectionHeader = document.createElement("div");
  sectionHeader.classList.add("sectionHeader");
  sectionHeader.append(sectionTitle, docLink);

  // ---- Workspace info ----
  const infoCard = document.createElement("div");
  infoCard.classList.add("card", "workspaceInfoCard");

  const owner = workspace.workspace_members.find((m) => m.role === "owner");

  infoCard.innerHTML = `
    <h3>Workspace Info</h3>
    <p><strong>Name:</strong> ${workspace.name}</p>
    <p><strong>Description:</strong> ${workspace.description || ""}</p>
    <div><strong>Workspace ID:</strong>
      <div class="workspaceIdContainer">
        <input class="inputField workspaceId" readonly value="${workspace.id}">
        <button class="copyBtn" title="Copy">Copy</button>
      </div>
    </div>
    <p><strong>Owner:</strong> ${owner?.profiles?.full_name || "Unknown"}</p>
    <div class="SettingsActionBtnsContainer">
      <button id="editWorkspace" class="btn btn-primary">Edit Workspace</button>
      <button id="archiveWorkspace" class="btn btn-secondary">Archive Workspace</button>
    </div>
  `;

  infoCard.querySelector(".copyBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(
      infoCard.querySelector(".workspaceId").value,
    );
    actionMsg("Copied to clipboard!", "success");
  });

  // ---- API keys ----
  const apiCard = document.createElement("div");
  apiCard.classList.add("card");
  apiCard.innerHTML = `
    <h3>API Keys</h3>
    <button class="btn-secondary btn" id="createApiKeyBtn">Create API Key</button>
  <div class="data-table-wrapper">
  <table class="table">
  <thead>
  <tr>
  <th>Name</th><th>Prefix</th><th>Created</th>
  <th>Last Used</th><th>Status</th><th>Permissions</th><th>Actions</th>
  </tr>
  </thead>
  <tbody id="apiKeysTable"></tbody>
  </table>
  </div>
  `;
  apiCard.querySelector("#createApiKeyBtn").onclick = async () => {
    await openApiKeyModal(workspace);
  };
  loadApiKeys(apiCard.querySelector("#apiKeysTable"), workspace.id);

  // ---- Danger zone (owner only) ----
  const me = workspace.workspace_members.find(
    (m) => m.user_id === currentUserId || m.profiles?.id === currentUserId,
  );

  const transferCard = document.createElement("div");
  transferCard.classList.add("card");
  transferCard.innerHTML = `
    <h3>Transfer Ownership</h3>
    <p class="tunedText">Transfering ownership to another member means you will no longer be the owner of this workspace and will <b>NOT</b> be able to perform sensitive actions on this workspace.</p>
    <p class="text-muted text-center">This action cannot be undone by you again.</p>
    <button type="button" class="btn danger" id="transferBtn">Transfer Ownership</button>
  `;

  const deleteCard = document.createElement("div");
  deleteCard.classList.add("card", "deleteCard");
  deleteCard.innerHTML = `
    <h3><svg
  width="24"
  height="24"
  viewBox="0 0 64 64"
  xmlns="http://www.w3.org/2000/svg"
>
  <!-- Triangle background -->
  <polygon
    points="32,4 4,60 60,60"
    fill="#FFC107"
    stroke="#000000"
    stroke-width="3"
  />

  <!-- Exclamation mark body -->
  <rect
    x="29"
    y="22"
    width="6"
    height="20"
    fill="#000000"
    rx="2"
  />

  <!-- Exclamation mark dot -->
  <circle
    cx="32"
    cy="48"
    r="3"
    fill="#000000"
  />
</svg>
Delete Workspace</h3>
    <p class="tunedText">Deleting this workspace means all content: tasks, discussions, histories and everything related to this workspace will be erased. Members will be removed from this workspace as well.</p>
    <p class="text-muted text-center">This action <b>CANNOT</b> be undone. Please be sure of your intentions before performing this action.</p>
    <button type="button" class="btn danger" id="deleteWorkspace">Delete Workspace</button>
  `;

  const containerTitle = document.createElement("h3");
  containerTitle.textContent = "Danger Zone";

  const dangerContainerInner = document.createElement("div");
  dangerContainerInner.classList.add("danger", "settingsCard");
  dangerContainerInner.append(transferCard, deleteCard);

  const dangerContainer = document.createElement("div");
  dangerContainer.classList.add("danger");
  dangerContainer.append(containerTitle, dangerContainerInner);

  if (me?.role === "owner") {
    transferCard.querySelector("#transferBtn").onclick = async () => {
      await openTransferOwnershipModal(workspace);
    };
    section.append(sectionHeader, infoCard, apiCard, dangerContainer);
  } else {
    section.append(sectionHeader, infoCard, apiCard);
  }

  container.append(section);
  await attachSettingsActions(workspace, workspace.id);
}

/**
 * Member settings – read-only info + API keys table (no create).
 */
export async function loadSettingsMember(container, workspace) {
  container.innerHTML = "";

  const section = document.createElement("section");
  section.classList.add("section");

  const title = document.createElement("h2");
  title.classList.add("sectionTitle");
  title.textContent = "Workspace Settings";

  const infoCard = document.createElement("div");
  infoCard.classList.add("card", "workspaceInfoCard");

  const owner = workspace.workspace_members.find((m) => m.role === "owner");

  infoCard.innerHTML = `
    <h3>Workspace Info</h3>
    <p><strong>Name:</strong> ${workspace.name}</p>
    <p><strong>Description:</strong> ${workspace.description || ""}</p>
    <div><strong>Workspace ID:</strong>
      <div class="workspaceIdContainer">
        <input class="inputField workspaceId" readonly value="${workspace.id}">
        <button class="copyBtn" title="Copy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" stroke-width="2"/>
            <rect x="5" y="5" width="10" height="10" rx="2" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>
    </div>
    <p><strong>Owner:</strong> ${owner?.profiles?.full_name || "Unknown"}</p>
  `;

  infoCard.querySelector(".copyBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(
      infoCard.querySelector(".workspaceId").value,
    );
    actionMsg("Copied to clipboard!", "success");
  });

  const apiCard = document.createElement("div");
  apiCard.classList.add("card");
  apiCard.innerHTML = `
    <h3>API Keys</h3>
    <p class="mutedText">Only admins and owner can create API Keys.</p>
    <table class="table">
      <thead>
        <tr>
          <th>Name</th><th>Prefix</th><th>Created</th>
          <th>Last Used</th><th>Status</th><th>Permissions</th><th>Actions</th>
        </tr>
      </thead>
      <tbody id="apiKeysTable"></tbody>
    </table>
  `;
  loadApiKeys(apiCard.querySelector("#apiKeysTable"), workspace.id);

  section.append(title, infoCard, apiCard);
  container.append(section);
}

async function attachSettingsActions(ws, id) {
  const editBtn = document.querySelector("#editWorkspace");
  const archiveBtn = document.querySelector("#archiveWorkspace");
  const deleteBtn = document.querySelector("#deleteWorkspace");

  if (editBtn) {
    editBtn.onclick = async () => editWorkspace(ws, id);
  }
  if (archiveBtn) {
    archiveBtn.onclick = async () => archiveWorkspace(id);
  }
  if (deleteBtn) {
    deleteBtn.onclick = async () => deleteWorkspace(id);
  }
}
