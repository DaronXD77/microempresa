const API_BASE = process.env.REACT_APP_API_BASE || "";

export const fetchEmpleados = async () => {
  const response = await fetch(`${API_BASE}/api/microempresa/empleados`, {
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const createEmpleado = async (payload) => {
  const response = await fetch(`${API_BASE}/api/microempresa/empleados`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return response.json().then((data) => ({ response, data }));
};

export const updateEmpleado = async (id, payload) => {
  const response = await fetch(`${API_BASE}/api/microempresa/empleados/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return response.json().then((data) => ({ response, data }));
};

export const resetEmpleadoPassword = async (id) => {
  const response = await fetch(`${API_BASE}/api/microempresa/empleados/${id}/reset-password`, {
    method: "PATCH",
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const updateEmpleadoMe = async (payload) => {
  const response = await fetch(`${API_BASE}/api/empleados/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return response.json().then((data) => ({ response, data }));
};
