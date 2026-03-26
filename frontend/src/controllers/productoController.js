const API_BASE = process.env.REACT_APP_API_BASE || "";

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const fetchCategorias = async () => {
  const response = await fetch(`${API_BASE}/api/public/categorias`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const fetchProductos = async (stock = "all") => {
  const url = stock === "disponible"
    ? `${API_BASE}/api/public/productos?stock=disponible`
    : `${API_BASE}/api/public/productos`;
  const response = await fetch(url, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const fetchProducto = async (productoId) => {
  const response = await fetch(`${API_BASE}/api/public/productos/${productoId}`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const fetchCategoriasAdmin = async () => {
  const response = await fetch(`${API_BASE}/api/categorias`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const createCategoria = async (payload) => {
  const response = await fetch(`${API_BASE}/api/categorias`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const fetchTallas = async () => {
  const response = await fetch(`${API_BASE}/api/tallas`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const createTalla = async (payload) => {
  const response = await fetch(`${API_BASE}/api/tallas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const fetchProductosAdmin = async () => {
  const response = await fetch(`${API_BASE}/api/productos`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const createProducto = async (payload) => {
  const response = await fetch(`${API_BASE}/api/productos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const updateProducto = async (productoId, payload) => {
  const response = await fetch(`${API_BASE}/api/productos/${productoId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const addTallaProducto = async (productoId, payload) => {
  const response = await fetch(`${API_BASE}/api/productos/${productoId}/tallas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const updateTallaProducto = async (productoId, ptId, payload) => {
  const response = await fetch(`${API_BASE}/api/productos/${productoId}/tallas/${ptId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};
