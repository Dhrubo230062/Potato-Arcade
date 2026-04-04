import { io, type Socket } from 'socket.io-client';

let _socket: Socket | null = null;

function getSocket(): Socket {
  if (_socket) return _socket;
  if (typeof window === 'undefined') {
    // SSR stub - should never be called but just in case
    throw new Error('Socket cannot be used on server side');
  }
  _socket = io(window.location.origin, {
    autoConnect: false,
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 20000,
    withCredentials: true,
  });

  _socket.on('connect', () => console.log('[SOCKET] Connected:', _socket!.id));
  _socket.on('connect_error', (e: Error) => console.error('[SOCKET] Error:', e.message));
  _socket.on('disconnect', (reason: string) => {
    console.log('[SOCKET] Disconnected:', reason);
    if (reason === 'io server disconnect') _socket!.connect();
  });

  return _socket;
}

// Stable proxy — once _socket exists all calls route directly
const socket = new Proxy({} as Socket, {
  get(_t, prop) {
    return (getSocket() as any)[prop];
  },
  set(_t, prop, value) {
    (getSocket() as any)[prop] = value;
    return true;
  },
});

export default socket;
