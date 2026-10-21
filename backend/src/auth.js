import 'dotenv/config';
import crypto from 'node:crypto';
import { httpError } from './db.js';

const TOKEN_HOURS = 12;

let SECRET = process.env.AUTH_SECRET;
if (!SECRET) {
  SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('AUTH_SECRET is not set in .env, so everyone is signed out whenever the server restarts.');
}

// passwords are stored as scrypt$salt$hash, never as plain text
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [kind, salt, hash] = String(stored).split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const real = Buffer.from(hash, 'hex');
  const test = crypto.scryptSync(password, salt, real.length);
  return crypto.timingSafeEqual(real, test);
}

const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export function signToken(user) {
  const body = Buffer.from(
    JSON.stringify({ id: user.id, username: user.username, role: user.role, exp: Date.now() + TOKEN_HOURS * 3600 * 1000 })
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function readToken(token) {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch (e) {
    return null;
  }
}

// puts the signed-in user on req.user (or null). Runs for every request.
export function attachUser(req, res, next) {
  const header = req.headers.authorization || '';
  req.user = header.startsWith('Bearer ') ? readToken(header.slice(7)) : null;
  next();
}

// use on routes that only staff or the admin may call
export function requireAuth(req, res, next) {
  if (!req.user) return next(httpError(401, 'Please sign in.'));
  next();
}
