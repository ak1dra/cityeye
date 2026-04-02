# CityEye — Architecture

> Реальная архитектура hackathon MVP без лишних обещаний.

## 1. Архитектурный тезис

CityEye строится вокруг одной сущности: **городской инфраструктурный кейс**, который может быть создан жителем или частным сектором и затем обработан акиматом, бизнесом или обеими сторонами совместно.

Важный архитектурный выбор проекта:

- не разделять "жалобу гражданина" и "внутреннюю задачу исполнителя";
- не делать отдельные несвязанные кабинеты для акимата и бизнеса;
- хранить единый `report`, который проходит через маршрутизацию, исполнение, комментарии и фотофиксацию результата.

Это делает систему понятной для демонстрации и масштабируемой для следующей фазы.

---

## 2. Что реально есть в текущем MVP

### Frontend

- `Map` для обзорной визуализации обращений;
- `Feed` для публичного слоя прозрачности;
- `ReportTab` для создания обращений;
- `Dashboard` для акимата;
- `BusinessDashboard` для частного сектора;
- `AuthModal` с demo-role login;
- `CollaborationWidgets` для shared-case timeline и partner comments.

### Data layer

- Supabase PostgreSQL как основной runtime-store для UI;
- Supabase Storage для фотографий;
- Supabase Realtime для live-обновления обращений.

### Backend

- `POST /api/analyze` для AI-assisted triage;
- `GET/POST/PATCH /api/reports` как server-side path и основа для дальнейшего hardening;
- health endpoint с признаком `alem` или `mock`.

### AI mode

- текущий runtime: `qwen3` для AI-assisted normalization и triage;
- следующий этап: `Qwen 3.5 Vision` для прямого multimodal анализа изображения.

### Collaboration layer

В модель данных уже встроены:

- `reporter_role`
- `reporter_org_name`
- `responsible_role`
- `assigned_org_name`
- `shared_case`
- `partner_comment`
- `completion_image_url`

---

## 3. High-Level Diagram

```text
                           ┌─────────────────────────┐
                           │       Demo Login        │
                           │ localStorage session    │
                           └────────────┬────────────┘
                                        │
                                        v
┌────────────────────────────────────────────────────────────────────┐
│                           React Frontend                          │
│                                                                    │
│  Map   Feed   ReportTab   Government Dashboard   Business Dashboard │
│                                                                    │
│  - creates reports                                                 │
│  - routes cases                                                    │
│  - uploads before/after photos                                     │
│  - renders timeline and shared comments                            │
└───────────────┬─────────────────────────────┬──────────────────────┘
                │                             │
                │                             │
                v                             v
      ┌───────────────────────┐     ┌──────────────────────────────┐
      │    Express Backend    │     │           Supabase           │
      │                       │     │                              │
      │  /api/analyze         │     │  reports table               │
      │  /api/reports         │     │  reports-images bucket       │
      │  /api/health          │     │  realtime subscriptions      │
      └──────────┬────────────┘     └──────────────────────────────┘
                 │
                 v
      ┌──────────────────────────────┐
      │   Alem AI compatible API     │
      │   qwen3 now / Qwen 3.5 next  │
      └──────────────────────────────┘
```

---

## 4. Почему архитектура гибридная

Сейчас проект намеренно использует **гибридную схему**:

- frontend уже интегрирован с Supabase напрямую;
- backend выделен для AI-анализа и серверного пути работы с reports;
- migration и серверная нормализация уже подготовлены;
- следующий шаг очевиден: перевести весь write-path на backend без полной переделки UI.

Это не "грязная архитектура", а прагматичный выбор для hackathon velocity:

- UI получилось собрать быстро;
- совместная логика уже проверена в работающем интерфейсе;
- server hardening можно наращивать поэтапно.

---

## 5. Главные пользовательские потоки

### 5.1 Citizen flow

```text
ReportTab
  -> выбор типа проблемы
  -> адрес / точка на карте
  -> комментарий
  -> optional photo upload
  -> POST /api/analyze
  -> insert into Supabase reports
  -> report visible in map/feed/dashboard
```

Особенность: обращение гражданина по умолчанию попадает в контур `government`.

### 5.2 Business flow

```text
Business user
  -> creates report
  -> report gets collaboration fields
  -> responsible_role = shared
  -> assigned_org_name = business org
  -> report visible to business and government
```

Особенность: заявка частного сектора сразу создаётся как **shared-case**, а не как изолированный private ticket.

### 5.3 Government routing flow

```text
Government dashboard
  -> opens report modal
  -> route to government | business | shared
  -> updates responsible_role / assigned_org_name / shared_case
  -> case instantly appears in correct work contour
```

### 5.4 Execution and closure

```text
Business or government
  -> move case to in_progress
  -> upload completion image
  -> resolve case
  -> shared timeline reflects completion
```

---

## 6. Frontend component map

### 6.1 Shell and navigation

- [App.jsx](/Users/izbaskanaldabergen/cityeye/frontend/src/App.jsx)
  - управляет табами `map / feed / report / gov / business`;
  - читает и нормализует demo-user;
  - подписывается на Supabase realtime.

### 6.2 Reporting

- [ReportTab.jsx](/Users/izbaskanaldabergen/cityeye/frontend/src/tabs/ReportTab.jsx)
  - форма обращения;
  - Yandex geocoding для адреса;
  - upload фото в `reports-images`;
  - вызов `/api/analyze`;
  - запись обращения в Supabase.

### 6.3 Government operations

- [Dashboard.jsx](/Users/izbaskanaldabergen/cityeye/frontend/src/tabs/Dashboard.jsx)
  - единый реестр;
  - route modal;
  - AI summary;
  - before/after evidence;
  - collaboration timeline;
  - partner comments.

### 6.4 Business operations

- [BusinessDashboard.jsx](/Users/izbaskanaldabergen/cityeye/frontend/src/tabs/BusinessDashboard.jsx)
  - фильтрация собственных и assigned/shared cases;
  - KPI по статусам;
  - upload фото выполнения;
  - завершение кейса;
  - комментарий для акимата.

### 6.5 Collaboration primitives

- [reportCollaboration.js](/Users/izbaskanaldabergen/cityeye/frontend/src/lib/reportCollaboration.js)
  - labels and style tokens;
  - route builders;
  - visibility rules;
  - timeline model;
  - partner comment builder.

- [CollaborationWidgets.jsx](/Users/izbaskanaldabergen/cityeye/frontend/src/components/CollaborationWidgets.jsx)
  - reusable shared-case timeline;
  - reusable shared comment box.

---

## 7. Backend component map

### 7.1 API shell

- [index.js](/Users/izbaskanaldabergen/cityeye/backend/src/index.js)
  - health endpoint;
  - mounting analyze router;
  - REST endpoints for reports;
  - patch validation.

### 7.2 AI route

- [analyze.js](/Users/izbaskanaldabergen/cityeye/backend/routes/analyze.js)
  - calls external AI provider;
  - normalizes response shape;
  - returns fallback mock if provider unavailable;
  - isolates AI integration behind one route.

С инженерной точки зрения это хороший задел под следующий шаг:

- текущий интерфейс уже общается с `/api/analyze`;
- upgrade до `Qwen 3.5 Vision` можно сделать внутри backend route без перестройки всего frontend UX;
- это позволяет эволюционно перейти от hackathon AI-assist к полноценному visual inspection pipeline.

### 7.3 Report store

- [reportStore.js](/Users/izbaskanaldabergen/cityeye/backend/src/reportStore.js)
  - normalizes payloads and statuses;
  - supports collaboration fields;
  - supports status and full-patch update;
  - persists into JSON file for server-side demo mode.

---

## 8. Runtime data model

В текущем runtime UI опирается на таблицу `reports` в Supabase. На уровне архитектуры ключевые поля выглядят так:

| Поле | Назначение |
|---|---|
| `id` | идентификатор кейса |
| `user_email` / `user_name` | кто создал кейс |
| `type` | тип проблемы |
| `severity` | критичность |
| `priority_score` | приоритет 0-100 |
| `ai_comment` | AI-assisted summary |
| `recommended_action` | что рекомендуется сделать |
| `responsible_dept` | предполагаемый ответственный отдел |
| `address`, `lat`, `lng` | локация |
| `image_url` | фото обращения |
| `completion_image_url` | фото выполнения |
| `status` | стадия кейса |
| `reporter_role` | `citizen` / `business` / `government` |
| `reporter_org_name` | организация автора, если это бизнес |
| `responsible_role` | `government` / `business` / `shared` |
| `assigned_org_name` | назначенная частная организация |
| `shared_case` | признак общего кейса |
| `partner_comment` | координационный комментарий сторон |

Миграция: [20260402_add_completion_image_url.sql](/Users/izbaskanaldabergen/cityeye/supabase/migrations/20260402_add_completion_image_url.sql)

---

## 9. Статусы

### В UI активно используются

- `new`
- `in_progress`
- `resolved`
- `rejected`

### В backend уже подготовлены

- `triage`
- `waiting_partner`
- `verified`

Это значит, что система уже может эволюционировать к более формальному workflow без смены модели данных.

---

## 10. Realtime, storage, and maps

### Realtime

Frontend подписывается на `postgres_changes` для таблицы `reports`, поэтому:

- карта обновляется без ручного refresh;
- кабинеты акимата и бизнеса видят новые кейсы почти сразу;
- shared-case выглядит живым на демо.

### Storage

Bucket `reports-images` используется для:

- фото обращения;
- фото результата после выполнения.

### Maps

Yandex Maps используется в двух ролях:

- обзорная карта со всеми обращениями;
- interactive point selection при создании кейса.

---

## 11. Security and operating mode

### Что уже хорошо

- backend AI secret вынесен в env;
- server patch-path валидирует допустимые поля и статусы;
- demo mode может работать без AI-key, не ломая UX;
- collaboration fields нормализуются на уровне server store.

### Что пока demo-only

- role session хранится в `localStorage`;
- frontend использует direct Supabase writes;
- полноценные RLS policies не оформлены в репозитории;
- frontend-конфигурация Supabase и Yandex пока не вынесена в env.

### Практический вывод

Сейчас система **достаточно честно собрана для demo and validation**, но ещё не готова к публичному городскому запуску без следующего слоя hardening.

---

## 12. Почему эта архитектура хороша для хакатона

Она одновременно:

- достаточно простая, чтобы показать end-to-end MVP;
- достаточно зрелая, чтобы звучать как реальный GovTech продукт;
- достаточно честная, чтобы не обещать невыполненное;
- достаточно гибкая, чтобы после хакатона перейти к production path.

Самое сильное место архитектуры не в количестве сервисов, а в том, что **в одной модели уже соединены гражданское обращение, ведомственная маршрутизация и работа частного исполнителя**.

---

## 13. Следующий инженерный шаг

Если продолжать проект после хакатона, правильная последовательность такая:

1. сделать backend единственным write-path для `reports`;
2. заменить demo-login на Supabase Auth и profiles;
3. включить RLS и role-based update policies;
4. добавить audit trail и SLA;
5. перевести `/api/analyze` на полноценный multimodal режим с `Qwen 3.5 Vision`.
