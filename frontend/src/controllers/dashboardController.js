const API_BASE = process.env.REACT_APP_API_BASE || "";

export const fetchDashboard = async () => {
  const response = await fetch(`${API_BASE}/api/dashboard`, {
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};
