const API_BASE = (process.env.REACT_APP_API_BASE || "").replace(/\/$/, "");

export const resolveAssetUrl = (value) => {
  if (!value) return "";
  const raw = String(value);
  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }
  if (raw.startsWith("www.")) {
    return `https://${raw}`;
  }
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) {
    return raw;
  }
  if (raw.startsWith("/")) {
    return `${API_BASE}${raw}`;
  }
  return API_BASE ? `${API_BASE}/${raw}` : raw;
};
