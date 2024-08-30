export declare class Socket {
    private socket;
    private events;
    private ackCallbacks;
    private nextAckId;
    private interval;
    isOpen: boolean;
    isClosed: boolean;
    autoPing: boolean;
    constructor(url: string);
    on(eventName: string, callback: () => void): void;
    emit(eventName: string, ...data: unknown[]): void;
    close(): void;
    reconnect(): void;
    newconnection(): void;
    generateAckId(): string;
}
