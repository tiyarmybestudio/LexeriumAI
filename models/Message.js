import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  role: { type: String, enum: ["user", "ai"], required: true },
  content: { type: String, default: "" },
  imageUrl: { type: String }, // base64 dataURL gambar yang dikirim user, jika ada
  isAudio: { type: Boolean, default: false }, // true jika pesan berasal dari transkrip suara
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Message", messageSchema);
