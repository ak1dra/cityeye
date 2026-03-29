# CityEye

CityEye is a full-stack prototype for collecting and triaging urban infrastructure issues in Almaty with AI-assisted photo analysis.

## Contents

1. [What Is Included](#what-is-included)
2. [Architecture](#architecture)
3. [Repository Structure](#repository-structure)
4. [Quick Start](#quick-start)
5. [Configuration](#configuration)
6. [API Reference](#api-reference)
7. [Data Model (`reports.json`)](#data-model-reportsjson)
8. [Current Product Status](#current-product-status)
9. [Troubleshooting](#troubleshooting)
10. [Scripts](#scripts)
11. [Security Notes](#security-notes)
12. [Roadmap Suggestions](#roadmap-suggestions)

## What Is Included

- Citizen flow: upload a photo and send it to AI analysis.
- City/government flow: view reports and move them through statuses.
- Dashboard and feed UIs for monitoring and triage.
- Express backend with:
  - health endpoint (`/api/health`)
  - AI endpoint (`/api/analyze`)
  - report create endpoint (`POST /api/reports`)
  - report list endpoint (`/api/reports`)
  - report status update endpoint (`PATCH /api/reports/:id`)
- File-based persistence in `backend/data/reports.json`.

## Architecture

```text
Frontend (React + Vite, :5173)
  |
  | /api (Vite proxy)
  v
Backend (Express, :3001)
  |- GET  /api/health       -> process status
  |- POST /api/analyze      -> Anthropic API (Claude)
  |- POST /api/reports      -> backend/data/reports.json
  |- GET  /api/reports      -> backend/data/reports.json
  |- PATCH /api/reports/:id -> backend/data/reports.json
```

## Repository Structure

```text
cityeye/
├── backend/
│   ├── data/reports.json      # File-based storage
│   ├── routes/analyze.js      # AI analysis route
│   ├── src/index.js           # Express app + report routes
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main app shell and tab routing
│   │   ├── api.js             # Frontend API client
│   │   ├── YandexMap.jsx      # Main map component (currently mock pins)
│   │   └── tabs/              # Map / Feed / Report / Gov tabs
│   ├── index.html             # Includes Yandex Maps script
│   ├── vite.config.js         # /api -> http://localhost:3001 proxy
│   └── package.json
├── docs/overview.md
├── .env.example
└── README.md
```

## Quick Start

### 1) Prerequisites

- Node.js `>= 18` (Node 20 LTS recommended)
- npm `>= 9`

### 2) Install Dependencies

From repository root:

```bash
npm --prefix backend install
npm --prefix frontend install
```

### 3) Configure Environment

Create backend environment file:

```bash
cp .env.example backend/.env
```

Then update `backend/.env`:

```env
ANTHROPIC_API_KEY=your_real_key
ANTHROPIC_MODEL=claude-sonnet-4-20250514
PORT=3001
NODE_ENV=development
```

Important:
- `frontend/vite.config.js` proxies `/api` to `http://localhost:3001`.
- If you change backend `PORT`, also update proxy target.

### 4) Run in Development

Use two terminals:

Terminal A (backend):
```bash
npm --prefix backend run dev
```

Terminal B (frontend):
```bash
npm --prefix frontend run dev
```

Open:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Configuration

Environment variables used by backend:

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | - | API key for Anthropic SDK |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-20250514` | Anthropic model id for image analysis |
| `PORT` | No | `3001` | Backend HTTP port |
| `NODE_ENV` | No | `development` | Runtime mode |

## API Reference

Base URL in local dev: `http://localhost:3001`

### `GET /api/health`

Simple healthcheck endpoint.

Example:

```bash
curl http://localhost:3001/api/health
```

### `POST /api/analyze`

Analyze an image with Anthropic, normalize the result, and persist a new report.

Request body:

```json
{
  "image": "data:image/jpeg;base64,... or raw base64",
  "address": "ул. Абая 10, Алматы",
  "comment": "Большая яма на перекрестке",
  "problemType": "road"
}
```

Notes:
- `image` is required.
- `address`, `comment`, `problemType` are optional.
- Backend strips `data:image/...;base64,` prefix automatically if present.

Success response:
- `201` with created report object (already normalized and saved).

Errors:
- `400` if `image` is missing.
- `500` if API key/model is misconfigured or AI response is invalid.

Example:

```bash
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/jpeg;base64,/9j/...","address":"Алматы"}'
```

### `POST /api/reports`

Create a report manually (without AI call).

Request body (example):

```json
{
  "title": "Незаконная свалка",
  "description": "Скопление строительного мусора у двора",
  "category": "waste",
  "severity": "high",
  "address": "ул. Тимирязева 15, Алматы"
}
```

Response:
- `201` with created report object.

### `GET /api/reports`

Returns the full array from `backend/data/reports.json`.

Example:

```bash
curl http://localhost:3001/api/reports
```

### `PATCH /api/reports/:id`

Update report status.

Request body:

```json
{
  "status": "new | in_progress | resolved | rejected"
}
```

Example:

```bash
curl -X PATCH http://localhost:3001/api/reports/<report-id> \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}'
```

## Data Model (`reports.json`)

`backend/data/reports.json` is expected to be an array:

```json
[
  {
    "id": "r_001",
    "title": "Яма на дороге",
    "description": "Глубокая яма возле остановки",
    "category": "road",
    "severity": "high",
    "status": "new",
    "address": "ул. Абая 10, Алматы",
    "image": "data:image/jpeg;base64,...",
    "estimated_resolution_days": 3,
    "recommendations": [
      "Оградить опасный участок",
      "Назначить дорожную бригаду"
    ],
    "created_at": "2026-03-29T10:00:00.000Z",
    "updated_at": "2026-03-29T10:00:00.000Z"
  }
]
```

Recommended enums:

- `category`: `road`, `lighting`, `greenery`, `utilities`, `waste`, `other`
- `severity`: `critical`, `high`, `medium`, `low`
- `status`: `new`, `in_progress`, `resolved`, `rejected`

## Current Product Status

This repository is a strong prototype, not yet production-ready.

Current limitations in codebase:

1. Main map (`YandexMap.jsx`) currently renders hardcoded demo pins (`MOCK_PINS`), not backend reports.
2. Feed combines mock data with backend data.
3. Access control is frontend-only (no backend auth/authorization checks for status updates).
4. Persistence is JSON-file based (no concurrency control, no migrations, no audit trail).
5. No automated tests are included yet.

## Troubleshooting

### Frontend cannot reach backend

Symptoms:
- network errors on `/api/*`
- `ECONNREFUSED` in browser devtools

Checks:
1. Backend is running on `http://localhost:3001`.
2. `frontend/vite.config.js` proxy target matches backend port.

### `POST /api/analyze` returns 500

Checks:
1. `backend/.env` contains valid `ANTHROPIC_API_KEY`.
2. Key has access to the configured model.
3. Image payload is valid base64 and not empty.

### No reports visible in UI

Checks:
1. `backend/data/reports.json` contains valid JSON array.
2. Objects include expected fields (`id`, `status`, `severity`, etc.).

## Scripts

### Backend (`backend/package.json`)

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `node --watch src/index.js` | Start backend in watch mode |
| `npm start` | `node src/index.js` | Start backend once |

### Frontend (`frontend/package.json`)

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `vite` | Start Vite dev server |
| `npm run build` | `vite build` | Create production build |
| `npm run preview` | `vite preview` | Preview built app |

## Security Notes

1. Yandex Maps API key is currently hardcoded in `frontend/index.html`.
2. Backend `PATCH /api/reports/:id` has no authentication.
3. Never commit real secrets in `.env` files.

## Roadmap Suggestions

1. Replace `reports.json` with a real database (PostgreSQL or similar).
2. Add backend authentication/authorization with role checks.
3. Remove mock data from map/feed and rely on backend records only.
4. Add validation layer (e.g. Zod) and automated tests.
