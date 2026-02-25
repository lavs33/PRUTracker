/**
 * logout(navigate)
 * ----------------
 * Handles user logout behavior by:
 * 1. Clearing all locally stored session data
 * 2. Redirecting the user to the landing page
 *
 * Parameters:
 * - navigate (Function): React Router's navigation function
 *   obtained via useNavigate()
 *
 * Behavior:
 * - localStorage.clear()
 *     Removes all keys stored in browser localStorage.
 *     This effectively clears:
 *       - user session data
 *       - stored role
 *       - authentication-related info
 *
 * - navigate("/", { replace: true })
 *     Redirects user to the root (Landing Page).
 *     replace: true prevents user from navigating back
 *     to protected pages using browser back button.
 */
export function logout(navigate) {
  localStorage.clear();
  navigate("/", { replace: true });
}