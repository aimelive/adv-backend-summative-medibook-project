# My Implementation

MediBook clinic appointment API: Node.js + Express, MySQL 8 (raw parameterized `mysql2` queries, no ORM), Redis + BullMQ.

## Prerequisites

- Node.js 20+ and npm
- MySQL 8 (CHECK constraints and window functions/CTEs are required)
- Redis (on Windows, use [Memurai](https://www.memurai.com/) or WSL)

## Setup

1. Copy `.env.example` to `.env` and fill in your MySQL/Redis settings (`DB_*`, `REDIS_*`, `PORT`).
2. Create the schema, then the sample data:
   ```
   mysql -u root -p < database/schema.sql
   mysql -u root -p < database/seed.sql
   ```
   `schema.sql` drops and recreates the `medibook` database.
3. `npm install`
4. `npm start` (API on `PORT`, default 3000)
5. In a second terminal: `npm run worker` (waitlist promotion + confirmation jobs)
6. `npm test` (unit tests only; they need no MySQL or Redis)

## Endpoints

| Method | Path | Purpose | Success |
|---|---|---|---|
| GET | `/api/patients` | List patients | 200 |
| POST | `/api/patients` | Create patient | 201 |
| GET | `/api/patients/:id` | Get patient | 200 |
| PUT | `/api/patients/:id` | Update patient | 200 |
| DELETE | `/api/patients/:id` | Delete patient (409 if it has appointments) | 204 |
| GET | `/api/doctors` | List doctors | 200 |
| POST | `/api/doctors` | Create doctor | 201 |
| GET | `/api/doctors/:id` | Get doctor | 200 |
| PUT | `/api/doctors/:id` | Update doctor | 200 |
| DELETE | `/api/doctors/:id` | Delete doctor (409 if it has appointments) | 204 |
| GET | `/api/doctors/:id/stats` | Revenue, upcoming count, next-7-day counts, utilization % | 200 |
| POST | `/api/appointments` | Book (`patient_id`, `doctor_id`, `appt_datetime`) | 201 |
| PATCH | `/api/appointments/:id/cancel` | Cancel; response includes refund percent and amount | 200 |
| POST | `/api/waitlist` | Join waitlist (`patient_id`, `doctor_id`, `date`) | 201 |
| GET | `/api/reports/doctors` | Per-doctor appointments and revenue (incl. zero) | 200 |
| GET | `/api/reports/busy-days` | Doctor-days over 80% of the 12-slot cap | 200 |
| GET | `/feedback?lang=fr` | Localized feedback form (default `en`) | 200 |
| POST | `/feedback` | Localized thank-you page (answers not stored) | 200 |

Errors: `400` validation, `404` not found, `409` conflict (slot taken, day full, duplicate), `422` rule violation (past or out-of-hours slot).

## Justifications

### Part C — Appointments

**Concurrency.** Booking runs in one transaction that first locks the doctor row (`SELECT ... FOR UPDATE`). Concurrent bookings for the same doctor are serialized, so the "count today's bookings, then insert" check cannot be raced past the 12-per-day cap. Slot uniqueness is enforced by the database, not by application code: the `uq_doctor_slot` unique key on `(doctor_id, appt_datetime, active_slot)`. If two requests arrive at the same instant, one insert fails with `ER_DUP_ENTRY` and becomes a `409`.

**Refund boundaries.** Notice is measured from the cancellation time to the appointment time:
- more than 48 hours: 100%
- 24 hours up to and including 48 hours: 50% (so exactly 48h = 50%, exactly 24h = 50%)
- less than 24 hours: 0%

The tiers live in `src/config/constants.js`, and `calculateRefund` is a pure function covered by boundary tests. The cancellation and its refund amount are written in a single UPDATE inside a transaction on a locked row, so they succeed or fail together.

**Cancelled slots.** Cancelled rows are kept for refund history, but their slot must be bookable again. `active_slot` is a stored generated column: `1` while `status = 'booked'`, `NULL` once cancelled. MySQL unique indexes ignore rows with `NULL`, so cancelled rows never collide with a new booking, while two booked rows for the same doctor and time still do.

**Revenue.** Revenue collected = `SUM(amount_paid - COALESCE(refund_amount, 0))` over all of a doctor's appointments. Booked appointments count in full; a cancelled one counts only the part not refunded. Both the doctor stats and the doctors report use this definition, computed in SQL (`LEFT JOIN`, so doctors with no appointments show 0).

### Part D — Audit log

`src/utils/auditLog.js` appends one JSON line (`timestamp`, `event`, data) to `logs/audit.log` with `fs/promises`, so nothing blocks the event loop. It runs `mkdir(logs, { recursive: true })` before each write, so the directory is created on first use. The whole function is wrapped in `try/catch`: a failure is only printed to the console and never thrown, so logging can't fail a booking or cancellation. `logs/` is git-ignored.

### Part E — Waitlist

When a booking is refused because the slot is taken or the day is full, the `409` response includes a waitlist offer. `POST /api/waitlist` pushes the patient onto a Redis list keyed by doctor and date (`waitlist:<doctor>:<date>`); duplicates are rejected. Cancelling enqueues a `slot-freed` BullMQ job, which the separate worker handles. The worker moves the first patient atomically (`LMOVE`) from the waitlist into a `waitlist:processing:...` list, then books them through the same `bookAppointment` service the API uses.

**If the promoted booking fails** (slot retaken, patient deleted, any error), the worker puts the patient back at the head of the waitlist and writes a `waitlist.promotion_failed` audit entry. On success, the patient is removed from the processing list. If the worker crashes mid-promotion, the patient is still in the processing list, and `recoverProcessing()` moves them back to the waitlist at worker startup. A patient is therefore always in the waitlist, the processing list, or the appointments table.

Every confirmed booking also enqueues a `confirmation` job; the worker writes the message to the audit log.

---

# Final Assessment — Backend Development

**Weight:** 30% of final grade
**Duration:** 2 weeks
**Mode:** Individual project
**Stack (mandatory):** Node.js, Express.js, MySQL (with parameterized queries only), Redis

---

## Scenario — "MediBook" Clinic Appointment System

A community clinic wants a backend service for booking doctor appointments. Doctors see patients in fixed 30-minute slots during working hours (09:00–17:00), each doctor can handle at most **12 appointments per day**, and the clinic administrator needs reports. You will design the database, build the API, and handle the operational concerns (background jobs, logging, testing).

**Entity limit:** Your database must contain **exactly 3 entities**:

| Entity | Purpose |
|---|---|
| `patients` | People who book appointments |
| `doctors` | Doctors with a specialty, consultation fee, and room |
| `appointments` | A patient's booking with a doctor at a specific date/time (links the other two) |

You may add columns as needed, but no additional tables (lookup/locale JSON files don't count).

---

## Part A — Database Design & Normalization

The clinic currently tracks everything in this single spreadsheet:

| appt_ref | patient_name | patient_email | patient_phone | doctor_name | specialty | consultation_fee | room | appt_datetime | amount_paid | booked_on |
|---|---|---|---|---|---|---|---|---|---|---|
| AP-001 | Ama Mensah | ama@mail.com | 0244-111-222 | Dr. Boateng | Dermatology | 150.00 | R-12 | 2026-08-10 09:00 | 150.00 | 2026-07-01 |
| AP-002 | Kojo Owusu | kojo@mail.com | 0555-333-444 | Dr. Boateng | Dermatology | 150.00 | R-12 | 2026-08-10 09:30 | 120.00 | 2026-07-02 |
| AP-003 | Ama Mensah | ama@mail.com | 0244-111-222 | Dr. Adjei | Paediatrics | 100.00 | R-03 | 2026-08-15 10:00 | 100.00 | 2026-07-03 |

Study the spreadsheet, then produce a **database schema diagram** of your design in fully normalized form (up to 3NF). The diagram must show **everything**:

- all 3 entities with every column and its MySQL data type,
- primary keys and foreign keys, clearly marked,
- the relationships between the entities and their cardinality (1:N, etc.),
- every constraint that enforces a business rule (`NOT NULL`, `UNIQUE`, `CHECK`) — in particular, it must be visible from the diagram that *a doctor cannot have two appointments at the same date/time*.

Use any tool you like (dbdiagram.io, draw.io) and include it in your repository as `schema-diagram` (image or PDF).

## Part B — Database Implementation & Project Setup

1. **Table creation.** Translate your Part A diagram into a MySQL DDL script, `database/schema.sql`, that creates the database and the 3 tables — data types, primary keys, foreign keys, and every constraint shown on the diagram. The script must run cleanly on a fresh MySQL server. Also provide `database/seed.sql` with realistic sample data: at least 3 patients, 3 doctors (including one with no appointments), and 8 appointments (including one doctor-day at or near the 12-slot daily cap).

2. **Project structure.** Set up the Express project in a **models / controllers / routes** structure:

```
├── database/          schema.sql and seed.sql (Part B.1)
└── src/
    ├── models/        all application SQL lives here — nowhere else
    ├── controllers/   business logic; calls model functions, never the DB directly
    └── routes/        maps URLs and HTTP methods to controllers
```

Every SQL statement in the application must use **parameterized queries** (`?` placeholders via `mysql2`). SQL found in a controller or route file loses marks. **Do not use any ORM for this assignment.**

## Part C — Controllers & Endpoints

Implement endpoints for the operations below. **Designing the API is part of the assessment**: you choose the URL paths, the HTTP methods, and how the endpoints are grouped into controllers and routes — your choices should follow REST conventions and will be marked. The business rules listed are **requirements** — *how* you satisfy them is your design decision, and you will be asked to defend it at the viva.

1. **Basic CRUD** — standard **C**reate, **R**ead (one and all), **U**pdate, and **D**elete operations for patients and for doctors, with sensible validation. (Appointments get their create/delete behaviour from the two operations below — no separate CRUD needed there.)

2. **Book an appointment**. Rules that must always hold:
   - Appointments can only be booked in the future, within working hours (09:00–17:00), on a 30-minute slot boundary.
   - A doctor never exceeds 12 appointments in a day.
   - Two patients can never hold the same doctor slot — even when both requests arrive at the same instant.

3. **Cancel an appointment**. Rules:
   - The refund is computed by the server from the notice given: more than 48 hours → 100%; 24–48 hours → 50%; less than 24 hours → 0%. The response states the refund amount.
   - The cancellation and its refund record succeed or fail together.
   - A cancelled slot becomes bookable by another patient, while the cancellation record is kept for refund history.
   - A cancellation notifies the waitlist (Part E).

4. **Doctor statistics** — for a given doctor: revenue collected, upcoming appointment count, appointments per day for the next 7 days, and utilization % against the 12-slot daily cap.

Operations 5 and 6 are where your **advanced SQL** is assessed: the results must be produced by the SQL in your models (joins, aggregates, etc) — not fetched raw and computed in JavaScript.

5. **Doctors report** — every doctor's total appointments and revenue collected, including doctors with zero appointments.
6. **Busy days report** — every (doctor, date) where more than 80% of the 12-slot daily capacity is booked.

### General requirements (all endpoints)

Input validation with meaningful `400` messages; correct status codes (`201`, `404`, `409`, `422`); a central error-handling middleware.

## Part D — Node.js `fs` Module

**Audit log:** every successful booking and cancellation must be appended as a JSON line to `logs/audit.log` using the `fs` module (async, non-blocking — no `*Sync` calls inside request handlers). The logger must create the `logs/` directory on first run if it doesn't exist, and a logging failure must **not** fail the user's request.

## Part E — Queues & Redis

1. **Waitlist queue:** when the requested slot (or the doctor's whole day) is fully booked, offer the patient a waitlist spot — push them onto a queue (Redis list, or Bull/BullMQ). When a cancellation frees a slot, a **worker process** (separate from the web server) pops the first waitlisted patient and books them in. Think through: what happens if the promoted booking itself fails? The patient must not simply vanish from both the queue and the appointments table.
2. **Notification jobs:** every confirmed appointment enqueues a "confirmation SMS/email" job; the worker processes it by writing the message to the audit log (no real sending needed).

## Part F — Unit Testing

Using Jest, write **at least 6 meaningful unit tests**:

- The refund calculator from Part C.3 — cover all three tiers **and both boundaries** (exactly 24 hours, exactly 48 hours). Boundary behaviour must match your documented policy.
- One validation function of your choice — e.g., the slot-alignment/working-hours check — including at least one edge case (17:00 exactly? 09:15? a malformed date?).

Tests must not require a live MySQL or Redis connection — that's the point of extracting pure functions. `npm test` must run them.

## Part G — i18n & l10n: Course Feedback Page

Create a **simple HTML page** (served by your Express app at `GET /feedback`) containing a short course-feedback form with **exactly 5 essay questions** (each answered in a `<textarea>`):

1. Which topic in this course did you find most challenging, and why?
2. Describe one concept you understood only after the practical assignments. What made it click?
3. How has your approach to designing databases or APIs changed since the start of the trimester?
4. What would you improve about how this course was taught or assessed?
5. How do you plan to apply what you learned in this course going forward?

**i18n/l10n requirement (keep it simple):** the page title, instructions, and all 5 questions must be loaded from locale files (e.g., `locales/en.json` and `locales/fr.json` — English plus one other language of your choice). Visiting `/feedback?lang=fr` shows the translated page; the default is English, and an unsupported `lang` value must fall back to English rather than crash. Display today's date on the page formatted for the active locale (e.g., using `Intl.DateTimeFormat`).

---

## Submission Requirements

- Git repository (with meaningful commit history — a single "final commit" will be questioned) containing:
  - `schema-diagram` (image or PDF), `schema.sql`, and `seed.sql` (as specified in Part B)
  - Application source, worker process, tests, locale files
  - `README.md` with: setup steps, `.env.example`, and the short written justifications requested in Parts C, D, and E
- The app must start with `npm install && npm start` (plus documented MySQL/Redis setup) and tests with `npm test`.
- A short **viva/demo (10 minutes)** walkthrough.

**Automatic penalties:** SQL injection vector anywhere in the app (−15), secrets committed to the repo (−5), app does not start per README instructions (−10), work the student cannot explain in the video (or at a follow-up viva if called) | Academic integrity referral; affected criteria re-scored at Developing or below |
