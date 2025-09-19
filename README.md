# Microservices Blog – DevSecOps Live Portfolio (Phase 2)

This repository contains a **blog application** built with **Node.js microservices** and **MongoDB**, developed as part of the DevSecOps Live Portfolio series.

## Services

* **api-gateway** – single entry point, JWT verification, RBAC enforcement, rate limiting.
* **users** – authentication, registration, login, JWT issuance, role management.
* **posts** – CRUD operations for blog posts, ownership checks.
* **comments** – CRUD for comments, tied to posts, moderation support.
* **ui** – Bootstrap frontend to interact with the API.

## Local Development

1. Copy `.env.example` ➜ `.env` in each service folder.
2. Start the stack:

   ```bash
   docker compose up --build
   ```
3. Access:

   * UI: [http://localhost:8080](http://localhost:8080)
   * API Gateway: [http://localhost:3000](http://localhost:3000)

## Security & CI/CD

* **Shift-left:** Gitleaks (secrets), Semgrep (SAST), Trivy (container scan), OWASP ZAP (DAST).
* **GitHub Actions:** CI pipeline builds and scans images; deploy pipeline pushes to AWS ECR and updates ECS services.

## Deployment (AWS ECS Fargate)

* Minimal-cost posture with **Fargate Spot** and a single **ALB**.
* Secrets stored in **SSM Parameter Store**.
* MongoDB on **Atlas Free Tier (M0)**.
