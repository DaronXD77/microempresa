const API_BASE = process.env.REACT_APP_API_BASE || "";

export const createCompra = async (payload) => {
  const response = await fetch(`${API_BASE}/api/compras`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return response.json().then((data) => ({ response, data }));
};

export const fetchCompras = async () => {
  const response = await fetch(`${API_BASE}/api/compras`, {
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const fetchCompraDetalle = async (compraId) => {
  const response = await fetch(`${API_BASE}/api/compras/${compraId}`, {
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};
