import axios from "axios";

const AI_URL = "https://api.rewind.ai/v1/chat/completions/";
const TEXT_MODEL = process.env.AI_TEXT_MODEL || "qwen/qwen-2.5-7b-instruct";
const VISION_MODEL = process.env.AI_VISION_MODEL || "qwen/qwen2.5-vl-7b-instruct";

// ===== JAWABAN TETAP UNTUK PERTANYAAN "SIAPA YANG MENCIPTAKANMU" =====
// Kalau prompt cocok dengan salah satu pola ini, AI TIDAK dipanggil sama sekali —
// jawaban di bawah langsung dikembalikan.
const CREATOR_ANSWER = `Halo. Saya adalah Lexerium AI yang diciptakan oleh Tiyarmybe, seorang kreator dan pengembang yang membangun saya dengan visi untuk menghadirkan kecerdasan buatan yang kreatif, adaptif, dan terus berkembang.

Creator: Tiyarmybe
Email: tiyarmybestudio@gmail.com

Saya bukan sekadar AI biasa. Saya adalah hasil dari ide, kreativitas, dan eksperimen yang dikembangkan oleh pencipta saya. Setiap pertanyaan yang diberikan kepada saya akan saya proses untuk menghasilkan jawaban yang informatif, kreatif, dan membantu.

Jika kamu sedang membaca pesan ini, berarti sistem saya telah berhasil aktif.

«"Created by Tiyarmybe. Powered by imagination."»

— LEXAI
AI created by Tiyarmybe Studio`;

// Daftar pola pemicu (huruf kecil, tanpa tanda baca) — tambahkan variasi lain di sini jika perlu
const CREATOR_TRIGGERS = [
  "siapa yang menciptakanmu",
  "siapa yang menciptakan mu",
  "siapa yang menciptakan kamu",
  "siapa yang membuat kamu",
  "siapa yang membuatmu",
  "siapa pembuatmu",
  "siapa penciptamu",
  "who created you",
  "who made you",
  "who is your creator",
];

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[?!.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesCreatorQuestion(prompt) {
  const n = normalize(prompt);
  return CREATOR_TRIGGERS.some(trigger => n.includes(trigger));
}

// ===== CHAT UTAMA =====
// options.imageDataUrl: base64 data URL gambar (opsional) — jika ada, dikirim ke model vision
export async function chat(prompt, options = {}) {
  const { imageDataUrl } = options;

  if (!prompt?.trim() && !imageDataUrl) {
    return { success: false, message: "Prompt tidak boleh kosong." };
  }

  // Override kata kunci — dicek sebelum memanggil AI eksternal
  if (prompt && matchesCreatorQuestion(prompt)) {
    return { success: true, response: CREATOR_ANSWER };
  }

  try {
    let messages;
    let model;

    if (imageDataUrl) {
      // Format pesan multimodal (mengikuti konvensi OpenAI-compatible vision API).
      // PENTING: pastikan model di AI_VISION_MODEL memang mendukung input gambar
      // di provider yang kamu pakai — cek dokumentasi provider (rewind.ai) untuk formatnya.
      model = VISION_MODEL;
      messages = [
        {
          role: "user",
          content: [
            { type: "text", text: prompt?.trim() || "Tolong jelaskan gambar ini." },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ];
    } else {
      model = TEXT_MODEL;
      messages = [{ role: "user", content: prompt }];
    }

    const response = await axios.post(
      AI_URL,
      { model, messages, stream: false },
      { headers: { "Content-Type": "application/json" }, timeout: 60000 }
    );

    const result = response.data?.choices?.[0]?.message?.content;

    if (!result) {
      return { success: false, message: "AI tidak memberikan response." };
    }

    return { success: true, response: result };
  } catch (error) {
    console.error("AI ERROR:", error.response?.data || error.message);

    return {
      success: false,
      message:
        error.response?.data?.error?.message ||
        error.message ||
        "Gagal menghubungi AI.",
    };
  }
}
