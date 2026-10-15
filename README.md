# ChatApp

WhatsApp-style 1-to-1 chat with voice and video calls.

- **backend/**: Node.js, Express 5, Socket.IO, MongoDB (Mongoose), Cloudinary
- **mobile/**: React Native (Expo SDK 57 dev build), expo-router, react-native-webrtc

## Features

| Feature | How it works |
|---|---|
| Real-time chat (1-to-1 only) | Socket.IO `message:send` with ack; one conversation per user pair |
| Sent / delivered / seen ticks | ack = ✓, receiver online or reconnects = ✓✓, chat opened = blue ✓✓ |
| Online / offline / last seen / typing | Presence tracked per socket; `presence:update` and `typing` events |
| Images, videos, voice notes | Uploaded through `POST /api/media` to Cloudinary, then sent as a message |
| Media deleted after 24h | Cron job (`MEDIA_CLEANUP_CRON`, every 15 min) deletes expired Cloudinary files; bubble shows "expired" |
| Messages deleted after 3 days | MongoDB TTL index on `Message.expiresAt` |
| Voice and video calls | WebRTC peer-to-peer; Socket.IO carries offer/answer/ICE; busy, reject, missed, call history |
| Push notifications | Expo push for new messages, incoming calls and missed calls while the app is closed |
| Login | Phone number + password (bcrypt, JWT access + refresh tokens) |

Voice notes follow the 3-day message lifetime by default. Set `AUDIO_TTL_HOURS=24` in `backend/.env` to delete them after 24h like photos and videos.

## 1. Backend

Requirements: Node 18+, MongoDB (local or Atlas), a Cloudinary account.

```sh
cd backend
npm install
cp .env.example .env   # then fill in MONGO_URI, JWT secrets, CLOUDINARY_*, TURN_*
npm run dev            # http://localhost:4000, health check at /health
```

Smoke test (uses an in-memory MongoDB, no setup needed):

```sh
npm run test:socket
```

It covers auth, ticks, presence, typing, seen/unread, history paging, the media cleanup job, and call signaling (ring, ICE buffering, answer, busy, reject, hangup).

### TURN server (required for calls on mobile data)

STUN alone only works when both phones are on friendly networks (often the same Wi-Fi). For real-world calls set `TURN_URLS`, `TURN_USERNAME` and `TURN_CREDENTIAL`. Quickest option: a free Metered.ca TURN account; or self-host `coturn`.

## 2. Mobile app

Calls need native WebRTC, so the app runs as a **development build**, not Expo Go.

```sh
cd mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL to your computer's LAN IP, e.g. http://192.168.1.10:4000
npx expo run:android   # or: npx expo run:ios   (needs Android Studio / Xcode)
```

After the first native build, day-to-day work only needs `npm start`.

No local Android Studio/Xcode? Build in the cloud: `npx eas-cli@latest build --profile development`.

### Push notifications

Push tokens need an EAS project id: run `npx eas-cli@latest init` once in `mobile/` (it writes `extra.eas.projectId` into app config). Android push also needs FCM credentials uploaded with `eas credentials`. Push only works on physical devices.

### Checks

```sh
npm run typecheck
npm run lint
npx expo-doctor
```

## Known limits / next steps

- Incoming calls while the app is killed show a high-priority notification; tapping it opens the app and the ringing call. A native full-screen ringing UI (CallKit / ConnectionService via `react-native-callkeep` and iOS VoIP push) is the next step.
- Socket presence and call state live in memory, so run one backend instance. To scale out, add `@socket.io/redis-adapter` and move that state to Redis.
- `react-native-webrtc` is pinned to 124.0.8 (the line the Expo config plugin is tested with). 155.0.0 came out on 2026-10-14 and is untested with the plugin.
# Chat-app
