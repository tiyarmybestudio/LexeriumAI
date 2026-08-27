import mongoose from "mongoose";

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.warn("MONGODB_URI belum diatur di .env — fitur login & riwayat chat tidak akan berfungsi.");
    return;
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] Terputus dari database.");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("[MongoDB] Berhasil tersambung kembali.");
  });

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("MongoDB terhubung.");
  } catch (err) {
    console.error("");
    console.error("========== MONGODB GAGAL KONEK ==========");
    console.error("Pesan:", err.message);
    console.error("===========================================");
    console.error("");
    throw err;
  }
}
