# Phase 2 – Starter Files & Integration Guide (use with your **existing** repo)

This canvas gives you **drop‑in files** and a **step‑by‑step** to wire the microservices blog into your current repository, runnable on macOS/Ubuntu/Kali and deployable to AWS ECS (Fargate). No TypeScript. MongoDB. Shift‑left security from day one.

---

## 0) Branch & prerequisites
- Create a feature branch:
```
git checkout -b feat/phase-2-starter
```
- Ensure Docker Desktop (macOS) or `docker.io` (Linux) is installed and running.
- Node.js 18+ and npm 10+
- Optional: `jq`, `pre-commit`, `gitleaks`, `semgrep`, `trivy`

---

## 1) Directory layout (add if missing)
```
api-gateway/
users/
posts/
comments/
ui/
security/
.github/workflows/
```

---

## 2) USERS service (Auth/JWT/RBAC)
**users/package.json**
```json
{
  "name": "users",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "body-parser": "^1.20.3",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^7.8.1"
  },
  "devDependencies": { "nodemon": "^3.1.0" }
}
```

**users/src/models/User.js**
```js
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['reader','author','admin'], default: 'reader' }
}, { timestamps: true });
export default mongoose.model('User', schema);
```

**users/src/index.js**
```js
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
```

**users/.env.example**
```
MONGODB_URI=mongodb://mongo:27017/users
JWT_SECRET=change-me
PORT=3001
```

**users/Dockerfile**
```Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3001
USER node
CMD ["node","src/index.js"]
```

---

## 3) POSTS service (CRUD)
**posts/package.json**
```json
{
  "name": "posts",
  "version": "0.1.0",
  "type": "module",
  "scripts": { "start": "node src/index.js" },
  "dependencies": {
    "body-parser": "^1.20.3",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^7.8.1"
  }
}
```

**posts/src/models/Post.js**
```js
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  authorId: { type: String, required: true }
}, { timestamps: true });
export default mongoose.model('Post', schema);
```

**posts/src/index.js**
```js
import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Post from './models/Post.js';

const app = express();
app.use(bodyParser.json());
const { MONGODB_URI, PORT = 3002, JWT_SECRET } = process.env;
await mongoose.connect(MONGODB_URI);

const auth = (req, res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' });
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next(); } catch { res.status(401).json({ error: 'bad token' }); }
};
const allow = (...roles) => (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'forbidden' });

app.get('/', async (_req, res) => res.json(await Post.find().sort({ createdAt: -1 })));
app.get('/:id', async (req, res) => {
  const p = await Post.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});
app.post('/', auth, allow('author','admin'), async (req, res) => {
  const { title, body } = req.body;
  const p = await Post.create({ title, body, authorId: req.user.sub });
  res.status(201).json(p);
});
app.put('/:id', auth, async (req, res) => {
  const p = await Post.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (String(p.authorId) !== req.user.sub && req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  p.title = req.body.title ?? p.title; p.body = req.body.body ?? p.body; await p.save();
  res.json(p);
});
app.delete('/:id', auth, async (req, res) => {
  const p = await Post.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (String(p.authorId) !== req.user.sub && req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  await p.deleteOne();
  res.status(204).end();
});

app.listen(PORT, () => console.log(`posts on :${PORT}`));
```

**posts/.env.example**
```
MONGODB_URI=mongodb://mongo:27017/posts
PORT=3002
JWT_SECRET=change-me
```

**posts/Dockerfile**
```Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3002
USER node
CMD ["node","src/index.js"]
```

---

## 4) COMMENTS service (CRUD)
**comments/package.json**
```json
{
  "name": "comments",
  "version": "0.1.0",
  "type": "module",
  "scripts": { "start": "node src/index.js" },
  "dependencies": {
    "body-parser": "^1.20.3",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^7.8.1"
  }
}
```

**comments/src/models/Comment.js**
```js
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  postId: { type: String, required: true },
  authorId: { type: String, required: true },
  text: { type: String, required: true, maxlength: 2000 }
}, { timestamps: true });
export default mongoose.model('Comment', schema);
```

**comments/src/index.js**
```js
import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Comment from './models/Comment.js';

const app = express();
app.use(bodyParser.json());
const { MONGODB_URI, PORT = 3003, JWT_SECRET } = process.env;
await mongoose.connect(MONGODB_URI);

const auth = (req, res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' });
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next(); } catch { res.status(401).json({ error: 'bad token' }); }
};

app.get('/post/:postId', async (req, res) => {
  res.json(await Comment.find({ postId: req.params.postId }).sort({ createdAt: -1 }));
});
app.post('/', auth, async (req, res) => {
  const { postId, text } = req.body;
  const c = await Comment.create({ postId, text, authorId: req.user.sub });
  res.status(201).json(c);
});
app.delete('/:id', auth, async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  if (String(c.authorId) !== req.user.sub && req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  await c.deleteOne();
  res.status(204).end();
});

app.listen(PORT, () => console.log(`comments on :${PORT}`));
```

**comments/.env.example**
```
MONGODB_URI=mongodb://mongo:27017/comments
PORT=3003
JWT_SECRET=change-me
```

**comments/Dockerfile**
```Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3003
USER node
CMD ["node","src/index.js"]
```

---

## 5) API GATEWAY (routing, rate limit, security headers)
**api-gateway/package.json**
```json
{
  "name": "api-gateway",
  "version": "0.1.0",
  "type": "module",
  "scripts": { "start": "node src/index.js" },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "http-proxy-middleware": "^3.0.0",
    "jsonwebtoken": "^9.0.2"
  }
}
```

**api-gateway/src/index.js**
```js
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import cors from 'cors';

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use(limiter);

const { JWT_SECRET, PORT = 3000 } = process.env;
const verify = (req, res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' });
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); return next(); }
  catch { return res.status(401).json({ error: 'bad token' }); }
};
const allow = (...roles) => (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'forbidden' });

// Public auth routes → users
app.use('/auth', createProxyMiddleware({ target: 'http://users:3001', changeOrigin: true }));

// Posts & comments require auth
app.use('/api/posts', verify, createProxyMiddleware({ target: 'http://posts:3002', changeOrigin: true, pathRewrite: { '^/api/posts': '/' } }));
app.use('/api/comments', verify, createProxyMiddleware({ target: 'http://comments:3003', changeOrigin: true, pathRewrite: { '^/api/comments': '/' } }));

// Example gate: POST /api/posts only for author/admin
app.post('/api/posts', verify, allow('author','admin'), (req, res) => res.status(204).end());

app.listen(PORT, () => console.log(`gateway on :${PORT}`));
```

**api-gateway/.env.example**
```
JWT_SECRET=change-me
PORT=3000
```

**api-gateway/Dockerfile**
```Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node","src/index.js"]
```

---

## 6) UI (Bootstrap minimal)
**ui/package.json**
```json
{ "name": "ui", "version": "0.1.0", "scripts": { "start": "node src/app.js" }, "type": "module", "dependencies": { "express": "^4.19.2" } }
```

**ui/src/index.html**
```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Blog UI</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"/>
</head>
<body class="container py-4">
  <h1 class="mb-3">Microservices Blog</h1>
  <div class="mb-3">
    <input id="email" class="form-control mb-2" placeholder="email" />
    <input id="password" type="password" class="form-control mb-2" placeholder="password" />
    <button id="login" class="btn btn-primary">Login</button>
  </div>
  <div id="me" class="mb-3"></div>
  <hr/>
  <h3>Posts</h3>
  <div class="mb-3">
    <input id="title" class="form-control mb-2" placeholder="title" />
    <textarea id="body" class="form-control mb-2" placeholder="body"></textarea>
    <button id="create" class="btn btn-success">Create Post</button>
  </div>
  <ul id="posts" class="list-group"></ul>
  <script>
    let token = null;
    const gateway = location.origin.replace(':8080', ':3000');
    document.getElementById('login').onclick = async () => {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const r = await fetch(gateway + '/auth/login', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email, password }) });
      const j = await r.json(); token = j.token; document.getElementById('me').innerText = token ? 'Logged in' : 'Login failed';
      loadPosts();
    };
    async function loadPosts(){
      const r = await fetch(gateway + '/api/posts', { headers: { Authorization: 'Bearer ' + token } });
      const j = await r.json(); const ul = document.getElementById('posts'); ul.innerHTML = '';
      j.forEach(p => { const li = document.createElement('li'); li.className='list-group-item'; li.textContent = p.title + ' – ' + new Date(p.createdAt).toLocaleString(); ul.appendChild(li); });
    }
    document.getElementById('create').onclick = async () => {
      const title = document.getElementById('title').value; const body = document.getElementById('body').value;
      await fetch(gateway + '/api/posts', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + token }, body: JSON.stringify({ title, body }) });
      loadPosts();
    };
  </script>
</body>
</html>
```

**ui/src/app.js**
```js
import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.get('/', (_req, res) => res.send(readFileSync(join(__dirname,'index.html'),'utf8')));
app.listen(8080, () => console.log('ui on :8080'));
```

**ui/Dockerfile**
```Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8080
USER node
CMD ["node","src/app.js"]
```

---

## 7) Docker Compose (local all-in-one)
**docker-compose.yml**
```yaml
version: "3.9"
services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    ports: ["27017:27017"]
    volumes: ["mongo_data:/data/db"]

  users:
    build: ./users
    env_file: ./users/.env
    depends_on: [mongo]
    ports: ["3001:3001"]

  posts:
    build: ./posts
    env_file: ./posts/.env
    depends_on: [mongo]
    ports: ["3002:3002"]

  comments:
    build: ./comments
    env_file: ./comments/.env
    depends_on: [mongo]
    ports: ["3003:3003"]

  api-gateway:
    build: ./api-gateway
    env_file: ./api-gateway/.env
    depends_on: [users, posts, comments]
    ports: ["3000:3000"]

  ui:
    build: ./ui
    depends_on: [api-gateway]
    ports: ["8080:8080"]

volumes:
  mongo_data:
```

Create `.env` files by copying the provided `.env.example` in each service and adjusting values.

Run locally:
```
docker compose up --build
# UI http://localhost:8080
```

---

## 8) Security baseline configs
**security/.semgrep.yml** (minimal starter)
```yaml
rules:
  - id: jwt-hardcoded-secret
    patterns:
      - pattern: jwt.sign(..., "$SECRET", ...)
    message: Avoid hardcoding JWT secrets
    severity: ERROR
    languages: [javascript]
  - id: no-eval
    pattern: eval(...)
    message: Avoid eval
    severity: ERROR
    languages: [javascript]
```

**.gitleaks.toml** (basic)
```toml
[allowlist]
paths = ["README.md", "**/*.md"]

[[rules]]
id = "generic-api-key"
regex = '''(?i)(api|secret|token)_?key\s*[:=]\s*['\"][a-z0-9-_]{16,}['\"]'''
entropy = 3.5
```

**.pre-commit-config.yaml** (optional but recommended)
```yaml
repos:
- repo: https://github.com/pre-commit/pre-commit-hooks
  rev: v4.6.0
  hooks: [ {id: end-of-file-fixer}, {id: trailing-whitespace} ]
- repo: https://github.com/gitleaks/gitleaks
  rev: v8.18.4
  hooks: [ { id: gitleaks } ]
```

---

## 9) GitHub Actions (CI) – build & scan
**.github/workflows/ci.yml**
```yaml
name: CI
on:
  pull_request:
  push: { branches: [ main ] }
jobs:
  build-and-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18' }
      - name: Build images
        run: |
          docker build -t users ./users
          docker build -t posts ./posts
          docker build -t comments ./comments
          docker build -t api-gateway ./api-gateway
          docker build -t ui ./ui
      - name: Trivy scan (gateway)
        uses: aquasecurity/trivy-action@0.20.0
        with:
          image-ref: api-gateway
          format: 'table'
          exit-code: '0'
```

(You can extend with Semgrep/Gitleaks/ZAP as in earlier canvases.)

---

## 10) ECS Deployment workflow (skeleton)
**.github/workflows/deploy-ecs.yml**
```yaml
name: Deploy ECS
on:
  workflow_dispatch:
  push:
    branches: [ main ]
    paths: [ 'api-gateway/**','users/**','posts/**','comments/**','ui/**' ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-region: eu-west-1
          role-to-assume: ${{ secrets.AWS_OIDC_ROLE }}
      - uses: aws-actions/amazon-ecr-login@v2
        id: ecr
      - name: Build & push
        run: |
          REG=${{ steps.ecr.outputs.registry }}
          for S in users posts comments api-gateway ui; do
            docker build -t $S ./$S
            docker tag $S:latest $REG/blog/$S:latest
            docker push $REG/blog/$S:latest
          done
      - name: Update ECS services
        run: |
          aws ecs update-service --cluster blog --service api-gateway --force-new-deployment
          aws ecs update-service --cluster blog --service users --force-new-deployment
          aws ecs update-service --cluster blog --service posts --force-new-deployment
          aws ecs update-service --cluster blog --service comments --force-new-deployment
          aws ecs update-service --cluster blog --service ui --force-new-deployment
```

---

## 11) Commit & smoke test
```
# copy .env.example ➜ .env for each service (adjust secrets)
cp users/.env.example users/.env
cp posts/.env.example posts/.env
cp comments/.env.example comments/.env
cp api-gateway/.env.example api-gateway/.env

docker compose up --build
# Register → Login → Create Post → List Posts → Add Comment
```
If all good:
```
git add .
git commit -m "feat(phase-2): starter services, gateway, UI, compose, CI"
git push -u origin feat/phase-2-starter
```

---

## 12) LinkedIn (Phase 2.0 delivered)
> **Phase 2 – Baseline shipped ✅**  
> Added a Node.js + MongoDB microservices baseline (users, posts, comments, API gateway, Bootstrap UI) with Docker Compose and CI builds. Next: shift-left scans, ECR push, and ECS Fargate deployment. #DevSecOps #Microservices #AWS #MongoDB

---

## 13) Changes made vs. previous canvases (summary)
- Materialized the plan into concrete **starter files** for all services, gateway, UI, Compose, and CI skeletons.  
- Ensured compatibility (macOS/Ubuntu/Kali), **no TypeScript**, and **MongoDB** across services.  
- Added secure defaults (JWT, bcrypt, helmet, rate limiting, non-root containers).  
- Prepared your repo to run **locally today** and to **deploy to ECS** with minimal edits.

