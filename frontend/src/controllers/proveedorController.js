const API_BASE = process.env.REACT_APP_API_BASE || "";

export const fetchProveedores = async () => {
  const response = await fetch(`${API_BASE}/api/proveedores`, {
    method: "GET",
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const createProveedor = async (payload) => {
  const response = await fetch(`${API_BASE}/api/proveedores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const updateProveedor = async (id, payload) => {
  const response = await fetch(`${API_BASE}/api/proveedores/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const deactivateProveedor = async (id) => {
  const response = await fetch(`${API_BASE}/api/proveedores/${id}/deactivate`, {
    method: "PATCH",
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const activateProveedor = async (id) => {
  const response = await fetch(`${API_BASE}/api/proveedores/${id}/activate`, {
    method: "PATCH",
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};
