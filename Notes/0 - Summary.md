# Phase 2 – Blog Microservices (Local → AWS ECS)

**Repo Description (≤350 chars)**  
Blog built as Node.js microservices (api-gateway, users, posts, comments, ui) with MongoDB, JWT auth, RBAC, and shift-left security (Semgrep, Gitleaks, Trivy, ZAP). Run locally via Docker Compose; deploy cost‑minimized to AWS ECS Fargate (Spot) with one ALB and SSM-managed secrets.

---

## 1) Architecture & Principles
- **Services:** `api-gateway`, `users`, `posts`, `comments`, `ui` (Bootstrap).  
- **Stack:** Node.js (no TS), Express, MongoDB (separate DB per service).  
- **Auth/RBAC:** JWT via **users**, roles: `reader`, `author`, `admin`.  
- **Gateway:** Path routing + rate limit; internal fan-out to services.  
- **Shift-left:** Semgrep, Gitleaks, Trivy, ZAP baseline in CI.  
- **Compat:** macOS / Ubuntu / Kali; Docker Compose; later ECS Fargate (Spot).  
- **Secrets:** `.env` locally; **AWS SSM Parameter Store** in cloud.

---

## 2) Repo Layout
```
blog-microservices/
  api-gateway/
    src/ (index.js, routes.js)
    Dockerfile
    package.json
    .env.example
  users/
    src/ (index.js, models/User.js)
    Dockerfile
    package.json
    .env.example
  posts/
    src/ (index.js, models/Post.js)
    Dockerfile
    package.json
    .env.example
  comments/
    src/ (index.js, models/Comment.js)
    Dockerfile
    package.json
    .env.example
  ui/
    src/ (index.html, app.js)
    Dockerfile
    package.json
  security/ (.semgrep.yml, .gitleaks.toml)
  .github/workflows/ (ci.yml, deploy-ecs.yml)
  docker-compose.yml
  README.md
```

---

## 3) Minimal Environment
**users/.env**
```
MONGODB_URI=mongodb://mongo:27017/users
JWT_SECRET=change-me
PORT=3001
```
**posts/.env**
```
MONGODB_URI=mongodb://mongo:27017/posts
PORT=3002
```
**comments/.env**
```
MONGODB_URI=mongodb://mongo:27017/comments
PORT=3003
```
**api-gateway/.env**
```
JWT_SECRET=change-me
PORT=3000
```

---

## 4) Local Run (Docker Compose)
**docker-compose.yml (summary)**
- `mongo:7` exposed on `27017` (named volume `mongo_data`).  
- Build and run all services, mapped ports: users `3001`, posts `3002`, comments `3003`, gateway `3000`, ui `8080`.

**Commands**
```bash
docker compose up --build
# UI: http://localhost:8080
# API via gateway: http://localhost:3000
```

**Smoke Test**
```bash
# Register user (author)
curl -X POST http://localhost:3001/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"pw","role":"author"}'
# Login → get JWT
token=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"pw"}' | jq -r .token)
# Use JWT against posts
curl -H "Authorization: Bearer $token" http://localhost:3000/api/posts
```

---

## 5) Security: Shift‑Left Baseline
- **Pre-commit:** ESLint/Prettier, Commitlint, Gitleaks.  
- **SAST:** Semgrep (`security/.semgrep.yml`).  
- **Dependency:** `npm audit --production --audit-level=high`.  
- **Container:** Trivy scan on each built image.  
- **DAST:** OWASP ZAP Baseline against gateway URL in CI.

**CI (high-level)**
```
- checkout
- setup-node 18
- semgrep action
- gitleaks action
- docker build images
- trivy scan
- (PR) zaproxy baseline
```

---

## 6) AWS ECS (Minimal‑Cost Path)
- **Cluster:** ECS Fargate with **Fargate Spot** for dev/stage.  
- **Networking:** VPC + 2 public subnets (start simple).  
- **ALB:** Single ALB → **only `api-gateway`** public; other services internal.  
- **Images:** Push to **ECR**.  
- **Config/Secrets:** **SSM Parameter Store** (`/blog/*`).  
- **MongoDB:** Atlas **M0** (free tier) per service DB.

**Key AWS Steps**
```
1) aws ecr create-repository (users, posts, comments, api-gateway, ui)
2) docker login to ECR; build/tag/push images
3) Create ECS cluster + task defs (256 CPU / 512–1024 MB)
4) Create ALB + TG for api-gateway; listener :80 → TG
5) SSM parameters: /blog/JWT_SECRET, /blog/MONGO_*_URI
6) Services: api-gateway (public), others (internal via service discovery)
```

---

## 7) Backups & Ops Hygiene
- **Git:** push often; enable branch protection; keep `.env` out of git.  
- **DB:** enable Atlas auto‑backups; export weekly JSON as fallback.  
- **Logs:** JSON logs; correlation IDs in gateway; log only necessary info.  
- **Monitoring:** CloudWatch Logs/Metrics; basic alarms on 4xx/5xx rates.

---

## 8) Next Steps
- Implement CRUD for `posts` and `comments` (Express + Mongoose).  
- Add input validation (Joi/Zod), CORS/CSP, helmet.  
- Wire GitHub Actions → ECR/ECS deploy (OIDC, no long‑lived keys).  
- Add RBAC checks for author/admin on write ops.  
- Add rate‑limit per token/IP in gateway.

---

## 9) LinkedIn Post (Phase 2 Kickoff)
> **DevSecOps Series – Phase 2 started**  
> Hoje iniciei a construção de um blog em **microserviços** com **Node.js + MongoDB**, **gateway API**, **RBAC**, e **shift-left security** (Semgrep, Gitleaks, Trivy, ZAP). Primeiro em **Docker Compose** local, depois **ECS Fargate** (Spot) na AWS com um único **ALB** para reduzir custos. Próximo passo: pipeline CI/CD completo e observabilidade. #DevSecOps #AWS #ECS #Fargate #MongoDB

---

## 10) Checklist (Quick Start)
- [ ] Clone repo & create `.env` files for each service  
- [ ] `docker compose up --build` (local)  
- [ ] Register/login user; validate JWT flow  
- [ ] Enable pre-commit hooks; run SAST/DAST locally  
- [ ] Create ECR repos; push images  
- [ ] Create ECS cluster, ALB, services (gateway public)  
- [ ] Store secrets in SSM; connect to Atlas M0  
- [ ] Verify ALB DNS end-to-end

