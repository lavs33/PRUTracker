/**
 * logout(navigate, role)
 * ----------------------
 * Clears session data and redirects either to the PRUTracker entry page
 * or, when a role is provided, to that role's login portal.
 */
export function logout(navigate, role = "") {
  const nextRole = String(role || "").trim().toUpperCase();
  localStorage.clear();
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  if (nextRole) {
    localStorage.setItem("role", nextRole);
    navigate("/login", { replace: true });
  } else {
    navigate("/", { replace: true });
  }
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
}
