const API_BASE = process.env.REACT_APP_API_BASE || "";

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const fetchVendedores = async () => {
  const response = await fetch(`${API_BASE}/api/vendedores`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const createVendedor = async (payload) => {
  const response = await fetch(`${API_BASE}/api/vendedores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const updateVendedor = async (vendedorId, payload) => {
  const response = await fetch(`${API_BASE}/api/vendedores/${vendedorId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const deleteVendedor = async (vendedorId) => {
  const response = await fetch(`${API_BASE}/api/vendedores/${vendedorId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};
