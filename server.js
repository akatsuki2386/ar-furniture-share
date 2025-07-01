// server.js
import { WebSocketServer } from 'ws';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// index.htmlを配信するための設定
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(port, () => {
  console.log(`Webサーバーがポート${port}で起動しました。`);
});

const wss = new WebSocketServer({ server });
const rooms = {};

console.log("WebSocketサーバーが起動しました。");

wss.on('connection', ws => {
    console.log("クライアントが接続しました。");
    let currentRoomId = null;

    ws.on('message', message => {
        const data = JSON.parse(message);

        if (data.type === 'createRoom') {
            currentRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            rooms[currentRoomId] = [ws];
            ws.send(JSON.stringify({ type: 'roomCreated', roomId: currentRoomId }));
            console.log(`ルーム ${currentRoomId} が作成されました。`);
        } else if (data.type === 'joinRoom') {
            if (rooms[data.roomId]) {
                currentRoomId = data.roomId;
                rooms[currentRoomId].push(ws);
                console.log(`クライアントがルーム ${currentRoomId} に参加しました。`);
            }
        } else if (data.type === 'placeObject' && currentRoomId) {
            console.log(`ルーム ${currentRoomId} で家具配置イベントを受信。`);
            rooms[currentRoomId].forEach(client => {
                if (client !== ws && client.readyState === ws.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    });

    ws.on('close', () => {
        console.log("クライアントの接続が切れました。");
        if (currentRoomId && rooms[currentRoomId]) {
            rooms[currentRoomId] = rooms[currentRoomId].filter(client => client !== ws);
            if (rooms[currentRoomId].length === 0) {
                delete rooms[currentRoomId];
                console.log(`ルーム ${currentRoomId} は空になったので削除されました。`);
            }
        }
    });
});