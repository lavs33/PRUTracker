/**
 * generateUsername(role, number)
 * ------------------------------
 * Generates a standardized username using:
 * - role prefix
 * - zero-padded numeric sequence
 *
 * Format:
 *   <role><6-digit-number>
 *
 * Example:
 *   generateUsername("AG", 25)
 *   → "AG000025"
 *
 * Parameters:
 * - role (String): role code (e.g., "AG", "AUM", "UM", "BM")
 * - number (Number): sequential numeric identifier
 *
 * Behavior:
 * - Converts number to string
 * - Pads it to 6 digits using leading zeros
 * - Concatenates role + padded number
 */
function generateUsername(role, number) {
  return `${role}${number.toString().padStart(6, "0")}`;
}

/**
 * generatePassword(role, birthday, username)
 * ------------------------------------------
 * Generates a deterministic default password based on:
 * - role
 * - user's birth date
 * - last 4 characters of username
 *
 * Format:
 *   <role><DD><mon>@<last4>
 *
 * Where:
 * - DD = 2-digit day of month (01–31)
 * - mon = 3-letter lowercase month abbreviation (e.g., "jan", "feb")
 * - last4 = last 4 characters of username
 *
 * Example:
 *   birthday: 1998-03-15
 *   username: AG000123
 *
 *   → day = "15"
 *   → month = "mar"
 *   → last4 = "0123"
 *
 *   Result:
 *   "AG15mar@0123"
 *
 * Parameters:
 * - role (String): role code
 * - birthday (Date or date-compatible string)
 * - username (String): generated username
 *
 * Behavior:
 * - Extracts day from birthday
 * - Converts month to short format ("Jan") then lowercases
 * - Extracts last 4 characters of username
 * - Concatenates into final password string
 *
 * IMPORTANT:
 * - This generates a predictable default password.
 * - Password should be hashed before storing in database.
 */
function generatePassword(role, birthday, username) {
  const date = new Date(birthday);
  const day = String(date.getDate()).padStart(2, "0");
  const month = date
    .toLocaleString("en-US", { month: "short" })
    .toLowerCase();

  const last4 = username.slice(-4);

  return `${role}${day}${month}@${last4}`;
}

module.exports = { generateUsername, generatePassword };
