import { serve } from "https://deno.land/std@0.166.0/http/server.ts";
import { Hono } from "https://deno.land/x/hono@v3.12.4/mod.ts";

class Socket {
    socket: WebSocket;
    id: string;
    // deno-lint-ignore ban-types
    events: Map<string, Function>;

    constructor(socket: WebSocket) {
        this.socket = socket;
        this.id = crypto.randomUUID();
        this.events = new Map();

        this.socket.onmessage = (event) => {
            const { event: eventName, data, ackId } = JSON.parse(event.data);
            //if ping event, we pong
            if (eventName === "ping") {
                this.socket.send(JSON.stringify({ event: "pong" }));
                return;
            }
            const handler = this.events.get(eventName);
            if (handler) {
                console.log(handler);
                if (ackId) {
                    console.log("ack found for event", eventName);
                    handler(...data, (ackData: unknown) => this.emit(ackId, ackData));
                } else {
                    handler(...data);
                }
            }
        };

        this.socket.onclose = (event) => {
            const handler = this.events.get("_disconnect");
            if (handler) {
                handler(event.reason || "client disconnected");
            }
        };
    }

    emit(eventName: string, data: unknown, callback?: (data: unknown) => void) {
        const message = {
            event: eventName,
            data,
            ackId: callback ? crypto.randomUUID() : undefined,
        };
        this.socket.send(JSON.stringify(message));

        if (callback && message.ackId) {
            this.on(message.ackId, callback);
        }
    }

    on(eventName: string, callback: unknown) {
        if (typeof callback == "function" && callback instanceof Function) {
            this.events.set(eventName, callback);
        }
    }
}

class Server {
    private connections: Set<Socket>;
    private rooms: Map<string, Set<Socket>>;
    private connectionHandler: ((socket: Socket) => void) | null;

    constructor() {
        this.connections = new Set();
        this.rooms = new Map();
        this.connectionHandler = null;
    }

    on(eventName: "connection", handler: (socket: Socket) => void) {
        if (eventName === "connection") {
            this.connectionHandler = handler;
        }
    }

    handler(req: Request) {
        if (req.headers.get("upgrade") === "websocket") {
            const { socket, response } = Deno.upgradeWebSocket(req);
            socket.onopen = () => {
                const clientSocket = new Socket(socket);
                this.connections.add(clientSocket);

                if (this.connectionHandler) {
                    this.connectionHandler(clientSocket);
                }

                clientSocket.emit("connect", { id: clientSocket.id });

                clientSocket.on("_disconnect", (reason: string) => {
                    clientSocket.events.get("disconnect")?.(reason);
                    this.connections.delete(clientSocket);
                    this.rooms.forEach((sockets, room) => {
                        sockets.delete(clientSocket);
                        if (sockets.size === 0) {
                            this.rooms.delete(room);
                        }
                    });
                });
            };
            return response;
        } else {
            return new Response("Not a WebSocket request", { status: 400 });
        }
    };

    joinRoom(socket: Socket, room: string) {
        if (!this.rooms.has(room)) {
            this.rooms.set(room, new Set());
        }
        this.rooms.get(room)!.add(socket);
    }

    leaveRoom(socket: Socket, room: string) {
        const sockets = this.rooms.get(room);
        if (sockets) {
            sockets.delete(socket);
            if (sockets.size === 0) {
                this.rooms.delete(room);
            }
        }
    }

    emitToAll(eventName: string, data: unknown) {
        this.connections.forEach((socket) => socket.emit(eventName, data));
    }

    broadcastToAll(eventName: string, socket: Socket, data: unknown) {
        this.connections.forEach((s) => {
            if (s !== socket) {
                s.emit(eventName, data);
            }
        });
    }

    emitToClient(socketId: string, eventName: string, data: unknown) {
        const socket = Array.from(this.connections).find((s) => s.id === socketId);
        if (socket) {
            socket.emit(eventName, data);
        }
    }

    emitToRoom(room: string, eventName: string, data: unknown) {
        const sockets = this.rooms.get(room);
        if (sockets) {
            sockets.forEach((socket) => socket.emit(eventName, data));
        }
    }

    broadcastToRoom(room: string, eventName: string, socket: Socket, data: unknown) {
        const sockets = this.rooms.get(room);
        if (sockets) {
            sockets.forEach((s) => {
                if (s !== socket) {
                    s.emit(eventName, data);
                }
            });
        }
    }
}

const io = new Server();

io.on("connection", (socket) => {
    console.log(`socket ${socket.id} connected`);

    socket.emit("hello", "world");

    socket.on("join", (room: string, callback: unknown) => {
        console.log("Received join event", room);
        io.joinRoom(socket, room);
        console.log(`socket ${socket.id} joined room ${room}`);
        if (typeof callback === "function") {
            callback(room); // Send the acknowledgment back to the client
        }
    });

    socket.on("message", (message: string, room: string, fn: () => void) => {
        console.log("Message received:", message);
        console.log("Room:", room);
        io.broadcastToRoom(room, "message", socket, message);
        fn();
    });

    socket.on("disconnect", (reason: string) => {
        console.log(`socket ${socket.id} disconnected due to`, reason);
    });
});

const app = new Hono();

app.get("/ws", (ctx) => {
    return io.handler(ctx.req.raw);
});

app.get("/", (_) => {
    return new Response("Hello World");
});

serve(app.fetch, { port: 3000 });