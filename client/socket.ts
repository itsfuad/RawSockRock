
type CallBack = (...data: unknown[]) => void;

export class Socket {

    private socket: WebSocket;
    private events: Map<string, CallBack>;
    private ackCallbacks: Map<string, CallBack>;
    private nextAckId: number;
    private interval: number;

    public isOpen: boolean;
    public isClosed: boolean;
    public autoPing: boolean;

    constructor(url: string) {
        this.socket = new WebSocket(url);
        this.events = new Map<string, CallBack>();
        this.ackCallbacks = new Map<string, CallBack>();
        this.nextAckId = 0;
        this.interval = 0;
        this.isOpen = false;
        this.autoPing = false;
        this.isClosed = !this.isOpen;
        this.socket.onopen = () => {
            this.isOpen = true;
            this.isClosed = !this.isOpen;
            this.emit("connect");
            if (this.autoPing) {
                //after each 10 seconds, send a ping message to the server to keep the connection alive
                this.interval = setInterval(() => {
                    if (this.socket.readyState !== WebSocket.OPEN) {
                        clearInterval(this.interval);
                        return;
                    }
                    this.socket.send(JSON.stringify({ event: "ping" }));
                }, 10000);
            }
        };

        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            const { event: eventName, data, ackId } = message;
            console.log('raw message', message, data, message.message);
            if (this.events.has(eventName)) {
                this.events.get(eventName)?.(...data, (ackData: unknown) => {
                    if (ackId !== undefined) {
                        this.socket.send(JSON.stringify({ event: ackId, data: ackData }));
                    }
                });
            } else if (this.ackCallbacks.has(eventName)) {
                this.ackCallbacks.get(eventName)?.(...data);
                this.ackCallbacks.delete(eventName);
            }
        };

        this.socket.onclose = () => {
            //trigger disconnect event
            this.events.get("disconnect")?.("Connection closed");
            this.isOpen = false;
            this.isClosed = !this.isOpen;
        };

        this.socket.onerror = (error) => {
            this.events.get("error")?.(error);
        };
    }

    on(eventName: string, callback: () => void) {
        this.events.set(eventName, callback);
    }

    emit(eventName: string, ...data: unknown[]) {

        // Last argument is the ack callback (optional)
        let ackCallback: CallBack | undefined;
        const lastArg = data[data.length - 1];
        if (typeof lastArg === "function" && lastArg instanceof Function) {
            ackCallback = data.pop() as CallBack;
        }

        const ackId = ackCallback ? this.generateAckId() : null;

        this.socket.send(
            JSON.stringify({ event: eventName, data, ackId })
        );

        if (ackCallback && ackId) {
            this.ackCallbacks.set(ackId, ackCallback);
        }
    }

    close() {
        this.socket.close();
    }

    reconnect() {
        if (this.socket.readyState === WebSocket.OPEN) {
            return;
        }
        this.socket = new WebSocket(this.socket.url);
    }

    newconnection() {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.close();
        }
        this.socket = new WebSocket(this.socket.url);
    }

    generateAckId() {
        return `ack_${this.nextAckId++}`;
    }
}