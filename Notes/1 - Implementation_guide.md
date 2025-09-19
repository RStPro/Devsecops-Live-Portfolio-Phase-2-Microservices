# Phase 2 – Microservices Blog (Local → AWS ECS) – Step‑by‑Step Implementation Guide

**Objective:** Build a production‑ready blog with microservices (Node.js/Express, MongoDB) that runs locally with Docker Compose and then on AWS ECS Fargate (Spot) with a minimal‑cost posture. Shift‑left security and CI/CD from day one. No TypeScript.

---

## Phase 2.0 – Project Scaffolding & Standards
**Goal:** Create repo layout, conventions, tooling, and a minimal running baseline.

**Files/Dirs:** `blog-microservices/` (root), service folders, `docker-compose.yml`, `.editorconfig`, `.gitignore`, `README.md`.

**Steps:**
1) **Create folders**
```
mkdir -p blog-microservices/{api-gateway,users,posts,comments,ui,security,.github/workflows}
cd blog-microservices
```
2) **Editor & Git hygiene**
```
printf "root = true\n[*]\nend_of_line = lf\ninsert_final_newline = true\ncharset = utf-8\nindent_style = space\nindent_size = 2\n" > .editorconfig
printf "node_modules\n.env\n.env.*\n.DS_Store\nmongo_data\n*.log\n" > .gitignore
```
3) **Node & package managers** (macOS via Homebrew, Kali/Ubuntu via apt)
```
# macOS
brew install node jq git docker
# Kali/Ubuntu
sudo apt update && sudo apt install -y nodejs npm jq git docker.io
```
4) **Initialize each service**
```
for d in api-gateway users posts comments ui; do (
  cd $d && npm init -y && cd ..
); done
```
5) **Root README** with project scope and run instructions (keep updated).

**Verification:** Repo tree matches the architecture; `git init && git add . && git commit -m "chore: scaffold phase 2"` works.

**LinkedIn (template):**
> Kicked off Phase 2: scaffolding a Node.js + MongoDB microservices blog with Docker Compose and AWS ECS in sight. Set standards (.editorconfig, .gitignore) and clean repo structure to scale safely. #DevSecOps #Microservices #AWS

---

## Phase 2.1 – Users Service (Auth, JWT, RBAC)
**Goal:** Provide register/login/JWT and roles (`reader`, `author`, `admin`).

**Files:** `users/src/index.js`, `users/src/models/User.js`, `users/package.json`, `users/Dockerfile`, `users/.env.example`.

**Steps:**
1) **Install deps**
```
cd users
npm i express mongoose jsonwebtoken bcrypt body-parser
npm i -D nodemon
```
2) **Minimal server & model** (Express + Mongoose + JWT). Include `/auth/register`, `/auth/login`, `/auth/me`.
3) **Env & script**
```
printf "MONGODB_URI=mongodb://mongo:27017/users\nJWT_SECRET=change-me\nPORT=3001\n" > .env.example
jq '.scripts={"dev":"nodemon src/index.js","start":"node src/index.js"}' package.json | sponge package.json
```
4) **Dockerfile** (alpine, `npm ci`).

**Verification:**
- Local (Compose in Phase 2.6) → register/login returns a JWT; `/auth/me` validates token.

**Security:** Hash passwords (bcrypt), validate inputs, avoid verbose auth errors.

**LinkedIn:**
> Implemented the `users` service with JWT auth and role-based access (`reader/author/admin`). Passwords hashed, inputs validated—foundation for secure write paths. #JWT #RBAC #NodeJS

---

## Phase 2.2 – Posts Service (CRUD)
**Goal:** Authors/admins can create, update, delete posts; anyone with token can read.

**Files:** `posts/src/index.js`, `posts/src/models/Post.js`, `posts/.env.example`, `Dockerfile`.

**Steps:**
1) Install deps: `express mongoose body-parser jsonwebtoken`.
2) Routes: `GET /`, `GET /:id`, `POST /` (author/admin), `PUT /:id` (owner/admin), `DELETE /:id` (owner/admin).
3) Model: `title`, `body`, `authorId`, timestamps.

**Verification:** Create/read/update/delete via curl with JWT from `users`.

**Security:** Authorize by role + ownership; sanitize HTML or enforce Markdown only.

**LinkedIn:**
> The `posts` microservice is live: full CRUD with ownership checks and role gates. Designed for clean separation and future scaling. #Microservices #MongoDB

---

## Phase 2.3 – Comments Service (CRUD)
**Goal:** Token users can comment; authors/admins moderate.

**Files:** `comments/src/index.js`, `comments/src/models/Comment.js`.

**Steps:** Similar to posts. Fields: `postId`, `authorId`, `text`, timestamps. Routes: list by post, add, delete (owner/admin).

**Verification:** Add/list/delete comments tied to posts.

**Security:** Rate-limit comment creation; length caps; basic profanity/abuse filter (optional).

**LinkedIn:**
> Rolled out the `comments` service with JWT-protected endpoints and moderation hooks. Keeping things modular and testable. #APISecurity #Express

---

## Phase 2.4 – API Gateway (Routing, Rate Limit)
**Goal:** Single public entrypoint with path routing to internal services and RBAC enforcement for critical paths.

**Files:** `api-gateway/src/index.js`, `api-gateway/.env.example`, `Dockerfile`.

**Steps:**
1) Install: `express http-proxy-middleware express-rate-limit jsonwebtoken helmet cors`.
2) Add global rate limit (e.g., 120 req/min), CORS, Helmet.
3) Proxy `/auth/* → users`, `/api/posts/* → posts`, `/api/comments/* → comments`.
4) Middleware: `verifyJWT`, `allowRoles('author','admin')` for write routes.

**Verification:** All requests pass through gateway; direct service ports not exposed in prod.

**Security:** Centralize auth checks and request logging; strip hop-by-hop headers.

**LinkedIn:**
> Built an API gateway for path-based routing, rate limiting, and RBAC fan-out. One door in—clean control over traffic and telemetry. #Gateway #RateLimiting

---

## Phase 2.5 – UI (Bootstrap)
**Goal:** Simple client to interact with the gateway: login, list/create posts, list/add comments.

**Files:** `ui/src/index.html`, `ui/src/app.js`, `ui/Dockerfile`.

**Steps:**
1) Use Bootstrap CDN for layout.
2) Minimal login form (stores JWT in memory), list posts, create post (author).
3) Fetch calls → `api-gateway` routes.

**Verification:** End-to-end flow works via browser.

**Security:** No JWT in localStorage for now (store in memory); add CSP & SRI for CDNs.

**LinkedIn:**
> Frontend online with Bootstrap—wireframed the flows for login, posts, and comments via the gateway. Lightweight by design. #Bootstrap #Frontend

---

## Phase 2.6 – Local Orchestration (Docker Compose)
**Goal:** Run complete stack locally.

**Files:** `docker-compose.yml`, each service `.env`.

**Steps:**
1) Add `mongo:7` and named volume `mongo_data`.
2) Define services, port mappings: users:3001, posts:3002, comments:3003, gateway:3000, ui:8080.
3) Create `.env` files from `.env.example`.
4) Start: `docker compose up --build`.

**Verification:**
- Register/login user; create/read posts & comments via gateway. UI reachable at `http://localhost:8080`.

**Security:** Ensure `.env` not committed; use non-root where possible in Dockerfiles.

**LinkedIn:**
> Local environment up with Docker Compose: services + MongoDB running together. Validated end-to-end user → post → comment flow. #Docker #LocalDev

---

## Phase 2.7 – Shift‑Left Security (Pre-commit, SAST/DAST)
**Goal:** Block issues early and automatically.

**Files:** `security/.semgrep.yml`, `.gitleaks.toml`, `.pre-commit-config.yaml`, Git hooks.

**Steps:**
1) Install tools: `pipx install pre-commit` or `pip install pre-commit`, `brew install gitleaks semgrep trivy` (or use Docker images in CI only).
2) Configure pre-commit: ESLint/Prettier, Gitleaks.
3) Add Semgrep ruleset (OWASP Top 10, JWT misuse, NoSQL injection patterns).
4) Plan ZAP Baseline in CI against gateway.

**Verification:** Intentionally add a secret to test Gitleaks rejection; Semgrep flags insecure patterns.

**LinkedIn:**
> Shift-left enabled: pre-commit hooks + Gitleaks + Semgrep + Trivy. Breaking the build on risky changes to keep the main branch clean. #ShiftLeft #SAST #DAST

---

## Phase 2.8 – CI Pipeline (GitHub Actions – Build, Scan)
**Goal:** Automated build, unit tests (if any), image scans, and ZAP baseline on PRs.

**Files:** `.github/workflows/ci.yml`.

**Steps:**
1) Checkout, setup Node 18.
2) `docker build` for each service.
3) Trivy image scans (non-blocking at first; warn-only).
4) ZAP Baseline (PR only) targeting gateway (`http://api-gateway:3000`).

**Verification:** PR triggers pipeline; artifacts/logs show scans.

**LinkedIn:**
> CI is live: building and scanning containers, and running OWASP ZAP baseline on pull requests. Security gates without blocking velocity. #CI #OWASPZAP

---

## Phase 2.9 – AWS Prep (ECR, SSM, VPC, ECS)
**Goal:** Prepare AWS for deployment with minimal cost.

**Steps:**
1) **AWS CLI & Auth** (OIDC from GitHub recommended; otherwise configure keys locally).  
2) **ECR** repos: `users`, `posts`, `comments`, `api-gateway`, `ui`.  
3) **SSM Parameter Store** for `/blog/JWT_SECRET` and MongoDB URIs (Atlas M0).  
4) **VPC** with two public subnets; security groups for ALB and tasks.  
5) **ECS Cluster** (Fargate + Fargate Spot).

**Verification:** ECR repos exist; SSM parameters visible; ECS cluster created.

**LinkedIn:**
> AWS foundations ready: ECR repos, SSM parameters for secrets, and an ECS cluster with Fargate Spot to keep costs lean. #AWS #ECR #ECS

---

## Phase 2.10 – Deploy to ECS (ALB → Gateway; Services Internal)
**Goal:** Public ALB targets **only `api-gateway`**; internal service discovery for others.

**Steps:**
1) **Build & push images** to ECR.  
2) **Task definitions** (256 CPU / 512–1024 MB); inject env from SSM.  
3) **Services:** `api-gateway` (public, behind ALB), `users/posts/comments` (internal).  
4) **ALB listener** :80 → target group (gateway).  
5) **DNS** (optional): Route 53 CNAME to ALB DNS.

**Verification:** Hit ALB DNS → UI → login → CRUD flows OK.

**Security:** Security groups restrictive; no public ports for internal services; no secrets in images.

**LinkedIn:**
> Deployed to ECS Fargate using a single ALB in front of the API gateway. Internal services stay private via service discovery. #Fargate #ALB #Cloud

---

## Phase 2.11 – Observability, Backups, and Cost Controls
**Goal:** Gain visibility, resilience, and predictable spend.

**Steps:**
1) **Logging:** JSON logs; correlation IDs at gateway; ship to CloudWatch.  
2) **Metrics/Alarms:** 4xx/5xx, latency, CPU/mem; alert to email/Slack.  
3) **MongoDB Atlas:** Enable auto-backups (M0 → enable export script weekly).  
4) **Cost:** Use Fargate Spot for non-prod; single AZ initially; turn off unused services.

**Verification:** CloudWatch shows logs/metrics; Atlas backups scheduled and tested restore.

**LinkedIn:**
> Wrapped Phase 2 with observability and backups. CloudWatch metrics/alerts in place and Atlas backups scheduled. Lean, secure, and visible. #Observability #Backups

---

## Universal Commands & Snippets
**Docker Compose:**
```
docker compose up --build
```
**ECR Login & Push (example):**
```
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=eu-west-1
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com
for S in users posts comments api-gateway ui; do
  docker build -t $S ./$S
  docker tag $S:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/blog/$S:latest
  docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/blog/$S:latest
done
```
**SSM Params:**
```
aws ssm put-parameter --name /blog/JWT_SECRET --type SecureString --value 'change-me'
aws ssm put-parameter --name /blog/MONGO_USERS_URI --type String --value '<atlas-users-uri>'
```

---

## Acceptance Criteria per Phase
- **2.0:** Repo scaffolded; standards enforced.  
- **2.1:** `users` issues JWT; `/auth/me` works.  
- **2.2:** `posts` CRUD with RBAC/ownership.  
- **2.3:** `comments` tied to posts; moderation in place.  
- **2.4:** Gateway routes + rate limit; write ops gated.  
- **2.5:** UI performs end‑to‑end flows.  
- **2.6:** `docker compose up` runs full stack locally.  
- **2.7:** Pre‑commit blocks secrets; Semgrep scans pass; Trivy/ZAP wired.  
- **2.8:** CI builds & scans on PR.  
- **2.9:** AWS infra prepared (ECR, SSM, ECS).  
- **2.10:** ECS live via ALB; internal services private.  
- **2.11:** Logs/metrics/alerts + Atlas backups verified.

---

## Backup Note
Export this canvas regularly (copy to your Obsidian/Git repo). Keep a copy of `.env.example` files and CI YAML in the repo. 

