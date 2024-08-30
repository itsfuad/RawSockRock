// redis-adapter/adapter.ts

import { type Redis, RedisSubscription } from "https://deno.land/x/redis@v0.32.1/mod.ts";
import { Server } from "../websockets/websocket.ts";

export class RedisAdapter {
    pubClient: Redis;
    subClient: Redis;
    subscriber: RedisSubscription;
    server: Server;

    constructor(pub: Redis, sub: Redis, server: Server) {
        this.pubClient = pub;
        this.subClient = sub;
        this.server = server;
        this.subscriber = {} as RedisSubscription;

        this.init();
    }

    private async init() {
        this.subscriber = await this.subClient.subscribe("*");
        this.listenToMessages();
    }

    private async listenToMessages() {
        for await (const { message } of this.subscriber.receive()) {
            const { eventName, data, roomId } = JSON.parse(message);
            if (roomId) {
                this.server.emitToRoom(roomId, eventName, ...data);
            } else {
                this.server.emitToAll(eventName, ...data);
            }
        }
    }

    async publish(channel: string, message: string) {
        await this.pubClient.publish(channel, message);
    }

    async broadcast(eventName: string, data: unknown[], roomId?: string) {
        const message = JSON.stringify({ eventName, data, roomId });
        await this.publish(roomId ? `room:${roomId}` : "all", message);
    }
}
