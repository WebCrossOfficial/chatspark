# ChatSpark 🔥
**Omegle-style random chat with interest matching**

---

## Features
- Real-time 1-on-1 chat using **Socket.io**
- **Interest matching** — users with common interests get paired first
- Typing indicator (live)
- Online / chatting live stats
- Next stranger & disconnect buttons
- Mobile responsive dark UI

---

## Setup & Run

### Requirements
- Node.js v16+ installed

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
```

Server starts at: **http://localhost:3000**

For development with auto-reload:
```bash
npm run dev
```

---

## Project Structure

```
chatspark/
├── server.js          ← Node.js + Socket.io backend
├── package.json
└── public/
    ├── index.html     ← Main page
    ├── css/
    │   └── style.css  ← All styles
    └── js/
        └── app.js     ← Frontend Socket.io client
```

---

## How It Works

1. User opens the site, optionally adds interests
2. Clicks "Find a Stranger" → emits `find_stranger` to server
3. Server tries to match with someone sharing common interests
4. If no match found, user waits in queue
5. On match → both users get `matched` event with common interests
6. Messages flow via `send_message` / `receive_message` events
7. Typing status via `typing` / `stranger_typing` events
8. Disconnect via `disconnect_chat` event

---

## Deploy to Production

Works on any Node.js host:
- **Railway** → `railway up`
- **Render** → connect GitHub repo
- **VPS** → run with `pm2 start server.js`

Set `PORT` environment variable if needed (default: 3000).
