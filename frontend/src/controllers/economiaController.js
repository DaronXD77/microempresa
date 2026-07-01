const API_BASE = process.env.REACT_APP_API_BASE || "";

export const fetchEconomia = async () => {
  const response = await fetch(`${API_BASE}/api/microempresa/economia`, {
    credentials: "include",
  });
  return response.json().then((data) => ({ response, data }));
};
