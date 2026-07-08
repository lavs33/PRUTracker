const normalizeApiBase = (value = "") => String(value || "").trim().replace(/\/+$/, "");

export const API_BASE = normalizeApiBase(process.env.REACT_APP_API_BASE_URL);

export const apiUrl = (path = "") => {
  const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
};