# MedAssist AI — AI-Based Health Diagnosis System

Web application implementation of the **CS3CO40(P) Software Engineering Laboratory — Experiment 2 SRS** (*AI Based Health Diagnosis System*).

> **Medical Disclaimer:** This application is a decision-support and preliminary screening tool only. It does **not** provide a confirmed medical diagnosis or replace a qualified healthcare professional.

## Quick Start

- **Option 1 (Direct Browser Open):** Double-click `index.html` to open directly in Chrome, Edge, Firefox, or Safari.
- **Option 2 (Local HTTP Server on Windows — Zero Dependencies):** Run `start.bat` (or `powershell -ExecutionPolicy Bypass -File server.ps1`) and open `http://localhost:8090`.

## Demo Accounts (All 4 SRS User Classes)

| Role | Email | Password |
| :--- | :--- | :--- |
| General User | `patient@medassist.demo` | `Patient@123` |
| Healthcare Reviewer | `reviewer@medassist.demo` | `Reviewer@123` |
| System Administrator | `admin@medassist.demo` | `Admin@123` |
| AI/ML Maintainer | `mlops@medassist.demo` | `Mlops@123` |

## Architecture

- `index.html` & `styles/main.css` — Responsive UI supporting desktop, laptop, tablet, and mobile viewports plus print summary export.
- `js/data/medicalKnowledge.js` — Curated, non-fabricated clinical symptom vocabulary (34 symptoms), 14 health conditions, and 4 high-risk emergency triage rules.
- `js/services/cryptoService.js` — Salted iterative SHA-256 password hashing (`NFR-SEC-05`) and HTML escaping.
- `js/services/storageService.js` — Persistent local database & seed bootstrapper for users, assessments, models, safety reports, audit logs, and settings.
- `js/services/authService.js` — Authentication, RBAC enforcement, and per-user health record isolation (`FR-AUTH-01..04`, `NFR-SEC-01..07`).
- `js/services/validationService.js` — Pre-inference validation (`FR-DATA-03..05`, `NFR-PERF-02`).
- `js/services/aiEngine.js` — Preprocessing, modular swappable AI strategies, deterministic ranking, explainability factors, insufficient-data detection, emergency triage, request deduplication, and fail-safe mode (`FR-AI-01..07`, `NFR-QUAL-03/04/07`).
- `js/services/adminService.js` — Model version management (disable faulty / restore approved), user RBAC management, audit logs, and healthcare safety review queue (`FR-ADM-01..05`, `NFR-SAFE-06`).
- `js/tests/testSuite.js` — In-app & Node.js automated test suite (`NFR-QUAL-05`).
