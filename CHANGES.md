# Changes made — aligned to "SUJITH — EMPLOYEE APP TASK ASSIGNMENT"

## Setup
Run `npm install` after unzipping (node_modules was excluded to keep the download small).

## What changed

- **API base URL** (`api/axios.ts`): now points at `/api/v1/...` per the spec. Registration
  and OTP verification still use the original un-versioned endpoints (`legacyApi`), since
  those aren't part of the Employee App v1 contract in the doc.
- **Login** (`app/(login)/index.tsx`): calls `POST /auth/login`. Token key is guessed with
  fallbacks (`token`, `data.token`, `accessToken`, `Logintoken`) — confirm the real field
  name with the backend and simplify once known.
- **Home tab** — now a read-only dashboard (`GET /dashboard/employee`): today's status,
  in/out time, hours worked, shift, late flag, pending request count. Manual GPS check-in/
  check-out was removed, since the spec implies attendance is captured by the facial
  recognition system, not by the employee tapping a button.
- **Attendance tab** (new, replaces `logs.tsx`) — History (`GET /attendance`, filterable by
  date/week/month) and Summary (`GET /attendance/summary`) as sub-tabs, with all fields from
  the doc: IN, OUT, Late, Outside, CCTV IN/OUT, Hours Worked, Early Going.
- **Requests tab** (new, replaces `request.tsx`) — "My Requests" (`GET
  /attendance-requests/my`, status badges) and "New Request" (`POST /attendance-requests`,
  all 7 request types: LATE_ARRIVAL, MISSED_IN, MISSED_OUT, OUTSIDE_ATTENDANCE,
  OUT_PERMISSION, EARLY_GOING, EMERGENCY).
- **Request Details** (new route `app/(employee)/request-details/[id].tsx`) —
  `GET /attendance-requests/:id`.
- **Notifications tab** (new) — real-time list via Firebase Realtime Database
  (`lib/firebase.ts`). **You must fill in real Firebase project credentials** — currently
  placeholders (`REPLACE_ME`), or set the `EXPO_PUBLIC_FIREBASE_*` env vars.
- **Expo push token** (`lib/notifications.ts`) — requests permission, gets the Expo push
  token, and syncs it via `PUT /auth/expo-token` on login and app restart.
- **Profile tab** (new) — `GET /auth/me`, falls back to the decoded JWT if the call fails.
- **Navigation** — 5 tabs now: Home, Attendance, Requests, Alerts (Notifications), Profile.
- **package.json / app.json** — added `expo-notifications`, `expo-device`, `firebase`, and
  the `expo-notifications` config plugin.

## Assumptions to verify with the backend team

1. Exact JSON shape each endpoint returns (all hooks assume `{ success, data }` per the
   doc's shared-contract example, with a few fallback field names for safety — see
   `hooks/useEmployeeApi.ts`).
2. The `/auth/login` response's token field name.
3. Firebase project credentials for notifications.
4. Whether attendance is *purely* system-captured (no manual check-in) — if employees
   should still be able to self-check-in/out in some scenarios, that flow can be added back
   alongside the new request-based correction flow.
