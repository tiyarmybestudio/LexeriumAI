// Parsing & penulisan cookie manual, karena server ini pakai modul "http" bawaan Node
// (tanpa Express/cookie-parser).

export function parseCookies(req) {
  const header = req.headers.cookie;
  const result = {};
  if (!header) return result;

  header.split(";").forEach(pair => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    result[key] = decodeURIComponent(val);
  });

  return result;
}

// Menambahkan Set-Cookie tanpa menghapus Set-Cookie yang sudah diset sebelumnya di response yang sama
export function setCookie(res, name, value, { httpOnly = true, maxAgeMs = null, path = "/" } = {}) {
  let cookieStr = `${name}=${encodeURIComponent(value)}; Path=${path}`;
  if (httpOnly) cookieStr += "; HttpOnly";
  if (maxAgeMs !== null) cookieStr += `; Max-Age=${Math.floor(maxAgeMs / 1000)}`;
  cookieStr += "; SameSite=Lax";
  if (process.env.NODE_ENV === "production") cookieStr += "; Secure";

  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", [cookieStr]);
  } else if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookieStr]);
  } else {
    res.setHeader("Set-Cookie", [existing, cookieStr]);
  }
}
