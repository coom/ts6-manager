import type { WebSocket, WebSocketServer } from 'ws';

/**
 * Identity bound to a socket once `verifyClient` has authenticated it.
 *
 * `serverIds` is resolved once at connect time. A grant revoked mid-session
 * therefore keeps applying until the socket reconnects; access rows change
 * rarely and the socket is short-lived, so this is a deliberate trade rather
 * than an oversight.
 */
export interface WsIdentity {
  id: number;
  role: string;
  /** Server config ids this user may see. Not consulted for admins. */
  serverIds: Set<number>;
}

type AuthedSocket = WebSocket & { identity?: WsIdentity };

/** Attach the authenticated identity to a freshly accepted socket. */
export function bindIdentity(socket: WebSocket, identity: WsIdentity): void {
  (socket as AuthedSocket).identity = identity;
}

/**
 * Send an event only to the sockets entitled to it.
 *
 * `serverConfigId` scopes the event to one TeamSpeak server config: admins
 * always receive it, viewers only with a matching UserServerAccess grant.
 * An event with no server scope is instance-wide and goes to admins only —
 * fail closed, since there is no grant to check it against.
 */
export function broadcastScoped(
  wss: WebSocketServer,
  type: string,
  payload: Record<string, unknown>,
  serverConfigId?: number | null,
): void {
  const msg = JSON.stringify({ type, ...payload });
  wss.clients.forEach((raw) => {
    const client = raw as AuthedSocket;
    if (client.readyState !== 1) return; // WebSocket.OPEN
    const identity = client.identity;
    if (!identity) return; // never authenticated — should be unreachable
    if (identity.role !== 'admin') {
      if (serverConfigId == null) return;
      if (!identity.serverIds.has(serverConfigId)) return;
    }
    client.send(msg);
  });
}
