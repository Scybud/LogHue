import { formatDateTime } from "../../utils/time.js";
import { actionMsg } from "../../utils/modals.js";
import { supabase } from "../../supabase.js";
import { user } from "./state.js";

/**
 * Admin / Owner – invite history table.
 */
export function loadInviteHistory(invites, container) {
  const table = document.createElement("table");
  table.classList.add("inviteTable");

  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");

  const headers = [
    "Invite Method",
    "Invite Target",
    "Created",
    "Uses",
    "Status",
    "Actions",
  ];

  headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    trHead.append(th);
  });
  thead.append(trHead);

  const tbody = document.createElement("tbody");
  tbody.id = "invite-body";
  table.append(thead, tbody);

  const inviteTemplate = document.getElementById("invite-row-template");
  if (!inviteTemplate) {
    container.append(table);
    return;
  }

  invites.forEach((inv) => {
    const row = inviteTemplate.content.cloneNode(true);
    const tr = row.querySelector("tr");

    const method = inv.email ? "Email" : "Link";
    const target = inv.email
      ? inv.email
      : `https://app.loghue.com/invite?token=${inv.token}`;

    const created = inv.created_at;
    const count = inv.accepted_count ?? 0;

    let status = "Active";
    let statusClass = "active";
    if (count >= inv.max_invite_count) {
      status = "Full";
      statusClass = "full";
    } else if (inv.accepted) {
      status = "Used";
      statusClass = "used";
    }

    row.querySelector(".method").textContent = method;

    const urlText = row.querySelector(".urlText");
    urlText.textContent = target;
    urlText.title = target;

    row.querySelector(".created").textContent = formatDateTime(created);
    row.querySelector(".uses").textContent =
      `${count} / ${inv.max_invite_count}`;

    const statusCell = row.querySelector(".status");
    statusCell.textContent = status;
    statusCell.classList.add(statusClass);

    row.querySelector(".copyBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(target);
      actionMsg("Copied to clipboard!", "success");
    });

    const actionsCell = row.querySelector(".actions");
    const revokeBtn = document.createElement("button");
    revokeBtn.classList.add("revokeInviteBtn", "revoke");
    revokeBtn.type = "button";
    revokeBtn.id = inv.id;
    revokeBtn.textContent = "Delete";
    actionsCell.append(revokeBtn);

    row.querySelector(".method").dataset.label = "Invite Method";
    row.querySelector(".urlCell").dataset.label = "Invite Target";
    row.querySelector(".created").dataset.label = "Created";
    row.querySelector(".uses").dataset.label = "Uses";
    row.querySelector(".status").dataset.label = "Status";
    row.querySelector(".actions").dataset.label = "Actions";

    tbody.prepend(row);

    revokeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = e.currentTarget.id;

      const { error } = await supabase
        .from("workspace_invites")
        .delete()
        .eq("id", id)
        .eq("created_by", user.id);

      if (error) {
        console.error(error);
        actionMsg("Failed to revoke invite.", "error");
        return;
      }

      tr.remove();
      actionMsg("Invite revoked!", "success");
    });
  });

  container.append(table);
}

/**
 * Create a new workspace invite (admin / owner).
 */
export async function createWorkspaceInvite({ workspaceId, role, email = null }) {
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser)
    throw new Error("Authentication required to create invites");

  const token = crypto.randomUUID();

  const { data, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      role,
      email,
      token,
      created_by: authUser.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase Insert Error:", error);
    throw error;
  }
  return data;
}
