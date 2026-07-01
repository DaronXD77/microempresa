const API_BASE = process.env.REACT_APP_API_BASE || "";

export const fetchCategorias = async () => {
  const response = await fetch(`${API_BASE}/api/categorias`, {
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const fetchCategoriasActivas = async () => {
  const response = await fetch(`${API_BASE}/api/categorias/activas`, {
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const createCategoria = async (payload) => {
  const response = await fetch(`${API_BASE}/api/categorias`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return response.json().then((data) => ({ response, data }));
};

export const updateCategoria = async (id, payload) => {
  const response = await fetch(`${API_BASE}/api/categorias/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return response.json().then((data) => ({ response, data }));
};

export const activateCategoria = async (id) => {
  const response = await fetch(`${API_BASE}/api/categorias/${id}/activate`, {
    method: "PATCH",
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const deactivateCategoria = async (id) => {
  const response = await fetch(`${API_BASE}/api/categorias/${id}/deactivate`, {
    method: "PATCH",
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};
