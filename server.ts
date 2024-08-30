// server.ts

import { serve } from "https://deno.land/std@0.166.0/http/server.ts";
import { Hono } from "https://deno.land/x/hono@v3.12.4/mod.ts";
import { serveStatic } from "https://deno.land/x/hono@v3.12.4/middleware.ts";
import { connect } from "https://deno.land/x/redis@v0.32.1/mod.ts";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";
const { host, port, password } = Deno.env.toObject();

import { RedisAdapter } from "./redis-adapter/adapter.ts";
import { Server } from "./websockets/websocket.ts";

console.log("Connecting to Redis");

const pub = await connect({
	hostname: host,
	port: +port,
	password: password,
	maxRetryCount: 5,
});

console.log("Connected to Pub");

const sub = await connect({
	hostname: host,
	port: +port,
	password: password,
	maxRetryCount: 5,
});

console.log("Connected to Sub");



const io = new Server();
const adapter = new RedisAdapter(pub, sub, io);
io.useAdapter(adapter);

io.on("connection", (socket) => {
    console.log(`socket ${socket.id} connected`);

    socket.emit("hello", "world");

    socket.on("join", (room: string, username: string, callback: (r: string) => void) => {
        console.log("Received join event", room);
        io.joinRoom(socket, room);
        console.log(`socket ${socket.id} joined room ${room}`);
        socket.emit("server", `You joined room ${room}`, 'join');
        io.broadcastToRoom(room, "server", socket, `${username} joined room ${room}`, 'join');
        callback(room); // Send the acknowledgment back to the client
    });

    socket.on("message", (message: string, username: string, room: string, fn: (status: string) => void) => {
        console.log("Message received:", message);
        console.log("Room:", room);
        io.broadcastToRoom(room, "message", socket, message, username);
        fn("ok");
    });

    socket.on("leave", (room: string, username: string, callback: (r: string) => void) => {
        callback(room);
        io.leaveRoom(socket, room);
        io.broadcastToRoom(room, "server", socket, `${username} left room ${room}`);
        console.log(`${username} left room ${room}`);
    });

    socket.on("disconnect", (reason: string) => {
        console.log(`socket ${socket.id} disconnected due to`, reason);
        io.emitToAll("server", `${socket.id} disconnected`, 'leave');
    });
});

const app = new Hono();
//cors allows all origins
app.use((ctx, next) => {
    ctx.res.headers.set("Access-Control-Allow-Origin", "*");
    ctx.res.headers.set("Access-Control-Allow-Headers", "*");
    ctx.res.headers.set("Access-Control-Allow-Methods", "*");
    return next();
});

app.get("/ws", (ctx) => {
    return io.handler(ctx.req.raw);
});


app.use('*', serveStatic({ root: './client' }))

const randomPorts = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009];

for (const port of randomPorts) {
    try {
        const listener = Deno.listen({ port });
        listener.close(); // Release the port immediately
        await serve(app.fetch, { port });
        console.log(`Server running on port ${port}`);
        break;
    } catch (_) {
        console.error(`Port ${port} is in use or cannot be opened, trying next port`);
    }
}
