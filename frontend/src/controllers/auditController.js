const API_BASE = process.env.REACT_APP_API_BASE || "";

export const fetchAuditoria = async (params = {}) => {
  const filtered = Object.entries(params).reduce((acc, [key, value]) => {
    if (value === undefined || value === null || value === "") return acc;
    acc[key] = value;
    return acc;
  }, {});
  const query = new URLSearchParams(filtered);
  const response = await fetch(`${API_BASE}/api/admin/auditoria?${query.toString()}`, {
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};
