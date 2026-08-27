import "dotenv/config";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chat } from "./ai.js";
import { connectDB } from "./db.js";
import {
  verifyGoogleCredential,
  createSessionToken,
  getUserFromSession,
  toPublicUser,
  clearSessionCookie,
  SESSION_COOKIE,
  GUEST_COUNT_COOKIE,
  FREE_MESSAGE_LIMIT,
} from "./auth.js";
import { parseCookies, setCookie } from "./utils/cookies.js";
import User from "./models/User.js";
import Message from "./models/Message.js";
import Conversation from "./models/Conversation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// =========================
// ERROR / DEBUG LOGGER
// =========================
function logError(context, error) {
  console.error("");
  console.error("========== LEXERIUM AI ERROR ==========");
  console.error("Context :", context);

  if (error instanceof Error) {
    console.error("Name    :", error.name);
    console.error("Message :", error.message);
    console.error("Stack   :", error.stack);
  } else {
    console.error("Error   :", error);
  }

  console.error("========================================");
  console.error("");
}

function logInfo(context, data = "") {
  console.log(`[LEXERIUM] ${context}`, data);
}

function sendJson(res, statusCode, payload) {
  try {
    res.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
    });
    res.end(JSON.stringify(payload));
  } catch (err) {
    logError("sendJson", err);
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        logError("JSON body parsing", err);
        reject(err);
      }
    });

    req.on("error", err => {
      logError("Request body", err);
      reject(err);
    });
  });
}

// Judul percakapan otomatis dari pesan pertama (dipotong biar rapi di sidebar)
function buildConversationTitle(prompt) {
  if (!prompt || !prompt.trim()) return "Percakapan baru";
  const clean = prompt.trim().replace(/\s+/g, " ");
  return clean.length > 40 ? clean.slice(0, 40) + "..." : clean;
}

const CONVERSATION_MESSAGES_RE = /^\/api\/conversations\/([a-fA-F0-9]{24})\/messages$/;

const server = http.createServer((req, res) => {
  // REQUEST LOGGER
  logInfo("Request", `${req.method} ${req.url}`);

  // =========================
  // MENAMPILKAN WEBSITE
  // =========================
  if (req.method === "GET" && req.url === "/") {
    const filePath = path.join(__dirname, "public", "index.html");

    fs.readFile(filePath, (err, data) => {
      if (err) {
        logError("Membaca public/index.html", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Gagal membaca index.html");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    });
    return;
  }

  // =========================
  // LOGIN GOOGLE
  // =========================
  if (req.method === "POST" && req.url === "/api/auth/google") {
    (async () => {
      try {
        logInfo("Google login", "Request diterima");
        const data = await readJsonBody(req);

        if (!data.credential) {
          console.error("[LEXERIUM] Google login: credential tidak ada.");
          return sendJson(res, 400, { success: false, message: "credential tidak ada." });
        }

        logInfo("Google login", "Credential diterima, mulai verifikasi");
        const user = await verifyGoogleCredential(data.credential);
        logInfo("Google login", `Google credential valid. User: ${user.email}`);

        const token = createSessionToken(user._id);
        setCookie(res, SESSION_COOKIE, token, { maxAgeMs: THIRTY_DAYS_MS });
        logInfo("Session", "Cookie lx_session berhasil diset");

        setCookie(res, GUEST_COUNT_COOKIE, "0", { maxAgeMs: THIRTY_DAYS_MS });
        logInfo("Session", "Cookie lx_guest_count berhasil direset");

        sendJson(res, 200, { success: true, user: toPublicUser(user) });
        logInfo("Google login", "LOGIN BERHASIL");
      } catch (err) {
        logError("Google authentication", err);
        sendJson(res, 401, { success: false, message: "Token Google tidak valid." });
      }
    })();
    return;
  }

  // =========================
  // LOGOUT
  // =========================
  if (req.method === "POST" && req.url === "/api/auth/logout") {
    clearSessionCookie(res);
    logInfo("Logout", "Sesi dihapus");
    sendJson(res, 200, { success: true });
    return;
  }

  // =========================
  // CEK SESI LOGIN AKTIF
  // =========================
  if (req.method === "GET" && req.url === "/api/auth/me") {
    (async () => {
      try {
        const cookies = parseCookies(req);
        const user = await getUserFromSession(cookies);

        if (!user) {
          return sendJson(res, 401, { success: false });
        }

        logInfo("Session check", `User aktif: ${user.email}`);
        sendJson(res, 200, { success: true, user: toPublicUser(user) });
      } catch (err) {
        logError("Session check /api/auth/me", err);
        sendJson(res, 500, { success: false, message: "Gagal memeriksa sesi." });
      }
    })();
    return;
  }

  // =========================
  // HAPUS AKUN (supaya sesi tidak menumpuk)
  // =========================
  if (req.method === "DELETE" && req.url === "/api/user/account") {
    (async () => {
      try {
        const cookies = parseCookies(req);
        const user = await getUserFromSession(cookies);
        if (!user) return sendJson(res, 401, { success: false, message: "Belum login." });

        const conversations = await Conversation.find({ user: user._id }).select("_id");
        const conversationIds = conversations.map(c => c._id);

        await Message.deleteMany({ user: user._id });
        await Conversation.deleteMany({ user: user._id });
        await User.deleteOne({ _id: user._id });

        clearSessionCookie(res);
        logInfo("Hapus akun", `Akun ${user.email} dan ${conversationIds.length} percakapan dihapus`);
        sendJson(res, 200, { success: true });
      } catch (err) {
        logError("Hapus akun", err);
        sendJson(res, 500, { success: false, message: "Gagal menghapus akun." });
      }
    })();
    return;
  }

  // =========================
  // SIMPAN AVATAR BARU (upload dari gallery)
  // =========================
  if (req.method === "POST" && req.url === "/api/user/avatar") {
    (async () => {
      try {
        const cookies = parseCookies(req);
        const user = await getUserFromSession(cookies);

        if (!user) {
          console.error("[LEXERIUM] Avatar: user belum login.");
          return sendJson(res, 401, { success: false, message: "Belum login." });
        }

        logInfo("Avatar", `Request avatar dari user ${user.email}`);
        const data = await readJsonBody(req);

        if (!data.avatar) {
          console.error("[LEXERIUM] Avatar: avatar kosong.");
          return sendJson(res, 400, { success: false, message: "avatar kosong." });
        }

        user.avatar = data.avatar;
        await user.save();

        logInfo("Avatar", "Avatar berhasil disimpan");
        sendJson(res, 200, { success: true });
      } catch (err) {
        logError("Avatar", err);
        sendJson(res, 400, { success: false, message: "Request tidak valid." });
      }
    })();
    return;
  }

  // =========================
  // DAFTAR PERCAKAPAN (riwayat chat, untuk sidebar)
  // =========================
  if (req.method === "GET" && req.url === "/api/conversations") {
    (async () => {
      try {
        const cookies = parseCookies(req);
        const user = await getUserFromSession(cookies);
        if (!user) return sendJson(res, 401, { success: false, message: "Belum login." });

        const conversations = await Conversation.find({ user: user._id })
          .sort({ updatedAt: -1 })
          .select("_id title updatedAt createdAt");

        sendJson(res, 200, {
          success: true,
          conversations: conversations.map(c => ({
            id: c._id,
            title: c.title,
            updatedAt: c.updatedAt,
          })),
        });
      } catch (err) {
        logError("List conversations", err);
        sendJson(res, 500, { success: false, message: "Gagal mengambil riwayat." });
      }
    })();
    return;
  }

  // =========================
  // ISI SATU PERCAKAPAN (buka riwayat lama)
  // =========================
  const convMatch = req.url.match(CONVERSATION_MESSAGES_RE);
  if (req.method === "GET" && convMatch) {
    (async () => {
      try {
        const cookies = parseCookies(req);
        const user = await getUserFromSession(cookies);
        if (!user) return sendJson(res, 401, { success: false, message: "Belum login." });

        const conversationId = convMatch[1];
        const conversation = await Conversation.findOne({ _id: conversationId, user: user._id });
        if (!conversation) {
          return sendJson(res, 404, { success: false, message: "Percakapan tidak ditemukan." });
        }

        const messages = await Message.find({ conversation: conversationId }).sort({ createdAt: 1 });

        sendJson(res, 200, {
          success: true,
          conversation: { id: conversation._id, title: conversation.title },
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            imageUrl: m.imageUrl || null,
            isAudio: !!m.isAudio,
          })),
        });
      } catch (err) {
        logError("Get conversation messages", err);
        sendJson(res, 500, { success: false, message: "Gagal mengambil percakapan." });
      }
    })();
    return;
  }

  // =========================
  // API CHAT AI (teks, gambar, transkrip audio)
  // =========================
  if (req.method === "POST" && req.url === "/api/chat") {
    (async () => {
      try {
        logInfo("Chat", "Request chat diterima");
        const data = await readJsonBody(req);
        // data.prompt         : teks pesan (juga dipakai untuk hasil transkrip audio)
        // data.image          : base64 dataURL gambar (opsional)
        // data.isAudio        : true jika prompt berasal dari transkrip suara
        // data.conversationId : id percakapan yang sedang aktif (opsional, khusus user login)

        if (!data.prompt && !data.image) {
          console.error("[LEXERIUM] Chat: prompt dan image kosong.");
          return sendJson(res, 400, { success: false, message: "Prompt kosong." });
        }

        const cookies = parseCookies(req);
        const user = await getUserFromSession(cookies);

        if (user) {
          logInfo("Chat", `User login: ${user.email}`);
        } else {
          logInfo("Chat", "Request dari guest");
        }

        // ===== BATASI 3 PESAN GRATIS UNTUK TAMU (belum login) =====
        if (!user) {
          const guestCount = parseInt(cookies[GUEST_COUNT_COOKIE] || "0", 10);
          logInfo("Guest limit", `Pemakaian guest: ${guestCount}/${FREE_MESSAGE_LIMIT}`);

          if (guestCount >= FREE_MESSAGE_LIMIT) {
            console.error("[LEXERIUM] Guest sudah mencapai batas pesan.");
            return sendJson(res, 403, {
              success: false,
              requireLogin: true,
              message: "Silakan login dengan Google untuk melanjutkan chat.",
            });
          }
          setCookie(res, GUEST_COUNT_COOKIE, String(guestCount + 1), { maxAgeMs: THIRTY_DAYS_MS });
        }

        logInfo("Chat", "Mengirim request ke AI");
        const result = await chat(data.prompt, { imageDataUrl: data.image });
        logInfo("Chat", `AI selesai. Success: ${result.success}`);

        let conversationId = null;

        // Simpan riwayat chat ke MongoDB — hanya untuk user yang sudah login
        if (user) {
          let conversation = null;

          if (data.conversationId) {
            conversation = await Conversation.findOne({ _id: data.conversationId, user: user._id });
          }
          if (!conversation) {
            conversation = await Conversation.create({
              user: user._id,
              title: buildConversationTitle(data.prompt),
            });
            logInfo("Database", `Percakapan baru dibuat: ${conversation._id}`);
          }
          conversationId = conversation._id;

          logInfo("Database", "Menyimpan pesan user");
          await Message.create({
            user: user._id,
            conversation: conversation._id,
            role: "user",
            content: data.prompt || "",
            imageUrl: data.image || undefined,
            isAudio: !!data.isAudio,
          });

          if (result.success) {
            logInfo("Database", "Menyimpan response AI");
            await Message.create({
              user: user._id,
              conversation: conversation._id,
              role: "ai",
              content: result.response,
            });
          }

          conversation.updatedAt = new Date();
          await conversation.save();
          logInfo("Database", "Riwayat chat berhasil disimpan");
        }

        sendJson(res, result.success ? 200 : 500, { ...result, conversationId });
      } catch (error) {
        logError("API Chat", error);
        sendJson(res, 400, { success: false, message: "Request tidak valid." });
      }
    })();
    return;
  }

  // =========================
  // 404
  // =========================
  console.error(`[LEXERIUM] 404 - Route tidak ditemukan: ${req.method} ${req.url}`);
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404 Not Found");
});

// =========================
// GLOBAL SERVER ERROR
// =========================
server.on("error", err => {
  logError("HTTP Server", err);
});

// =========================
// DATABASE + SERVER START
// =========================
connectDB()
  .then(() => {
    logInfo("MongoDB", "Koneksi database berhasil");

    server.listen(PORT, "0.0.0.0", () => {
      console.log("");
      console.log("================================");
      console.log("        Lexerium AI Server");
      console.log("================================");
      console.log("");
      console.log(`Web: http://localhost:${PORT}`);
      console.log("");
      console.log("[LEXERIUM] Debug logging aktif");
      console.log("");
    });
  })
  .catch(err => {
    logError("Startup / MongoDB", err);
    process.exit(1);
  });

// =========================
// GLOBAL PROCESS ERROR
// =========================
process.on("uncaughtException", err => {
  logError("Uncaught Exception", err);
});

process.on("unhandledRejection", reason => {
  logError("Unhandled Rejection", reason);
});
