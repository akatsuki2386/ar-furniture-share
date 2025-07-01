// ★変更点: requireからimportに書き方を変更
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws'; // wsライブラリのインポート方法も変更
import path from 'path';
import { fileURLToPath } from 'url';

// ESモジュールでは__dirnameが使えないため、同等の機能を実現するおまじない
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Expressアプリを作成
const app = express();
// HTTPサーバーを作成
const server = http.createServer(app);
// WebSocketサーバーをHTTPサーバーにアタッチ (★変更点: new WebSocketServer)
const wss = new WebSocketServer({ server });

const rooms = {}; // 全ルームの状態を管理するオブジェクト

// 静的ファイル（glb, cssなど）を配信
app.use(express.static(path.join(__dirname)));

// ルートURLへのアクセス時にindex.htmlを返す
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// WebSocketの接続処理
wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.roomId = null; // 各クライアントにルームIDを保持させる

  ws.on('message', (message) => {
    try {
        const data = JSON.parse(message);

        switch (data.type) {
          case 'createRoom': {
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            ws.roomId = roomId;
            rooms[roomId] = {
              clients: new Set([ws]),
              objects: []
            };
            console.log(`Room created: ${roomId}`);
            ws.send(JSON.stringify({ type: 'roomCreated', roomId: roomId }));
            updateConnectionCount(roomId);
            break;
          }

          case 'joinRoom': {
            const roomId = data.roomId;
            if (rooms[roomId]) {
              ws.roomId = roomId;
              rooms[roomId].clients.add(ws);
              console.log(`Client joined room: ${roomId}`);
              ws.send(JSON.stringify({ type: 'initialState', objects: rooms[roomId].objects }));
              updateConnectionCount(roomId);
            } else {
              console.log(`Room not found: ${roomId}`);
            }
            break;
          }

          case 'placeObject':
          case 'updateObject': {
            const roomId = ws.roomId;
            if (rooms[roomId]) {
              const existingObjectIndex = rooms[roomId].objects.findIndex(o => o.uuid === data.object.uuid);
              if (existingObjectIndex > -1) {
                rooms[roomId].objects[existingObjectIndex] = data.object;
              } else {
                rooms[roomId].objects.push(data.object);
              }
              broadcast(roomId, JSON.stringify(data), ws);
            }
            break;
          }
            
          case 'deleteObject': {
            const roomId = ws.roomId;
            if (rooms[roomId]) {
                rooms[roomId].objects = rooms[roomId].objects.filter(o => o.uuid !== data.uuid);
                broadcast(roomId, JSON.stringify(data), ws);
            }
            break;
          }
        }
    } catch (error) {
        console.error("Failed to parse message or handle logic:", error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    const roomId = ws.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId].clients.delete(ws);
      if (rooms[roomId].clients.size === 0) {
        delete rooms[roomId];
        console.log(`Room closed: ${roomId}`);
      } else {
        updateConnectionCount(roomId);
      }
    }
  });
});
    
function updateConnectionCount(roomId) {
    if (rooms[roomId]) {
        const count = rooms[roomId].clients.size;
        const message = JSON.stringify({ type: 'updateConnections', count: count });
        rooms[roomId].clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(message);
            }
        });
    }
}

function broadcast(roomId, message, senderToExclude) {
    if (rooms[roomId]) {
        rooms[roomId].clients.forEach(client => {
            if (client !== senderToExclude && client.readyState === 1) { // WebSocket.OPEN
                client.send(message);
            }
        });
    }
}

// サーバーを起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
