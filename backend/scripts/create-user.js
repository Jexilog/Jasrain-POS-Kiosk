// Adds a user, or changes the password if the username already exists.
// Usage: node scripts/create-user.js <username> <password> [Administrator|Staff]
import { pool } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

const [username, password, role = 'Administrator'] = process.argv.slice(2);

if (!username || !password || !['Administrator', 'Staff'].includes(role)) {
  console.log('Usage: node scripts/create-user.js <username> <password> [Administrator|Staff]');
  process.exit(1);
}
if (password.length < 6) {
  console.log('Use a password with at least 6 characters.');
  process.exit(1);
}

await pool.query(
  `INSERT INTO admin_user (username, password_hash, role) VALUES (?, ?, ?)
   ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role)`,
  [username, hashPassword(password), role]
);
console.log(`Saved user "${username}" (${role}).`);
await pool.end();
