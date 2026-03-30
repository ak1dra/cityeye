# CityEye — Architecture

> Техническая документация платформы гражданского мониторинга городской инфраструктуры Казахстана

---

## Содержание

1. [Обзор системы](#1-обзор-системы)
2. [Технический стек](#2-технический-стек)
3. [Архитектура компонентов](#3-архитектура-компонентов)
4. [База данных](#4-база-данных)
5. [API документация](#5-api-документация)
6. [AI Pipeline](#6-ai-pipeline)
7. [Безопасность](#7-безопасность)
8. [Дорожная карта](#8-дорожная-карта)

---

## 1. Обзор системы

CityEye решает проблему **реактивного управления городской инфраструктурой** в Казахстане. Акиматы узнают о проблемах только после аварий — CityEye переводит систему в проактивный режим через AI-анализ фотографий от граждан.

### Типы пользователей

| Роль | Доступ | Задача |
|------|--------|--------|
| 👤 Гражданин / Бизнес | Лента, Карта, Репорт | Фотографирует проблемы, следит за статусом |
| 🏛️ Акимат | Полный дашборд | Управляет репортами, меняет статусы |
| 🏢 Министерство | Аналитика | Мониторинг по всей стране |

### Поток данных

```
Фото → Anthropic Claude Vision → AI анализ →
Supabase → Лента / Карта / Дашборд
```

---

## 2. Технический стек

### Frontend
| Технология | Назначение |
|------------|------------|
| React 18 + Vite | UI фреймворк и сборщик |
| CSS Modules | Стилизация компонентов |
| Supabase JS | Auth + база данных |
| Яндекс Maps API v2 | Карта с пинами репортов |
| Recharts | Графики в дашборде акимата |

### Backend
| Технология | Назначение |
|------------|------------|
| Node.js + Express | REST API сервер |
| Anthropic Claude | Vision AI анализ фото |
| Supabase JS Client | Работа с PostgreSQL |

### Database & Infrastructure
| Сервис | Назначение |
|--------|------------|
| Supabase (PostgreSQL) | Основная база данных |
| Supabase Auth | Аутентификация и JWT |
| Supabase Storage | Хранение фотографий |
| Vercel | Деплой фронтенда |
| Railway | Деплой бэкенда |

---

## 3. Архитектура компонентов

```
┌──────────────────────────────────────────────────────┐
│                  FRONTEND (React)                    │
│                                                      │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────┐  │
│  │ Карта  │  │ Лента  │  │ Репорт │  │  Акимат  │  │
│  │  Map   │  │  Feed  │  │ Report │  │ Dashboard│  │
│  └────────┘  └────────┘  └────────┘  └──────────┘  │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │          AuthModal + Supabase Auth          │    │
│  └─────────────────────────────────────────────┘    │
└──────────────────────┬───────────────────────────────┘
                       │ HTTP / REST
┌──────────────────────▼───────────────────────────────┐
│                BACKEND (Node.js)                     │
│                                                      │
│  POST  /api/analyze      — AI анализ фото            │
│  GET   /api/reports      — список репортов           │
│  POST  /api/reports      — создать репорт            │
│  PATCH /api/reports/:id  — обновить статус           │
│  GET   /api/dashboard    — статистика акимата        │
│  GET   /api/health       — healthcheck               │
└──────────┬─────────────────────────┬─────────────────┘
           │                         │
┌──────────▼──────────┐   ┌──────────▼──────────────────┐
│   Anthropic Claude  │   │         Supabase             │
│                     │   │                              │
│  claude-haiku-4-5   │   │  PostgreSQL  ·  Auth         │
│  Computer Vision    │   │  Storage     ·  RLS          │
└─────────────────────┘   └─────────────────────────────┘
```

---

## 4. База данных

### Таблица `profiles`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `uuid` | Primary key (Supabase Auth UID) |
| `email` | `text` | Email пользователя |
| `name` | `text` | Отображаемое имя |
| `role` | `text` | `citizen` / `government` / `business` |
| `district` | `text` | Район Алматы |
| `created_at` | `timestamp` | Дата регистрации |

### Таблица `reports`

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `uuid` | Primary key |
| `user_email` | `text` | Email автора репорта |
| `type` | `text` | Тип проблемы (из AI) |
| `severity` | `text` | `КРИТИЧНО` / `ВЫСОКО` / `СРЕДНЕ` / `НИЗКО` |
| `priority_score` | `int` | Приоритет 0–100 |
| `ai_comment` | `text` | Развёрнутый AI анализ |
| `recommended_action` | `text` | Рекомендованное действие |
| `estimated_fix_time` | `text` | Ожидаемый срок устранения |
| `responsible_dept` | `text` | Ответственный отдел акимата |
| `risk_for` | `text` | Кто под риском |
| `duplicate_likely` | `boolean` | Возможный дубликат |
| `address` | `text` | Адрес проблемы |
| `lat` | `float` | Широта (координата) |
| `lng` | `float` | Долгота (координата) |
| `status` | `text` | `new` / `seen` / `in_progress` / `resolved` |
| `image_url` | `text` | URL фото в Supabase Storage |
| `created_at` | `timestamp` | Дата создания |

### Row Level Security (RLS)

```sql
-- Граждане видят все репорты
CREATE POLICY "reports_select_all"
  ON reports FOR SELECT USING (true);

-- Только автор может создавать
CREATE POLICY "reports_insert_own"
  ON reports FOR INSERT
  WITH CHECK (auth.email() = user_email);

-- Только government может менять статус
CREATE POLICY "reports_update_gov"
  ON reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'government'
    )
  );
```

---

## 5. API документация

Base URL: `http://localhost:3001` (dev) · `https://api.cityeye.kz` (prod)

---

### `POST /api/analyze`

Анализ фотографии через Claude Vision, автоматическое создание репорта.

**Request body:**

```json
{
  "image": "base64_string_or_data_url",
  "address": "ул. Абая 45, Алматы",
  "comment": "необязательный комментарий",
  "problemType": "road"
}
```

**Response `201`:**

```json
{
  "id": "rpt_abc123",
  "type": "Яма на дороге",
  "severity": "КРИТИЧНО",
  "priority_score": 95,
  "ai_comment": "Глубокая выбоина ~40 см у пешеходного перехода...",
  "recommended_action": "Срочный ямочный ремонт в течение 24 часов",
  "estimated_fix_time": "24 часа",
  "responsible_dept": "Управление дорог и транспорта",
  "risk_for": "пешеходы и водители",
  "duplicate_likely": false,
  "status": "new",
  "created_at": "2026-03-30T10:00:00.000Z"
}
```

---

### `GET /api/reports`

Список всех репортов.

**Query params:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `status` | string | `new` / `seen` / `in_progress` / `resolved` |
| `severity` | string | `КРИТИЧНО` / `ВЫСОКО` / `СРЕДНЕ` / `НИЗКО` |
| `limit` | number | Кол-во записей (default: `20`) |

**Response `200`:**

```json
[
  { "id": "rpt_001", "type": "...", "severity": "КРИТИЧНО", ... },
  { "id": "rpt_002", "type": "...", "severity": "ВЫСОКО",   ... }
]
```

---

### `PATCH /api/reports/:id`

Обновление статуса репорта. Только для роли `government`.

**Request body:**

```json
{ "status": "in_progress" }
```

**Response `200`:**

```json
{ "id": "rpt_001", "status": "in_progress", "updated_at": "..." }
```

---

### `GET /api/dashboard`

Агрегированная статистика для акимата.

**Response `200`:**

```json
{
  "total": 1204,
  "new": 127,
  "in_progress": 48,
  "resolved": 843,
  "avg_response_time": "18 часов",
  "by_district": [
    { "name": "Медеуский", "score": 87, "count": 142 }
  ],
  "by_type": [
    { "type": "road", "count": 412 },
    { "type": "lighting", "count": 234 }
  ]
}
```

---

## 6. AI Pipeline

```
1. 📸 Пользователь загружает фото
       │
2. 🔄 Frontend конвертирует в base64
       │
3. 📡 POST /api/analyze  {image, address, comment}
       │
4. 🧠 Backend → Anthropic Claude Vision API
       │         claude-haiku-4-5-20251001
       │
5. 📋 Claude анализирует изображение
       │  → тип проблемы
       │  → критичность (0–100)
       │  → ответственный отдел
       │  → срок устранения
       │  → риски для граждан
       │
6. 💾 Backend сохраняет репорт в Supabase
       │
7. ✅ Frontend показывает результат пользователю
```

### Почему AI, а не просто форма

| Задача | Без AI | С AI |
|--------|--------|------|
| Классификация | Пользователь выбирает вручную | Computer Vision определяет тип автоматически |
| Дедупликация | 200 фото одной ямы = 200 заявок | 200 фото = 1 заявка с весом |
| Приоритизация | По дате создания | По опасности, локации и типу |
| Верификация | Акимат на слово | AI сравнивает фото до/после |
| Аналитика | Ручные отчёты | Предиктивные паттерны и горячие точки |

---

## 7. Безопасность

- **Supabase RLS** — Row Level Security на уровне базы данных
- **JWT токены** — авторизация через Supabase Auth
- **Role-based access** — дашборд акимата только для роли `government`
- **Секреты в `.env`** — API ключи никогда не попадают в репозиторий
- **API ключи только на бэкенде** — фронтенд не имеет доступа к `ANTHROPIC_API_KEY`
- **CORS** — ограничен доменами продакшена

---

## 8. Дорожная карта

### Фаза 1 — MVP (Хакатон)
```
✅  AI анализ фото через Claude Vision
✅  Открытая лента репортов
✅  Государственный дашборд
✅  Яндекс карта с пинами
✅  Авторизация (citizen / government)
✅  Supabase подключение
```

### Фаза 2 — После хакатона
```
⬜  Публичный доступ для всех граждан Казахстана
⬜  Push-уведомления об изменении статуса
⬜  Верификация через фото «до / после»
⬜  Мобильное приложение (React Native / PWA)
⬜  Интеграция с e-Gov / eOtinish
```

### Фаза 3 — Масштабирование
```
⬜  Предиктивная аналитика горячих точек
⬜  Интеграция городских камер (автодетекция)
⬜  Национальный рейтинг акиматов
⬜  API для других городов Казахстана
⬜  Дашборд Министерства национального планирования
```

---

*CityEye — Urban AI Monitor · Made with ❤️ in Almaty, Kazakhstan*
