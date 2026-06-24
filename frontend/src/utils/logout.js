/**
 * logout(navigate)
 * ----------------
 * Handles user logout behavior by:
 * 1. Clearing all locally stored session data
 * 2. Redirecting the user to the landing page
 * 3. Returning the landing page to its top section
 *
 * Parameters:
 * - navigate (Function): React Router's navigation function
 *   obtained via useNavigate()
 */
export function logout(navigate) {
  localStorage.clear();
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  navigate("/", { replace: true });
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
}
