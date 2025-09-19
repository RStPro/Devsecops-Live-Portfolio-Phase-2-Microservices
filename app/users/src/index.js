import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import User from './models/User.js';

const app = express();
app.use(bodyParser.json());

const { MONGODB_URI, JWT_SECRET, PORT = 3001 } = process.env;
await mongoose.connect(MONGODB_URI);

app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, role = 'reader' } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hash, role });
    res.status(201).json({ id: user._id, email: user.email, role: user.role });
  } catch (e) {
    res.status(400).json({ error: 'cannot register', detail: e.message });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const u = await User.findOne({ email });
  if (!u) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, u.password);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ sub: u._id, role: u.role, email: u.email }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

app.get('/auth/me', (req, res) => {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try { const payload = jwt.verify(token, JWT_SECRET); res.json(payload); }
  catch { res.status(401).json({ error: 'invalid token' }); }
});

app.listen(PORT, () => console.log(`users on :${PORT}`));