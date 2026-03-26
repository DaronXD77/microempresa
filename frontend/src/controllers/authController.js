const API_BASE = process.env.REACT_APP_API_BASE || "";

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const login = async (email, password) => {
  const response = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const logout = async () => {
  const response = await fetch(`${API_BASE}/api/logout`, {
    method: "POST",
    credentials: "include",
  });
  return { response, data: await safeJson(response) };
};

export const fetchMe = async () => {
  const response = await fetch(`${API_BASE}/api/me`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const registerCliente = async (payload) => {
  const response = await fetch(`${API_BASE}/api/register/cliente`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};
