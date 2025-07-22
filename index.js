const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(cors());
const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`🚀 Signaling server running on http://localhost:${port}`);
});

const wss = new WebSocket.Server({ server });

const clients = new Map(); // uid -> socket

wss.on('connection', (socket) => {
  let uid = null;

  socket.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);

      // Step 1: Auth
      if (data.type === 'auth') {
        const decoded = await admin.auth().verifyIdToken(data.token);
        uid = decoded.uid;
        clients.set(uid, socket);
        console.log(`✅ Authenticated: ${uid}`);
        return;
      }

      // Step 2: Handle signaling
      if (['offer', 'answer', 'ice'].includes(data.type)) {
        const { to, payload } = data;
        const targetSocket = clients.get(to);
        if (targetSocket) {
          targetSocket.send(JSON.stringify({
            type: data.type,
            from: uid,
            payload,
          }));
        }
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
    }
  });

  socket.on('close', () => {
    if (uid) {
      clients.delete(uid);
      console.log(`👋 Disconnected: ${uid}`);
    }
  });
});
