import { supabase } from "../../supabase.js";
import { formatDateTime } from "../../utils/time.js";

export async function loadApiKeys(tbody, workspaceId) {
  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) return;

  tbody.innerHTML = "";

  keys.forEach((key) => {
    const tr = document.createElement("tr");

    const actionBtnClass =
      key.revoked === true ? "restoreApiBtn" : "revokeApiBtn";

    tr.innerHTML = `
      <td>${key.name}</td>
      <td>${key.prefix}</td>
      <td>${formatDateTime(key.created_at)}</td>
      <td>${key.last_used_at ? formatDateTime(key.last_used_at) : "—"}</td>
      <td>${key.revoked === true ? "Revoked" : "Active"}</td>
      <td>${key.permissions.join(", ")}</td>
      <td><button class="${actionBtnClass}" id="${key.id}">Revoke</button></td>
    `;

    const revokeBtn = tr.querySelector(".revokeApiBtn");
    const restoreBtn = tr.querySelector(".restoreApiBtn");

    if (revokeBtn) {
      revokeBtn.textContent = "Revoke";

      revokeBtn.onclick = async () => {
        await supabase
          .from("api_keys")
          .update({ revoked: true })
          .eq("id", key.id);
        loadApiKeys(tbody, workspaceId);
        actionMsg("API Key revoked!", "success");
      };
    }
    if (restoreBtn) {
      restoreBtn.textContent = "Restore";

      restoreBtn.onclick = async () => {
        await supabase
          .from("api_keys")
          .update({ revoked: false })
          .eq("id", key.id);
        loadApiKeys(tbody, workspaceId);
        actionMsg("API Key Restored!", "success");
      };
    }

    tbody.append(tr);
  });
}
