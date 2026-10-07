# pachavellam-chat

Realtime chat service (TypeScript + Express + Socket.IO + Knex) for the Pachavellam PSC platform.

It shares the MySQL database that the Laravel app (`pachavellam-website`) owns and migrates — this
service never runs migrations itself, it only reads/writes tables Laravel creates. Authentication
reuses the same JWT Laravel issues (`php-open-source-saver/jwt-auth`); this service verifies tokens
directly via the shared `JWT_SECRET`, with no callback to Laravel needed for either REST requests or
Socket.IO connections.

## Features

- Individual, group, and course-group conversations with cursor-based pagination
- Text, image/video/document, and voice-note messages
- Reactions, @mentions (server-validated against actual participants), reply, forward, search
- Group management: roles/permissions, shareable join-links, a public group directory
- Mute/unmute with mention-bypass
- Offline-recipient push dispatch to the Laravel app's internal push endpoint

## Development

```bash
cp .env.example .env   # fill in DB_*, JWT_SECRET (must match Laravel's), CHAT_PUSH_INTERNAL_SECRET
npm install
npm run dev             # tsx watch
npm run build && npm start   # production
```

See `.env.example` for every required variable.
