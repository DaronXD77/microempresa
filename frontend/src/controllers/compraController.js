const API_BASE = process.env.REACT_APP_API_BASE || "";

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const fetchProveedores = async () => {
  const response = await fetch(`${API_BASE}/api/proveedores`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const createProveedor = async (payload) => {
  const response = await fetch(`${API_BASE}/api/proveedores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const updateProveedor = async (proveedorId, payload) => {
  const response = await fetch(`${API_BASE}/api/proveedores/${proveedorId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const fetchCompras = async (params = {}) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = queryParams
    ? `${API_BASE}/api/compras?${queryParams}`
    : `${API_BASE}/api/compras`;
  const response = await fetch(url, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const createCompra = async (payload) => {
  const response = await fetch(`${API_BASE}/api/compras`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const fetchCompra = async (compraId) => {
  const response = await fetch(`${API_BASE}/api/compras/${compraId}`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};
