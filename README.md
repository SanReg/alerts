# Orders -> ntfy notifier (Node)

A minimal Node script that listens to MongoDB change streams on `hello.orders` and `hello.tickets` and posts to ntfy when new documents are inserted.

## Configure
Copy `.env.example` to `.env` and fill in:
- `MONGODB_URI` — your Atlas connection string
- `DB_NAME` — default `hello`
- `NTFY_SERVER` — default `https://ntfy.sh`
- `NTFY_TOPIC` — a long random topic name (used if per-collection topics are not set)
- `NTFY_TOPIC_ORDERS` — optional: topic for `orders`
- `NTFY_TOPIC_TICKETS` — optional: topic for `tickets`
- `NTFY_PRIORITY` — optional: 1..5, default 5 (high)
- `NTFY_AUTH` — optional auth header (e.g., `Bearer <token>`) if using a private ntfy

## Run locally
```bash
cd notifier
npm install
npm start
```
The script connects, opens change streams for both collections (if topics are provided), and posts to ntfy on inserts.

## Test
Insert a document (replace URI/db/collection as needed):
```javascript
db.getSiblingDB('hello').orders.insertOne({ createdAt: new Date(), items: 1 })
```
You should see a notification in the ntfy app subscribed to your topic.

## Deploy options
- Railway/Render/Fly: run `npm start` as a worker; set env vars from `.env`.
- PM2 on a VM: `pm2 start index.js --name orders-notifier` (after setting env vars).
- Docker: create a simple `Dockerfile` if you want a containerized run (ask if needed).

## Notes
- Uses change streams; ensure your cluster is replica set-backed (Atlas free/paid works).
- For private topics, set `NTFY_AUTH` and point `NTFY_SERVER` to your host.
