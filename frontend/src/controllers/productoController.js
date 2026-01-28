const API_BASE = process.env.REACT_APP_API_BASE || "";

export const fetchProductos = async () => {
  const response = await fetch(`${API_BASE}/api/productos`, {
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const createProducto = async (payload) => {
  const response = await fetch(`${API_BASE}/api/productos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return response.json().then((data) => ({ response, data }));
};

export const updateProducto = async (id, payload) => {
  const response = await fetch(`${API_BASE}/api/productos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return response.json().then((data) => ({ response, data }));
};

export const activateProducto = async (id) => {
  const response = await fetch(`${API_BASE}/api/productos/${id}/activate`, {
    method: "PATCH",
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const deactivateProducto = async (id) => {
  const response = await fetch(`${API_BASE}/api/productos/${id}/deactivate`, {
    method: "PATCH",
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const uploadProductoFoto = async (id, formData) => {
  const response = await fetch(`${API_BASE}/api/productos/${id}/fotos`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  return response.json().then((data) => ({ response, data }));
};

export const deleteProductoFoto = async (productId, fotoId) => {
  const response = await fetch(`${API_BASE}/api/productos/${productId}/fotos/${fotoId}`, {
    method: "DELETE",
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const fetchStockAlerts = async () => {
  const response = await fetch(`${API_BASE}/api/productos/alerts/stock`, {
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const fetchPublicProductos = async (params = {}) => {
  const filtered = Object.entries(params).reduce((acc, [key, value]) => {
    if (value === undefined || value === null || value === "") return acc;
    acc[key] = value;
    return acc;
  }, {});
  const query = new URLSearchParams(filtered);
  const response = await fetch(`${API_BASE}/api/public/productos?${query.toString()}`);
  return response.json().then((data) => ({ response, data }));
};

export const fetchPublicProductoDetalle = async (productoId) => {
  const response = await fetch(`${API_BASE}/api/public/productos/${productoId}`);
  return response.json().then((data) => ({ response, data }));
};
