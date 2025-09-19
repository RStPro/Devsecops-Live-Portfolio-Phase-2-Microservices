import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['reader','author','admin'], default: 'reader' }
}, { timestamps: true });
export default mongoose.model('User', schema);