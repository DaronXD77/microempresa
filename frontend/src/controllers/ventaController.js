const API_BASE = process.env.REACT_APP_API_BASE || "";

export const fetchVentas = async () => {
  const response = await fetch(`${API_BASE}/api/ventas`, {
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const fetchPedidos = async () => {
  const response = await fetch(`${API_BASE}/api/ventas/pedidos`, {
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const crearVentaPos = async (payload) => {
  const response = await fetch(`${API_BASE}/api/ventas/pos`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const crearVentaVirtual = async (payload) => {
  const response = await fetch(`${API_BASE}/api/ventas/virtual`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const subirComprobante = async (ventaId, formData, token) => {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const response = await fetch(`${API_BASE}/api/ventas/${ventaId}/comprobante${query}`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const marcarEmpaquetado = async (ventaId, payload = {}) => {
  const response = await fetch(`${API_BASE}/api/ventas/${ventaId}/empaquetar`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const marcarEntregado = async (ventaId, token) => {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const response = await fetch(`${API_BASE}/api/ventas/${ventaId}/entregar${query}`, {
    method: "PATCH",
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const seleccionarEntrega = async (ventaId, opcionId, token) => {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const response = await fetch(`${API_BASE}/api/ventas/${ventaId}/entrega/seleccionar${query}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opcion_id: opcionId }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const rechazarVenta = async (ventaId) => {
  const response = await fetch(`${API_BASE}/api/ventas/${ventaId}/rechazar`, {
    method: "PATCH",
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const cancelarVenta = async (ventaId) => {
  const response = await fetch(`${API_BASE}/api/ventas/${ventaId}/cancelar`, {
    method: "PATCH",
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const fetchMisPedidos = async (email) => {
  const query = email ? `?email=${encodeURIComponent(email)}` : "";
  const response = await fetch(`${API_BASE}/api/ventas/mis-pedidos${query}`, {
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const fetchAdminVentas = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.date) params.set("date", filters.date);
  if (filters.tenant_id) params.set("tenant_id", filters.tenant_id);
  const query = params.toString() ? `?${params.toString()}` : "";

  const response = await fetch(`${API_BASE}/api/admin/ventas${query}`, {
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

export const fetchAdminVenta = async (ventaId) => {
  const response = await fetch(`${API_BASE}/api/admin/ventas/${ventaId}`, {
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};
