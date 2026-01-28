const API_BASE = process.env.REACT_APP_API_BASE || "";

export const fetchPublicMicroempresas = async () => {
  const response = await fetch(`${API_BASE}/api/public/microempresas`);
  return response.json().then((data) => ({ response, data }));
};

export const fetchPublicCategorias = async () => {
  const response = await fetch(`${API_BASE}/api/public/categorias`);
  return response.json().then((data) => ({ response, data }));
};
