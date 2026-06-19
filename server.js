const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// Catch-all: serve index.html for any route that isn't a static file
// (prevents "Not Found" errors on reload, deep links, etc.)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- State ---
// waitingUsers: array of { socketId, interests[] }
// pairs: Map socketId -> partnerId
const waitingUsers = [];
const pairs = new Map();

function getOnlineCount() {
  return io.engine.clientsCount;
}

function findMatch(socket, interests) {
  const hasInterests = interests && interests.length > 0;
  let bestIdx = -1;
  let bestScore = -1;

  for (let i = 0; i < waitingUsers.length; i++) {
    const w = waitingUsers[i];
    if (w.socketId === socket.id) continue;

    const wHasInterests = w.interests && w.interests.length > 0;
    const common = interests.filter(x => w.interests.includes(x));

    if (hasInterests || wHasInterests) {
      // At least one side specified interests -> REQUIRE a common interest
      if (common.length === 0) continue;
      if (common.length > bestScore) {
        bestScore = common.length;
        bestIdx = i;
      }
    } else {
      // Neither side has interests -> instant random match, any waiting user works
      bestIdx = i;
      bestScore = 0;
      break;
    }
  }

  if (bestIdx !== -1) {
    const match = waitingUsers.splice(bestIdx, 1)[0];
    const matchSocket = io.sockets.sockets.get(match.socketId);
    if (!matchSocket) {
      // matched socket disconnected, try again
      return findMatch(socket, interests);
    }

    // Pair them
    pairs.set(socket.id, match.socketId);
    pairs.set(match.socketId, socket.id);

    const common = interests.filter(x => match.interests.includes(x));

    socket.emit('matched', {
      commonInterests: common,
      strangerInterests: match.interests
    });
    matchSocket.emit('matched', {
      commonInterests: common,
      strangerInterests: interests
    });
    return true;
  }

  return false;
}

io.on('connection', (socket) => {
  // Send updated online count to all
  io.emit('stats', { online: getOnlineCount(), chatting: pairs.size / 2 });

  socket.on('find_stranger', ({ interests }) => {
    // Remove from waiting if already there
    const wIdx = waitingUsers.findIndex(w => w.socketId === socket.id);
    if (wIdx !== -1) waitingUsers.splice(wIdx, 1);

    // Disconnect from current pair if any
    const partnerId = pairs.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('stranger_disconnected');
      }
      pairs.delete(socket.id);
      pairs.delete(partnerId);
    }

    const matched = findMatch(socket, interests || []);
    if (!matched) {
      waitingUsers.push({ socketId: socket.id, interests: interests || [] });
      socket.emit('waiting');
    }

    io.emit('stats', { online: getOnlineCount(), chatting: pairs.size / 2 });
  });

  socket.on('send_message', ({ message }) => {
    const partnerId = pairs.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('receive_message', { message });
    }
  });

  socket.on('typing', ({ isTyping }) => {
    const partnerId = pairs.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('stranger_typing', { isTyping });
    }
  });

  socket.on('disconnect_chat', () => {
    const partnerId = pairs.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) partnerSocket.emit('stranger_disconnected');
      pairs.delete(socket.id);
      pairs.delete(partnerId);
    }
    const wIdx = waitingUsers.findIndex(w => w.socketId === socket.id);
    if (wIdx !== -1) waitingUsers.splice(wIdx, 1);
    io.emit('stats', { online: getOnlineCount(), chatting: pairs.size / 2 });
  });

  socket.on('disconnect', () => {
    const partnerId = pairs.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) partnerSocket.emit('stranger_disconnected');
      pairs.delete(socket.id);
      pairs.delete(partnerId);
    }
    const wIdx = waitingUsers.findIndex(w => w.socketId === socket.id);
    if (wIdx !== -1) waitingUsers.splice(wIdx, 1);
    io.emit('stats', { online: getOnlineCount(), chatting: pairs.size / 2 });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ChatSpark server running on http://localhost:${PORT}`);
});
