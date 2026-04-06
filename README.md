<div align="center">

<img src="https://img.shields.io/badge/Decentrathon_5.0-AI_for_Government-6366f1?style=for-the-badge" alt="Decentrathon 5.0" />
<img src="https://img.shields.io/badge/stack-Next.js_·_Supabase_·_Alem_AI-0ea5e9?style=for-the-badge" alt="Stack" />
<img src="https://img.shields.io/badge/AI-Qwen3_·_DeepSeek_·_RAGFlow-10b981?style=for-the-badge" alt="AI" />
<img src="https://img.shields.io/badge/deploy-Vercel-000000?style=for-the-badge&logo=vercel" alt="Vercel" />

# 🏙 CityEye

### AI-движок для городской инфраструктуры

**Не просто принять обращение. Довести его до подтверждённого результата.**

🌐 **Live:** [cityeye-fqmo.vercel.app](https://cityeye-fqmo.vercel.app)

[Демо](#-тестовый-доступ) · [Быстрый старт](#-быстрый-старт) · [Архитектура](#-архитектура) · [API](#-api) · [Deploy](#-deploy-vercel)

</div>

---

## 📌 О проекте

**CityEye** — AI-платформа полного цикла для управления городскими инфраструктурными проблемами.

Система связывает три стороны — **жителя**, **акимат** и **подрядчика** — в единый прозрачный workflow: от момента, когда гражданин сфотографировал яму на дороге, до AI-подтверждения, что проблема действительно устранена.

```
Житель → Фото/голос → AI Triage → Акимат → Подрядчик → Proof → AI Verify ✓
```

> **CityEye** — это не сервис жалоб. Это **операционный execution layer** для современного города.

---

## 🔥 Ключевые возможности

| Возможность | Описание |
|---|---|
| **AI Triage Pipeline** | 10-этапный pipeline: OCR → Classify → Embed → Dedup → Route → Score → Explain. Не one-shot prompt, а прикладной AI-контур |
| **AI Verify** | Сравнение фото «до/после» через vision-модель. Вердикт: `VERIFIED` / `SUSPICIOUS` / `NOT_FIXED` |
| **RAG-маршрутизация** | Knowledge Base акимата (отделы, правила, SLA, районы, shared-case протоколы) через RAGFlow |
| **Explainable AI** | Каждое решение AI прозрачно: confidence score, факторы, routing reasoning, pipeline trace |
| **Shared-Case Model** | Кейсы на границе ответственности: `government`, `contractor`, `shared`, `disputed` |
| **Голосовой ввод** | Speech-to-text на казахском языке (`speech-to-text-kk`) |
| **Realtime-обновления** | Supabase Realtime для live-синхронизации между всеми ролями |
| **SSE Streaming** | Потоковая передача прогресса AI pipeline в реальном времени |
| **Кабинет подрядчика** | Рабочие задания, SLA, дедлайны, загрузка proof, координация с акиматом |
| **Публичная карта** | Интерактивная карта проблем города + лента прозрачности |
| **Vercel Deploy** | Production-деплой с автоматическим CI/CD через GitHub |

---

## 🧠 AI Pipeline

CityEye опирается не на один prompt, а на **многоэтапный прикладной AI-контур**:

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  INPUT  │──▶│   OCR   │──▶│ CLASSIFY│──▶│  EMBED  │──▶│  DEDUP  │
│ фото,   │   │DeepSeek │   │ Qwen 3  │   │text-1024│   │geo +    │
│ текст,  │   │  vision │   │тип,     │   │vectorize│   │reranker │
│ голос   │   │         │   │severity │   │         │   │         │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
                                                              │
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐        │
│ VERIFY  │◀──│ EXPLAIN │◀──│  SCORE  │◀──│  ROUTE  │◀───────┘
│до/после │   │confidence│  │priority │   │RAGFlow  │
│DeepSeek │   │trace    │   │score    │   │+ Qwen 3 │
└─────────┘   └─────────┘   └─────────┘   └─────────┘
```

**Каждый этап** имеет своё назначение, свою модель и свой latency trace. Это позволяет:

- объяснять решения AI государственным служащим;
- адаптировать маршрутизацию под конкретный город через Knowledge Base;
- находить дубликаты по геолокации и семантике;
- верифицировать результат исполнения, а не просто отмечать «закрыто».

---

## 🏗 Архитектура

```
┌──────────────────────────────────────────────────────────┐
│              Next.js App Router (Fullstack)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │  Карта   │ │  Лента   │ │ Дашборд  │ │  Workspace  │ │
│  │ проблем  │ │прозрачн. │ │ акимата  │ │ подрядчика  │ │
│  └──────────┘ └──────────┘ └──────────┘ └─────────────┘ │
└──────────────────────┬───────────────────────────────────┘
                       │ same-origin routes + API
┌──────────────────────┴───────────────────────────────────┐
│               Route Handlers + Server Logic               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ analyze  │ │  verify  │ │ reports  │ │  assistant   │ │
│  │ /stream  │ │ до/после │ │   CRUD   │ │  AI-советы   │ │
│  └──────────┘ └──────────┘ └──────────┘ └─────────────┘ │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────┴───────────────────────────────────┐
│                     AI Services Layer                     │
│  Qwen 3 · DeepSeek OCR · text-1024 · Reranker · STT-kk │
│  RAGFlow (Knowledge Base) · Langfuse (Tracing)           │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────┴───────────────────────────────────┐
│              Supabase (PostgreSQL + Storage + Realtime)   │
└──────────────────────────────────────────────────────────┘
```

---

## 👥 Три роли — один кейс

### 🏠 Житель
- Создаёт кейс: фото, описание, геолокация, голосовой ввод
- Видит проблему на карте и в публичной ленте

### 🏛 Акимат
- Получает AI-досье: тип, severity, confidence, routing reasoning
- Маршрутизирует кейс, контролирует SLA, управляет shared-case

### 🔧 Подрядчик / ТОО
- Получает рабочее задание с дедлайном
- Загружает proof-фото, запускает AI Verify
- Координируется с акиматом через shared-case комментарии

---

## 💎 Killer Features

### 1. AI Verify — фото «до/после»

Когда исполнитель загружает фото результата, vision-модель сравнивает его с исходным снимком:

| Вердикт | Значение |
|---|---|
| ✅ `VERIFIED` | Проблема устранена, визуальные изменения подтверждены |
| ⚠️ `SUSPICIOUS` | Изменения недостаточны или неоднозначны |
| ❌ `NOT_FIXED` | Проблема не устранена |

Это решает главную боль госуправления: **«закрыли на бумаге, но не устранили в реальности»**.

### 2. Explainable AI для госсектора

Каждое решение AI прозрачно:
- **Confidence score** с разбивкой по факторам
- **Routing reasoning**: почему кейс направлен именно сюда
- **Согласие AI и правил**: совпадают ли rule-based и AI-маршруты
- **Pipeline trace**: latency каждого этапа

Критично для доверия к AI в государственном управлении.

### 3. Казахоязычный AI-контур

- Speech-to-text на казахском (`speech-to-text-kk`)
- Обработка бытовых описаний, а не только канцелярского языка
- Русский и казахский могут смешиваться в одном сценарии

### 4. RAG Knowledge Base

Маршрутизация строится не на общих знаниях LLM, а на **доменных данных города**:

```
knowledge-base/
├── 01_departments.md      # Структура отделов акимата
├── 02_routing_rules.md    # Правила маршрутизации
├── 03_sla_policy.md       # SLA-политика
├── 04_districts.md        # Районы и сервисные зоны
└── 05_shared_case_protocol.md  # Протокол совместных кейсов
```

При адаптации под новый город меняется только Knowledge Base — ядро остаётся тем же.

---

## 🛠 Технологический стек

| Слой | Технология |
|---|---|
| **App Runtime** | Next.js 14 App Router |
| **Deploy** | Vercel (CI/CD из GitHub, Fluid Compute) |
| **UI** | React 18 · Tailwind CSS · Framer Motion · Recharts · Lucide |
| **Server** | Next.js Route Handlers · Node.js |
| **Database** | Supabase PostgreSQL |
| **Storage** | Supabase Storage |
| **Realtime** | Supabase Realtime (WebSocket) |
| **Карты** | Yandex Maps API |
| **LLM** | Qwen 3 via Alem AI |
| **Vision/OCR** | DeepSeek OCR via Alem AI |
| **Embeddings** | text-1024 via Alem AI |
| **Reranker** | Reranker via Alem AI |
| **STT** | speech-to-text-kk via Alem AI |
| **Knowledge Base** | RAGFlow |
| **Observability** | Langfuse (tracing) |

Все AI-модели подключены через **Alem AI** (`https://llm.alem.ai/v1`) — казахстанскую AI-инфраструктуру.

---

## 📡 API

| Метод | Endpoint | Назначение |
|---|---|---|
| `POST` | `/api/analyze` | AI triage pipeline (полный анализ) |
| `POST` | `/api/analyze/stream` | AI triage pipeline (SSE streaming) |
| `POST` | `/api/verify` | AI Verify — сравнение фото до/после |
| `POST` | `/api/speech-to-text` | Голосовой ввод → текст |
| `POST` | `/api/assistant` | AI-ассистент для акимата |
| `GET` | `/api/analytics/overview` | Аналитика и статистика |
| `GET` | `/api/reports` | Список кейсов |
| `POST` | `/api/reports` | Создание кейса |
| `PATCH` | `/api/reports/:id` | Обновление кейса |
| `GET` | `/api/health` | Health check + статус провайдеров |

---

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 20+
- Supabase-проект (PostgreSQL + Storage)
- API-ключи Alem AI (Qwen 3, DeepSeek OCR, Embedder, Reranker, STT)
- RAGFlow instance (для RAG-маршрутизации)

### Установка

```bash
# Клонировать репозиторий
git clone https://github.com/ak1dra/cityeye.git
cd cityeye

# Установить зависимости одного fullstack-проекта
npm install

# Создать .env.local из шаблона
npm run setup:env
# Затем заполнить .env.local ключами (см. ниже)
```

### Windows-friendly запуск

Проект теперь можно запускать на Windows без Git Bash и без Unix-команд:

```powershell
git clone https://github.com/ak1dra/cityeye.git
cd cityeye
npm install
npm run setup:env
npm run dev
```

Что исправлено для Windows:

- один runtime: `Next.js`, без отдельного Express-процесса;
- один запуск: `npm run dev`;
- создание `.env.local` не требует `cp`.

Основной конфиг теперь хранится в корневом `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Переменные окружения

```env
# Qwen 3 (LLM: классификация + маршрутизация)
ALEM_API_KEY=your_key
ALEM_MODEL=qwen3

# DeepSeek OCR (vision: извлечение текста из фото)
ALEM_OCR_API_KEY=your_key
ALEM_OCR_MODEL=deepseek-ocr

# Embedder (векторизация для поиска дубликатов)
ALEM_EMBEDDER_API_KEY=your_key
ALEM_EMBEDDER_MODEL=text-1024

# Reranker (семантическое ранжирование)
ALEM_RERANKER_API_KEY=your_key
ALEM_RERANKER_MODEL=reranker

# Speech-to-text (казахский)
ALEM_STT_API_KEY=your_key
ALEM_STT_MODEL=speech-to-text-kk

# RAGFlow
RAGFLOW_API_URL=your_ragflow_url
RAGFLOW_API_KEY=your_ragflow_api_key
RAGFLOW_DATASET_ID=your_dataset_id

# Langfuse (observability)
LANGFUSE_SECRET_KEY=your_key
LANGFUSE_PUBLIC_KEY=your_key
LANGFUSE_BASE_URL=https://a1-langfuse1.alem.ai

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Подготовка базы данных

Можно использовать один из двух путей:

1. через `psql`, если у вас есть `DATABASE_URL`
2. через Supabase SQL Editor, если удобнее применять SQL вручную

```bash
# Применить миграции
psql $DATABASE_URL < supabase/migrations/20260402_add_completion_image_url.sql
psql $DATABASE_URL < supabase/migrations/20260403_add_ai_triage_fields.sql
psql $DATABASE_URL < supabase/migrations/20260403_align_reports_runtime_schema.sql
psql $DATABASE_URL < supabase/migrations/20260403_create_reports_images_bucket.sql
psql $DATABASE_URL < supabase/migrations/20260405_add_contractor_execution_fields.sql
psql $DATABASE_URL < supabase/migrations/20260406_add_reports_runtime_indexes.sql

# При необходимости загрузить тестовые данные
psql $DATABASE_URL < supabase/seeds/20260405_golden_demo_set.sql
```

Если запускаете через Supabase SQL Editor, сначала примените файлы из `supabase/migrations/`, затем выполните [20260405_golden_demo_set.sql](supabase/seeds/20260405_golden_demo_set.sql).

### Запуск

```bash
npm run dev
```

Это кроссплатформенный запуск:

- macOS / Linux: работает из Terminal
- Windows: работает из PowerShell или Command Prompt

| Сервис | URL |
|---|---|
| App | `http://localhost:3000` |
| API | `http://localhost:3000/api/*` |

### Recovery flow для локального runtime

Если после `build/start` карта или страницы начинают отдавать `500`, сначала очистите stale Next cache:

```bash
npm run reset:next
npm run build
npm run start
```

---

## 🎯 Тестовый доступ

| Роль | Email | Пароль | Что показать |
|---|---|---|---|
| 🏠 Житель | `user@cityeye.kz` | `User2026` | Создание кейса, голосовой ввод, карта |
| 🏛 Акимат | `gov@cityeye.kz` | `CityEye2026` | AI-досье, маршрутизация, управление очередями |
| 🔧 Подрядчик | `business@cityeye.kz` | `Business2026` | Рабочие задания, proof-загрузка, AI Verify |

Эти аккаунты должны быть созданы в живом `Supabase Auth`.

### Сценарий показа

1. **Житель** фотографирует яму / неосвещённый участок / мусор
2. **AI Pipeline** анализирует: тип, severity, маршрут, дубликаты
3. **Акимат** видит AI-досье и принимает решение по маршрутизации
4. **Подрядчик** получает рабочее задание с SLA
5. **Исполнитель** загружает proof-фото
6. **AI Verify** подтверждает факт устранения проблемы

---

## 🗂 Структура проекта

```
cityeye/
├── app/
│   ├── map/                    # /map
│   ├── feed/                   # /feed
│   ├── report/                 # /report
│   ├── gov/                    # /gov
│   ├── contractor/             # /contractor
│   ├── auth/                   # /auth/*
│   └── api/                    # same-origin API route handlers
├── components/
│   └── app/                    # page clients, navbar, role gate, provider
├── lib/
│   ├── client/                 # route helpers
│   └── server/                 # Next server helpers (auth, assistant, analyze)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AITriagePanel.jsx        # AI-досье в карточке кейса
│   │   │   ├── ExplainabilityCard.jsx   # Explainability breakdown
│   │   │   ├── VerifyBadge.jsx          # AI Verify UI
│   │   │   ├── VoiceInput.jsx           # Голосовой ввод
│   │   │   ├── CollaborationWidgets.jsx # Shared-case timeline
│   │   │   ├── AkimatAssistantPanel.jsx # AI-ассистент
│   │   │   └── GlassPanel.jsx           # Glass-morphism UI
│   │   ├── tabs/
│   │   │   ├── Dashboard.jsx            # Дашборд акимата
│   │   │   ├── BusinessDashboard.jsx    # Кабинет подрядчика
│   │   │   ├── ReportTab.jsx            # Создание кейса
│   │   │   ├── FeedTab.jsx              # Лента прозрачности
│   │   │   └── MapTab.jsx               # Карта проблем
│   │   ├── lib/
│   │   │   ├── aiTriage.js              # Клиент AI triage
│   │   │   ├── contractorModel.js       # Бизнес-логика подрядчика
│   │   │   ├── reportCollaboration.js   # Shared-case логика
│   │   │   └── supabase.js              # Supabase client
│   │   └── api.js                       # same-origin API клиент
├── backend/
│   └── src/                             # legacy server logic, переиспользуемая в Next до полного cleanup
├── public/                              # runtime static assets
├── knowledge-base/                      # RAG Knowledge Base
│   ├── 01_departments.md
│   ├── 02_routing_rules.md
│   ├── 03_sla_policy.md
│   ├── 04_districts.md
│   └── 05_shared_case_protocol.md
├── supabase/
│   ├── migrations/                      # DB миграции
│   └── seeds/                           # Опциональные seed-наборы
└── docs/
    ├── ARCHITECTURE.md
    └── overview.md
```

---

## ☁️ Deploy (Vercel)

Проект задеплоен на **Vercel** с автоматическим CI/CD при каждом пуше в `main`.

| Параметр | Значение |
|---|---|
| **Production URL** | [cityeye-fqmo.vercel.app](https://cityeye-fqmo.vercel.app) |
| **Framework** | Next.js (auto-detected) |
| **Node.js** | 20+ |
| **Build** | `next build` |
| **Region** | Auto |

### Деплой своей копии

1. **Fork** этот репозиторий
2. Импортируйте проект в [vercel.com/new](https://vercel.com/new)
3. Добавьте переменные окружения (см. [раздел выше](#переменные-окружения)):
   - Все `ALEM_*` ключи (LLM, OCR, Embedder, Reranker, STT)
   - `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `RAGFLOW_*` ключи (опционально, для RAG-маршрутизации)
   - `LANGFUSE_*` ключи (опционально, для observability)
4. Deploy — Vercel автоматически определит Next.js и соберёт проект

```bash
# Или через CLI
npx vercel --prod
```

> **Важно:** все API-ключи Alem AI должны быть добавлены как Environment Variables в Vercel Dashboard (Settings → Environment Variables) для корректной работы AI pipeline в production.

---

## 🔮 Roadmap

### Ближайшие шаги
- [ ] Telegram-бот для граждан (фото из мессенджера → кейс)
- [ ] Push-уведомления о смене статуса
- [ ] Полноценная permission model (RBAC)

### Масштабирование
- [ ] Водительский канал (Mobility Intake) — фиксация дорожных проблем на ходу
- [ ] City Packs — адаптация под конкретные города (Актау, Талдыкорган)
- [ ] Domain fine-tuning на анонимизированных муниципальных данных
- [ ] Интеграция с e-Otinish как официальным каналом

### Усиление production-готовности
- [ ] Rate limiting, RBAC, audit log
- [ ] Мониторинг SLA-нарушений
- [ ] Batch-аналитика по районам и подрядчикам
- [ ] CI/CD pipeline

---

## 🆚 CityEye vs e-Otinish

| | e-Otinish | CityEye |
|---|---|---|
| **Назначение** | Официальные обращения | Операционное исполнение |
| **Старт кейса** | Длинная форма | Фото + AI |
| **Triage** | Ручной | AI Pipeline |
| **Маршрутизация** | Бюрократическая | RAG + AI + правила |
| **Исполнитель** | Не виден | Кабинет подрядчика |
| **Координация** | Нет | Shared-case model |
| **Верификация** | Отметка «исполнено» | AI Verify до/после |
| **Прозрачность** | Закрытая система | Публичная карта + лента |

> CityEye не заменяет e-Otinish. Он решает то, что не покрывает формальный канал: **маршрутизацию, исполнение, координацию и подтверждение результата**.

---

## 📖 Документация

- [Архитектура](docs/ARCHITECTURE.md) — техническое описание системы
- [Обзор продукта](docs/overview.md) — обзор продукта

---

## 🏆 Decentrathon 5.0

Проект создан для хакатона **Decentrathon 5.0** в треке **AI for Government**.

**Почему CityEye может победить:**

1. **Реальная проблема** — понятна любому городу мира
2. **Полный цикл** — от сигнала гражданина до подтверждённого результата
3. **AI-native** — AI встроен в каждый этап, а не добавлен для галочки
4. **Три роли** — житель, акимат, подрядчик в одном workflow
5. **Масштабируемость** — адаптация через Knowledge Base, а не переписывание кода
6. **Международная понятность** — *How do cities move from citizen signal to accountable execution?*

---

<div align="center">

**CityEye** — инфраструктурный execution layer для современного города.

🌐 [cityeye-fqmo.vercel.app](https://cityeye-fqmo.vercel.app)

Сделано для Decentrathon 5.0 · Deployed on Vercel

</div>
