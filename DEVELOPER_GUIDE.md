# Developer guide — Attendance & Salary Management System

This document maps the repository so a new developer can find logic quickly. The app is a React (Vite) SPA talking to a small Express + MongoDB API.

## How to run

- **Frontend:** `npm run dev` — Vite dev server; proxies `/api` to the backend (see `vite.config.ts`, `API_PORT` / `.env`).
- **API:** `npm run api` — starts `server/index.js` (default port from `API_PORT` or `3002`).
- **MongoDB:** Set `MONGODB_URI` (and optionally `MONGODB_DB`, `MONGODB_COLLECTION`) in `.env`. See `.env.example`.

## High-level architecture

```
Browser (React)
    → fetch /api/... (proxied to Express)
        → Mongoose → MongoDB (employees, holidays, soft-delete, etc.)
```

- **Entry:** `src/main.tsx` mounts `src/app/App.tsx`.
- **Routing:** `src/app/routes.tsx` — `createBrowserRouter` with `/login`, and protected routes under `/` via `ProtectedLayout`.
- **Auth:** `AuthContext` — session flag in `sessionStorage` (not JWT). Credentials are hardcoded in `AuthContext.tsx` (replace for production).
- **Data:** `EmployeeProvider` loads employees once and exposes CRUD + salary helpers. All salary math for the UI lives in `calculateSalary` in `EmployeeContext.tsx`.

## Directory map

| Path | Role |
|------|------|
| `src/app/App.tsx` | Wraps app with `AuthProvider` and `RouterProvider`. |
| `src/app/routes.tsx` | Route table: Dashboard, Add Employee, Employee detail, Reports, Login. |
| `src/app/context/` | React contexts: auth, employees/API, global month/year for views. |
| `src/app/components/` | Screens and layout (`Layout`, `ProtectedLayout`, pages). |
| `src/lib/api.ts` | `apiFetch` — JSON `fetch` to `/api` with error parsing. |
| `src/lib/formatInr.ts` | `formatInr(n)` — Indian number grouping for rupee display (keeps fractional precision). |
| `server/index.js` | Express app, Mongoose models, REST handlers, health check. |
| `vite.config.ts` | Dev/preview proxy for `/api`. |

## Contexts and hooks

### `src/app/context/AuthContext.tsx`

- **`AuthProvider`** — holds `isAuthenticated`.
- **`login(username, password)`** — validates against constants; sets session storage.
- **`logout()`** — clears session.
- **`useAuth()`** — consumer hook.

### `src/app/context/EmployeeContext.tsx`

Exports types: `Holiday`, `Employee`, `EmployeeUpdate`, `MonthDaysOnTimeEntry`, and helpers:

- **`holidayFromDateInput(isoDate, opts?)`** — builds a `Holiday` from `YYYY-MM-DD` without UTC month shift.
- **`consecutiveHolidaysFrom(isoDate, count, opts?)`** — array of consecutive calendar leave days.

**`EmployeeProvider`** state: `employees`, `loading`, `error`.

API-backed methods (all update local state after success):

| Method | Purpose |
|--------|---------|
| `refreshEmployees()` | `GET /api/employees` |
| `addEmployee(...)` | `POST /api/employees` |
| `updateEmployee(id, patch)` | `PATCH /api/employees/:id` |
| `deleteEmployee(id)` | `DELETE /api/employees/:id` (soft-delete on server) |
| `addHoliday(id, holiday)` | `POST /api/employees/:id/holidays` |
| `patchHoliday(id, date, { excludeFromDeduction })` | `PATCH /api/employees/:id/holidays/:date` |
| `removeHoliday(id, date)` | `DELETE /api/employees/:id/holidays/:date` |
| `patchMonthDaysOnTime(id, month, year, payload)` | `PATCH /api/employees/:id/month-days-on-time` |
| `getEmployee(id)` | Local find in `employees` array |

**`calculateSalary(employee, month?, year?)`** — pure client-side payroll for a calendar month:

- **Daily rate:** `employee.salary / 30`.
- **Deductible leave:** holidays in that month where `excludeFromDeduction` is not true.
- **Deduction rule:** first 2 deductible days at half-day rate (`dailyRate * 0.5` each), further days at full `dailyRate`.
- **Final salary:** `employee.salary - deduction` (full floating precision; not rounded to 2 decimals).
- **Days on time:** `30 - total leave days`, unless `monthlyDaysOnTime` has an override for that month (clamped 0–30, integer via `Math.round` on the stored override).
- Returns: `{ baseSalary, absentDays, daysOnTime, dailyRate, deduction, finalSalary }`.

### `src/app/context/ViewMonthContext.tsx`

- **`ViewMonthProvider`** — `month`, `year` for dashboards/reports; persisted in `sessionStorage`.
- **`setViewMonthYear(month, year)`** — updates state.
- **`useViewMonth()`** — hook.
- **`firstDayOfMonthIso(year, month)`** — `YYYY-MM-01` helper for date inputs.

## Page components (`src/app/components/`)

| Component | File | Responsibility |
|-----------|------|----------------|
| **Login** | `Login.tsx` | Form; calls `login()`; navigate to `/` on success. |
| **ProtectedLayout** | `ProtectedLayout.tsx` | Redirects to `/login` if unauthenticated; wraps with `EmployeeProvider` + `ViewMonthProvider` + `Layout`. |
| **Layout** | `Layout.tsx` | Top nav, logout, error banner + retry, `<Outlet />` for child routes. |
| **Dashboard** | `Dashboard.tsx` | Employee cards, month/year selectors, quick leave entry, link to detail; shows computed final salary via `calculateSalary`. |
| **AddEmployee** | `AddEmployee.tsx` | Create employee form; optional photo; calls `addEmployee`. |
| **EmployeeDetail** | `EmployeeDetail.tsx` | Edit profile, photo, leaves list, paid-leave toggle, consecutive leave, salary breakdown, attendance chart, days-on-time override. |
| **Reports** | `Reports.tsx` | Month/year report, totals, print-friendly HTML, CSV export; uses `calculateSalary` per employee. |

Shared UI under `components/ui/` is mostly generic (buttons, dialogs, etc.) from a component library pattern.

## Server (`server/index.js`)

**Helpers**

- **`runsOnManagedHost()`** — detects Render/Railway/Fly for port/URI rules.
- **`normalizeSalary(v)`** — coerces Mongo/JSON salary to a number.
- **`clampDaysOnTime0to30(v)`** — rounds and clamps days-on-time for API storage.
- **`toEmployee(doc)`** — maps Mongoose document to API shape (`id`, holidays, optional `monthlyDaysOnTime`, etc.).
- **`findActiveEmployee(id)`** — load by id excluding soft-deleted.

**Mongoose schema (summary)**

- Employee: `name`, `phone`, `salary`, optional `aadharPhoto`, `dateOfJoining`, `holidays[]`, `monthlyDaysOnTime[]`, `isDeleted`, timestamps.
- Holiday subdoc: `date`, `month`, `year`, `excludeFromDeduction`.
- Month days subdoc: `month`, `year`, `daysOnTime`.

**HTTP routes (prefix `/api`)**

| Method | Path | Handler role |
|--------|------|----------------|
| GET | `/employees` | List active employees |
| POST | `/employees` | Create |
| PATCH | `/employees/:id` | Partial update |
| DELETE | `/employees/:id` | Soft-delete (`isDeleted: true`) |
| POST | `/employees/:id/holidays` | Add leave |
| PATCH | `/employees/:id/holidays/:date` | Toggle paid / non-deducting leave |
| DELETE | `/employees/:id/holidays/:date` | Remove leave |
| PATCH | `/employees/:id/month-days-on-time` | Set or clear days-on-time override |
| GET | `/health` | Liveness + Mongo connection flag |

Salary is **not** computed on the server; the API only stores facts (salary, leaves, overrides). The client derives deductions and final pay.

## Payroll rules (reference)

1. Month = calendar month; each leave record carries `month` and `year`.
2. **Paid leave:** `excludeFromDeduction: true` — counted for attendance display but not in deduction.
3. **Deduction:** sliding scale on deductible days only (first two at half rate, rest full rate).
4. **Precision:** amounts from `calculateSalary` use JavaScript `number` precision; UI uses `formatInr` to show Indian grouping with up to 10 fraction digits (no forced 2-decimal rounding of stored values).

## Related env vars

See `.env.example` for `MONGODB_URI`, `MONGODB_DB`, `MONGODB_COLLECTION`, `API_PORT`, `CORS_ORIGIN`, `VITE_API_BASE` (empty in dev when using Vite proxy).
