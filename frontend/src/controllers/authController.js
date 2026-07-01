const API_BASE = process.env.REACT_APP_API_BASE || "";

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const login = async ({ username, password, role }) => {
  const response = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password, role }),
  });
  return response.json().then((data) => ({ response, data }));
};

export const register = async (payload) => {
  const response = await fetch(`${API_BASE}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return response.json().then((data) => ({ response, data }));
};

export const guestLogin = async () => {
  const response = await fetch(`${API_BASE}/api/guest-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const fetchMe = async () => {
  const response = await fetch(`${API_BASE}/api/me`, {
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};

export const logout = async () => {
  const response = await fetch(`${API_BASE}/api/logout`, {
    method: "POST",
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const switchRole = async (role) => {
  const response = await fetch(`${API_BASE}/api/switch-role`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ role }),
  });
  return response.json().then((data) => ({ response, data }));
};

// ✅ Password Reset
// ===============================
export const requestPasswordReset = async ({ email, role }) => {
  const response = await fetch(`${API_BASE}/api/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, role }),
  });

  const data = await safeJson(response);
  return { response, data };
};

export const confirmPasswordReset = async ({ email, role, token, new_password }) => {
  const response = await fetch(`${API_BASE}/api/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, role, token, new_password }),
  });

  const data = await safeJson(response);
  return { response, data };
};
