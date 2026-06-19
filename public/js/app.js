const socket = io();

// ===== STATE =====
let userInterests = [];
const SUGGESTED = ['gaming', 'music', 'cricket', 'coding', 'movies', 'fitness', 'travel', 'anime', 'cooking', 'tech', 'books', 'photography'];
const AVATARS = ['😎', '🎮', '🎵', '📚', '🏏', '🌍', '🎨', '💻', '🎭', '🏋️', '🎤', '🌸'];
let isConnected = false;
let typingTimer = null;
let isTyping = false;

// ===== DOM REFS =====
const screens = {
  home: document.getElementById('screen-home'),
  finding: document.getElementById('screen-finding'),
  chat: document.getElementById('screen-chat'),
};
const tagsContainer = document.getElementById('tags-container');
const interestInput = document.getElementById('interest-input');
const matchingInterests = document.getElementById('matching-interests');
const findSub = document.getElementById('find-sub');
const messages = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const commonBadge = document.getElementById('common-badge');
const strangerAvatar = document.getElementById('stranger-avatar');
const statOnline = document.getElementById('stat-online');
const statChatting = document.getElementById('stat-chatting');

// ===== SCREEN SWITCHER =====
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ===== SUGGESTED TAGS =====
function renderSuggested() {
  const container = document.getElementById('suggested-tags');
  container.innerHTML = '';
  SUGGESTED.filter(s => !userInterests.includes(s)).slice(0, 6).forEach(s => {
    const span = document.createElement('span');
    span.className = 'sug-tag';
    span.textContent = s;
    span.onclick = () => addInterest(s);
    container.appendChild(span);
  });
}

// ===== INTERESTS =====
function addInterest(val) {
  val = (val || interestInput.value).trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
  if (!val || userInterests.includes(val) || userInterests.length >= 8) return;
  userInterests.push(val);
  interestInput.value = '';
  renderTags();
  renderSuggested();
}

function removeInterest(i) {
  userInterests.splice(i, 1);
  renderTags();
  renderSuggested();
}

function renderTags() {
  if (userInterests.length === 0) {
    tagsContainer.innerHTML = '<span class="empty-tags">No interests yet — add some above</span>';
    return;
  }
  tagsContainer.innerHTML = '';
  userInterests.forEach((t, i) => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.innerHTML = `${t} <button class="remove-tag" title="Remove">×</button>`;
    span.querySelector('.remove-tag').onclick = () => removeInterest(i);
    tagsContainer.appendChild(span);
  });
}

// ===== FINDING =====
function startFinding(skipInterests = false) {
  const interests = skipInterests ? [] : [...userInterests];

  if (interests.length > 0) {
    matchingInterests.innerHTML = interests.map(t => `<span class="tag">${t}</span>`).join('');
    findSub.textContent = 'Matching your interests with others...';
  } else {
    matchingInterests.innerHTML = '';
    findSub.textContent = 'Connecting to a random stranger...';
  }

  isConnected = false;
  showScreen('finding');
  socket.emit('find_stranger', { interests });
}

// ===== CHAT HELPERS =====
function clearMessages() {
  messages.innerHTML = '';
}

function addMsg(text, type) {
  const div = document.createElement('div');
  div.className = `msg ${type}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function setInputEnabled(enabled) {
  msgInput.disabled = !enabled;
  sendBtn.disabled = !enabled;
  if (enabled) msgInput.focus();
}

function setTypingIndicator(show) {
  typingIndicator.className = show ? 'typing-indicator show' : 'typing-indicator';
  messages.scrollTop = messages.scrollHeight;
}

function sendTypingEvent(typing) {
  if (isConnected && typing !== isTyping) {
    isTyping = typing;
    socket.emit('typing', { isTyping: typing });
  }
}

// ===== SEND MESSAGE =====
function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !isConnected) return;
  socket.emit('send_message', { message: text });
  addMsg(text, 'me');
  msgInput.value = '';
  msgInput.style.height = 'auto';
  sendTypingEvent(false);
}

// ===== SOCKET EVENTS =====
socket.on('stats', ({ online, chatting }) => {
  statOnline.textContent = Number(online).toLocaleString();
  statChatting.textContent = Number(Math.floor(chatting)).toLocaleString();
});

socket.on('waiting', () => {
  findSub.textContent = 'Waiting for a stranger to connect...';
});

socket.on('matched', ({ commonInterests, strangerInterests }) => {
  isConnected = true;
  clearMessages();

  // Random avatar
  strangerAvatar.textContent = AVATARS[Math.floor(Math.random() * AVATARS.length)];

  // Common interests badge
  if (commonInterests && commonInterests.length > 0) {
    commonBadge.textContent = '✦ ' + commonInterests.join(', ');
    commonBadge.style.display = 'inline-block';
    addMsg(`You matched on: ${commonInterests.join(', ')} 🎉`, 'system');
  } else {
    commonBadge.style.display = 'none';
    addMsg('Connected! No common interests found, but say hi anyway 👋', 'system');
  }

  addMsg('You are now connected with a stranger.', 'system');
  setInputEnabled(true);
  setTypingIndicator(false);
  showScreen('chat');
});

socket.on('receive_message', ({ message }) => {
  setTypingIndicator(false);
  addMsg(message, 'stranger');
});

socket.on('stranger_typing', ({ isTyping }) => {
  setTypingIndicator(isTyping);
});

socket.on('stranger_disconnected', () => {
  isConnected = false;
  setTypingIndicator(false);
  addMsg('Stranger has disconnected.', 'system');
  addMsg('Click "Next →" to find a new stranger.', 'system');
  setInputEnabled(false);
});

socket.on('disconnect', () => {
  isConnected = false;
  addMsg('Connection lost. Trying to reconnect...', 'system');
  setInputEnabled(false);
});

socket.on('connect', () => {
  // Re-enable if reconnected on chat screen
  if (screens.chat.classList.contains('active') && isConnected) {
    setInputEnabled(true);
  }
});

// ===== BUTTON EVENTS =====
document.getElementById('add-btn').onclick = () => addInterest();
interestInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addInterest(); }
});

document.getElementById('start-btn').onclick = () => startFinding(false);
document.getElementById('skip-btn').onclick = () => startFinding(true);
document.getElementById('cancel-btn').onclick = () => {
  socket.emit('disconnect_chat');
  showScreen('home');
};

document.getElementById('next-btn').onclick = () => {
  socket.emit('disconnect_chat');
  startFinding(userInterests.length === 0);
};

document.getElementById('end-btn').onclick = () => {
  socket.emit('disconnect_chat');
  isConnected = false;
  showScreen('home');
};

sendBtn.onclick = sendMessage;

msgInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto resize textarea
msgInput.addEventListener('input', () => {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';

  // Typing indicator logic
  if (msgInput.value.trim()) {
    sendTypingEvent(true);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => sendTypingEvent(false), 2000);
  } else {
    sendTypingEvent(false);
  }
});

// ===== INIT =====
renderTags();
renderSuggested();
setInputEnabled(false);
