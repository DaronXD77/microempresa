const API_BASE = process.env.REACT_APP_API_BASE || "";

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const fetchClientes = async () => {
  const response = await fetch(`${API_BASE}/api/clientes`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const lookupPublicCliente = async ({ tenant_id, q }) => {
  const response = await fetch(
    `${API_BASE}/api/public/clientes/lookup?tenant_id=${encodeURIComponent(String(tenant_id))}&q=${encodeURIComponent(String(q || ""))}`
  );
  const data = await safeJson(response);
  return { response, data };
};

export const fetchFollowedMicroempresas = async () => {
  const response = await fetch(`${API_BASE}/api/clientes/following`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const followMicroempresa = async (tenantId) => {
  const response = await fetch(`${API_BASE}/api/clientes/follow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ tenant_id: tenantId }),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const unfollowMicroempresa = async (tenantId) => {
  const response = await fetch(`${API_BASE}/api/clientes/follow/${tenantId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const registerPublicCliente = async (payload) => {
  const response = await fetch(`${API_BASE}/api/public/clientes/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};
