import { Injectable, effect, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Thin wrapper around one shared Socket.IO connection, used purely as a
 * "something changed in your church, go refetch" signal -- see
 * socketServer.js on the backend for the full reasoning (church-scoped
 * rooms, the `sid` session cookie verified on connect via
 * `withCredentials: true` below, tiny signal-only payloads; REST stays the
 * single source of truth -- nothing here ever carries the actual record).
 *
 * Connects the moment a session exists (AuthService.isAuthenticated becomes
 * true) and disconnects on logout, mirroring how every REST call is already
 * gated by that same session -- callers never need to connect/disconnect
 * themselves, only subscribe via on().
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private auth = inject(AuthService);
  private socket: Socket | null = null;

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) this.connect();
      else this.disconnect();
    });
  }

  private connect(): void {
    if (this.socket) return;
    // `withCredentials: true` sends the `sid` session cookie along with the
    // handshake automatically -- nothing to pass explicitly, and nothing
    // that can go stale the way a manually-attached token could.
    this.socket = io(this.resolveOrigin(), { withCredentials: true });
  }

  private disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  /** In dev, apiBaseUrl is an absolute http://host:4000/api (see
   * environment.ts) -- Socket.IO connects to an origin, not a REST path, so
   * strip the /api suffix. In production it's the relative '/api' (frontend
   * and API share an origin behind one proxy), where the empty string here
   * correctly resolves against window.location for socket.io-client too. */
  private resolveOrigin(): string {
    const base = environment.apiBaseUrl;
    return /^https?:\/\//.test(base) ? base.replace(/\/api\/?$/, '') : '';
  }

  /**
   * Emits every time `event` fires while connected. Subscribers are
   * responsible for their own cleanup (e.g. `takeUntilDestroyed()`) -- the
   * underlying connection itself is shared/long-lived across the whole app
   * session (see connect()/disconnect() above), only the listener is
   * per-subscription.
   */
  on<T = unknown>(event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      const handler = (payload: T) => subscriber.next(payload);
      this.socket?.on(event, handler);
      return () => this.socket?.off(event, handler);
    });
  }
}
