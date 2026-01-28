const API_BASE = process.env.REACT_APP_API_BASE || "";

export const updateAdmin = async (id, payload) => {
  const response = await fetch(`${API_BASE}/api/admins/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return response.json().then((data) => ({ response, data }));
};

export const updateMicroempresa = async (id, payload) => {
  const response = await fetch(`${API_BASE}/api/microempresas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return response.json().then((data) => ({ response, data }));
};

export const updateCliente = async (id, payload) => {
  const response = await fetch(`${API_BASE}/api/clientes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return response.json().then((data) => ({ response, data }));
};

export const deactivateMicroempresa = async (id) => {
  const response = await fetch(`${API_BASE}/api/microempresas/${id}/deactivate`, {
    method: "PATCH",
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const activateMicroempresa = async (id) => {
  const response = await fetch(`${API_BASE}/api/microempresas/${id}/activate`, {
    method: "PATCH",
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const deactivateCliente = async (id) => {
  const response = await fetch(`${API_BASE}/api/clientes/${id}/deactivate`, {
    method: "PATCH",
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const activateCliente = async (id) => {
  const response = await fetch(`${API_BASE}/api/clientes/${id}/activate`, {
    method: "PATCH",
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const deactivateAdmin = async (id) => {
  const response = await fetch(`${API_BASE}/api/admins/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const activateAdmin = async (id) => {
  const response = await fetch(`${API_BASE}/api/admins/${id}/activate`, {
    method: "PATCH",
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const uploadMicroempresaQr = async (tenantId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}/api/microempresas/${tenantId}/qr`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  return response.json().then((data) => ({ response, data }));
};
