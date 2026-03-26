const API_BASE = process.env.REACT_APP_API_BASE || "";

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const fetchDashboard = async () => {
  const response = await fetch(`${API_BASE}/api/dashboard`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const createVenta = async (payload) => {
  const response = await fetch(`${API_BASE}/api/ventas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const fetchVentas = async (params = {}) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = queryParams
    ? `${API_BASE}/api/ventas?${queryParams}`
    : `${API_BASE}/api/ventas`;
  const response = await fetch(url, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const fetchVenta = async (ventaId) => {
  const response = await fetch(`${API_BASE}/api/ventas/${ventaId}`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const fetchQrVenta = async (ventaId) => {
  const response = await fetch(`${API_BASE}/api/ventas/${ventaId}/qr`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const createEnvio = async (ventaId, payload) => {
  const response = await fetch(`${API_BASE}/api/ventas/${ventaId}/envio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const reporteVentas = async (fechaInicio, fechaFin) => {
  const response = await fetch(
    `${API_BASE}/api/reportes/ventas?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`,
    { credentials: "include" }
  );
  const data = await safeJson(response);
  return { response, data };
};

export const fetchAuditoria = async (params = {}) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = queryParams
    ? `${API_BASE}/api/auditoria?${queryParams}`
    : `${API_BASE}/api/auditoria`;
  const response = await fetch(url, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};
