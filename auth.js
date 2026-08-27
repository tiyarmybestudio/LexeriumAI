import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import User from "./models/User.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const SESSION_COOKIE = "lx_session";
export const GUEST_COUNT_COOKIE = "lx_guest_count";
export const FREE_MESSAGE_LIMIT = 3;

// Verifikasi credential (ID token) dari Google Identity Services di frontend,
// lalu cari atau buat user baru di MongoDB.
export async function verifyGoogleCredential(credential) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  let user = await User.findOne({ googleId: payload.sub });
  if (!user) {
    user = await User.create({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatar: payload.picture,
    });
  }
  return user;
}

export function createSessionToken(userId) {
  return jwt.sign({ uid: userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

// Mengembalikan user dari cookie sesi, atau null kalau tidak login/tidak valid
export async function getUserFromSession(cookies) {
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.uid);
    return user || null;
  } catch (err) {
    return null;
  }
}

export function toPublicUser(user) {
  return { id: user._id, name: user.name, email: user.email, avatar: user.avatar };
}

// Menghapus cookie sesi (dipakai untuk logout maupun setelah hapus akun)
export function clearSessionCookie(res) {
  const expired = `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`;
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", [expired]);
  } else if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, expired]);
  } else {
    res.setHeader("Set-Cookie", [existing, expired]);
  }
}
