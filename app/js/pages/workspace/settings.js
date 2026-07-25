import {
  openTransferOwnershipModal,
  openApiKeyModal,
} from "../../utils/modals.js";
import { loadApiKeys } from "../../shared/workspace/api.js";
import {
  archiveWorkspace,
  deleteWorkspace,
  editWorkspace,
} from "../../features/workspaceData.js";
import { PERMISSIONS } from "../../shared/workspace/permissions.js";
import { actionMsg } from "../../utils/modals.js";
import { getCurrentUserRole } from "./state.js";

// -------------------------------------------------------------------
// SETTINGS (fully permission gated)
// -------------------------------------------------------------------
export async function loadSettings(container, workspace, currentUserId) {
  container.innerHTML = ""; // clear the container once

  const myPermissions = PERMISSIONS[getCurrentUserRole()] || {};

  // SECTION HEADER
  const sectionHeader = document.createElement("div");
  sectionHeader.classList.add("sectionHeader");
  const sectionTitle = document.createElement("h2");
  sectionTitle.classList.add("sectionTitle");
  sectionTitle.textContent = "Workspace Settings";
  const docLink = document.createElement("a");
  docLink.classList.add("docLink");
  docLink.href = "https://docs.loghue.com/workspaces#workspaceSettings";
  docLink.target = "_blank";
  docLink.rel = "noopener";
  docLink.textContent = "Docs";
  sectionHeader.append(sectionTitle, docLink);

  // 1. WORKSPACE INFO CARD (always visible)
  const infoCard = document.createElement("div");
  infoCard.classList.add("card", "workspaceInfoCard");
  const owner = workspace.workspace_members.find((m) => m.role === "owner");
  infoCard.innerHTML = `
    <h3>Workspace Info</h3>
    <p><strong>Name:</strong> ${workspace.name}</p>
    <p><strong>Description:</strong> ${workspace.description}</p>
    <div>
      <strong>Workspace ID:</strong>
      <div class="workspaceIdContainer">
        <input class="inputField workspaceId" readonly value="${workspace.id}">
        <button class="copyBtn" title="Copy">Copy</button>
      </div>
    </div>
    <p><strong>Owner:</strong> ${owner?.profiles.full_name || "Unknown"}</p>
    <div class="SettingsActionBtnsContainer"></div>
  `;
  infoCard.querySelector(".copyBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(workspace.id);
    actionMsg("Copied to clipboard!", "success");
  });

  // Edit / Archive buttons (admin / owner only)
  if (myPermissions.manageWorkspace) {
    const btnsContainer = infoCard.querySelector(
      ".SettingsActionBtnsContainer",
    );
    const editBtn = document.createElement("button");
    editBtn.id = "editWorkspace";
    editBtn.classList.add("btn", "btn-primary");
    editBtn.textContent = "Edit Workspace";
    const archiveBtn = document.createElement("button");
    archiveBtn.id = "archiveWorkspace";
    archiveBtn.classList.add("btn", "btn-secondary");
    archiveBtn.textContent = "Archive Workspace";
    btnsContainer.append(editBtn, archiveBtn);
  }

  // 2. API KEYS CARD
  let apiCard = null;
  if (myPermissions.createApiKey) {
    apiCard = document.createElement("div");
    apiCard.classList.add("card");
    apiCard.innerHTML = `
      <h3>API Keys</h3>
      <button class="btn-secondary btn" id="createApiKeyBtn">Create API Key</button>
      <table class="table">
        <thead>
          <tr><th>Name</th><th>Prefix</th><th>Created</th><th>Last Used</th><th>Status</th><th>Permissions</th><th>Actions</th></tr>
        </thead>
        <tbody id="apiKeysTable"></tbody>
      </table>
    `;
    apiCard.querySelector("#createApiKeyBtn").onclick = async () => {
      await openApiKeyModal(workspace);
    };
    loadApiKeys(apiCard.querySelector("#apiKeysTable"), workspace.id);
  } else {
    // Member sees a read only API keys table
    apiCard = document.createElement("div");
    apiCard.classList.add("card");
    apiCard.innerHTML = `
      <h3>API Keys</h3>
      <p class="mutedText">Only admins and owner can create API Keys.</p>
      <table class="table">
        <thead>
          <tr><th>Name</th><th>Prefix</th><th>Created</th><th>Last Used</th><th>Status</th><th>Permissions</th><th>Actions</th></tr>
        </thead>
        <tbody id="apiKeysTable"></tbody>
      </table>
    `;
    loadApiKeys(apiCard.querySelector("#apiKeysTable"), workspace.id);
  }

  // 3. DANGER ZONE (owner only)
  let dangerContainer = null;
  if (myPermissions.transferOwnership || myPermissions.deleteWorkspace) {
    dangerContainer = document.createElement("div");
    dangerContainer.classList.add("danger");

    const dangerTitle = document.createElement("h3");
    dangerTitle.textContent = "Danger Zone";
    const dangerInner = document.createElement("div");
    dangerInner.classList.add("settingsCard");

    if (myPermissions.transferOwnership) {
      const transferCard = document.createElement("div");
      transferCard.classList.add("card");
      transferCard.innerHTML = `
        <h3>Transfer Ownership</h3>
        <p class="tunedText">
          Transferring ownership to another member means you will no longer be the owner
          of this workspace and will <b>NOT</b> be able to perform sensitive actions.
        </p>
        <p class="text-muted text-center">This action cannot be undone by you again.</p>
        <button type="button" class="btn danger" id="transferBtn">Transfer Ownership</button>
      `;
      transferCard.querySelector("#transferBtn").onclick = async () => {
        await openTransferOwnershipModal(workspace);
      };
      dangerInner.appendChild(transferCard);
    }

    if (myPermissions.deleteWorkspace) {
      const deleteCard = document.createElement("div");
      deleteCard.classList.add("card", "deleteCard");
      deleteCard.innerHTML = `
        <h3>⚠️ Delete Workspace</h3>
        <p class="tunedText">
          Deleting this workspace will erase all content, tasks, discussions, and histories.
          Members will be removed.
        </p>
        <p class="text-muted text-center">This action <b>CANNOT</b> be undone.</p>
        <button type="button" class="btn danger" id="deleteWorkspace">Delete Workspace</button>
      `;
      dangerInner.appendChild(deleteCard);
    }

    dangerContainer.append(dangerTitle, dangerInner);
  }

  // BUILD THE FINAL SECTION IN ORDER
  const section = document.createElement("section");
  section.classList.add("section");
  section.appendChild(sectionHeader);
  section.appendChild(infoCard);
  if (apiCard) section.appendChild(apiCard);
  if (dangerContainer) section.appendChild(dangerContainer);

  container.appendChild(section);

  // Attach listeners for the newly created buttons
  await attachSettingsActions(workspace, workspace.id);
}

async function attachSettingsActions(ws, id) {
  const editBtn = document.querySelector("#editWorkspace");
  const archiveBtn = document.querySelector("#archiveWorkspace");
  const deleteBtn = document.querySelector("#deleteWorkspace");

  if (editBtn) editBtn.onclick = async () => await editWorkspace(ws, id);
  if (archiveBtn) archiveBtn.onclick = async () => await archiveWorkspace(id);
  if (deleteBtn) deleteBtn.onclick = async () => await deleteWorkspace(id);
}
