import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: { type: String, required: true },
  avatar: { type: String }, // base64 dataURL (upload sendiri) atau URL foto profil Google
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);
