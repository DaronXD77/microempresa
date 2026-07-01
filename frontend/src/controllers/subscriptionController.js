const API_BASE = process.env.REACT_APP_API_BASE || "";

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

// ==============================
// PLANES
// ==============================
export const fetchPlans = async () => {
  const response = await fetch(`${API_BASE}/api/plans`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const fetchSystemQrPublic = async () => {
  const response = await fetch(`${API_BASE}/api/public/system/qr`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

// ==============================
// ONBOARDING MICROEMPRESA (wizard)
// ==============================

// Paso 1: crear / editar microempresa PENDIENTE (sin login)
export const startMicroempresaOnboarding = async (payload, logoFile) => {
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, String(value));
  });
  if (logoFile) {
    formData.append("logo", logoFile);
  }

  const response = await fetch(`${API_BASE}/api/onboarding/microempresa/start`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await safeJson(response);
  return { response, data };
};

// Paso 3: subir comprobante + plan elegido (multipart)
export const submitMicroempresaPayment = async ({ signup_id, id_plan, file }) => {
  const formData = new FormData();
  formData.append("signup_id", String(signup_id));
  formData.append("id_plan", String(id_plan));
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/api/onboarding/microempresa/submit`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await safeJson(response);
  return { response, data };
};

// Consultar estado
export const getOnboardingStatus = async (signup_id) => {
  const response = await fetch(
    `${API_BASE}/api/onboarding/microempresa/status?signup_id=${encodeURIComponent(String(signup_id))}`,
    { credentials: "include" }
  );
  const data = await safeJson(response);
  return { response, data };
};

// ==============================
// SUPER USUARIO: pendientes
// ==============================
export const fetchPendingMicroempresas = async () => {
  const response = await fetch(`${API_BASE}/api/onboarding/microempresa/pending`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const approvePendingMicroempresa = async (tenant_id) => {
  const response = await fetch(
    `${API_BASE}/api/onboarding/microempresa/${encodeURIComponent(String(tenant_id))}/approve`,
    {
      method: "PATCH",
      credentials: "include",
    }
  );
  const data = await safeJson(response);
  return { response, data };
};

export const rejectPendingMicroempresa = async (tenant_id) => {
  const response = await fetch(
    `${API_BASE}/api/onboarding/microempresa/${encodeURIComponent(String(tenant_id))}/reject`,
    {
      method: "PATCH",
      credentials: "include",
    }
  );
  const data = await safeJson(response);
  return { response, data };
};

// ==============================
// SUPER USUARIO: CRUD PLANES
// ==============================
export const fetchAllPlansAdmin = async () => {
  const response = await fetch(`${API_BASE}/api/admin/plans`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const fetchSystemQrAdmin = async () => {
  const response = await fetch(`${API_BASE}/api/admin/system/qr`, {
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};

export const uploadSystemQrAdmin = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}/api/admin/system/qr`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await safeJson(response);
  return { response, data };
};

export const createPlanAdmin = async (payload) => {
  const response = await fetch(`${API_BASE}/api/admin/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const updatePlanAdmin = async (plan_id, payload) => {
  const response = await fetch(`${API_BASE}/api/admin/plans/${encodeURIComponent(String(plan_id))}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  return { response, data };
};

export const deletePlanAdmin = async (plan_id) => {
  const response = await fetch(`${API_BASE}/api/admin/plans/${encodeURIComponent(String(plan_id))}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await safeJson(response);
  return { response, data };
};
