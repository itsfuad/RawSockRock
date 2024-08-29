# RawSockRock

RawSockRock is a powerful and flexible real-time communication library that provides seamless WebSocket functionality for both client and server-side applications.

## Server-Side Usage

The server-side component of RawSockRock is built on top of Socket.IO and Hono, offering a robust and scalable solution for handling WebSocket connections.

### Features

- Easy-to-use event-based communication
- Room management for group messaging
- Broadcast capabilities
- Acknowledgment support for reliable message delivery

### Example

```ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const io = new Server();

io.on("connection", (socket) => {
  // Handle various events like join, message, leave, and disconnect
  // ...
});

const app = new Hono();

app.get("/ws", (ctx) => {
  return io.handler(ctx.req.raw);
});

serve(app.fetch, { port: 3000 });
```

## Client-Side Usage

The client-side component of RawSockRock is built on top of the native WebSocket API, providing a lightweight and efficient solution for establishing WebSocket connections.

```js
import { Socket } from "./socket.js";

const socket = new Socket("ws://localhost:3000/ws");

socket.on("connect", () => {
  // Handle connection event
});

socket.on("message", (data) => {
  // Handle message event
});

socket.on("disconnect", () => {
  // Handle disconnection event
});
```