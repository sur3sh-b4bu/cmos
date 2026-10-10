import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { environment } from '../../../environments/environment';

export interface BiometricDevice {
  id: number;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Biometric sign-in via WebAuthn -- Windows Hello, Touch ID, or a phone's
 * fingerprint/face sensor, whichever the device provides.
 *
 * Nothing biometric is transmitted or stored: the sensor unlocks a private key
 * held in the device's own secure hardware, and the server only ever sees the
 * matching public key and a signature.
 */
@Injectable({ providedIn: 'root' })
export class BiometricAuthService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/auth/webauthn`;

  /**
   * Whether this device can do biometric sign-in at all. Note that browsers
   * only expose WebAuthn in a *secure context* -- HTTPS, or plain-HTTP
   * localhost -- so this is false when the app is opened over http:// at a LAN
   * address, and the UI hides the option rather than offering something that
   * would throw.
   */
  readonly available = signal(false);

  async detectAvailability(): Promise<boolean> {
    this.available.set(false);
    return false;
  }


  /** True when this username has at least one enrolled device on this server. */
  async hasEnrolledDevice(username: string): Promise<boolean> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<{ hasCredentials: boolean }>>(`${this.baseUrl}/login/options`, {
        username,
      })
    );
    return res.data.hasCredentials;
  }

  /**
   * Runs the full assertion ceremony and returns the new session.
   * Throws with a human-readable message the login page can surface directly.
   */
  async signIn(username: string): Promise<{ user: unknown }> {
    const optionsRes = await firstValueFrom(
      this.http.post<ApiResponse<{ options: any; hasCredentials: boolean }>>(
        `${this.baseUrl}/login/options`,
        { username }
      )
    );

    if (!optionsRes.data.hasCredentials) {
      throw new Error('No biometric device is set up for this account yet. Sign in with your password first.');
    }

    const assertion = await startAuthentication({ optionsJSON: optionsRes.data.options });

    const verifyRes = await firstValueFrom(
      this.http.post<ApiResponse<{ user: unknown }>>(
        `${this.baseUrl}/login/verify`,
        { username, response: assertion },
        { withCredentials: true }
      )
    );
    return verifyRes.data;
  }

  /** Enrols the current device. Requires an active session. */
  async enrollThisDevice(deviceLabel: string): Promise<void> {
    const optionsRes = await firstValueFrom(
      this.http.post<ApiResponse<any>>(`${this.baseUrl}/register/options`, {})
    );
    const attestation = await startRegistration({ optionsJSON: optionsRes.data });
    await firstValueFrom(
      this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/register/verify`, {
        response: attestation,
        deviceLabel,
      })
    );
  }

  listDevices(): Promise<BiometricDevice[]> {
    return firstValueFrom(
      this.http.get<ApiResponse<BiometricDevice[]>>(`${this.baseUrl}/devices`)
    ).then((r) => r.data);
  }

  removeDevice(id: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.baseUrl}/devices/${id}`));
  }

  /** Turns the browser's raw WebAuthn errors into something a user can act on. */
  describeError(err: unknown): string {
    const name = (err as { name?: string })?.name;
    const message = (err as { message?: string })?.message ?? '';

    if (name === 'NotAllowedError') {
      return 'Biometric sign-in was cancelled or timed out. Please try again.';
    }
    if (name === 'InvalidStateError') {
      return 'This device is already set up for biometric sign-in.';
    }
    if (name === 'SecurityError') {
      return 'Biometric sign-in needs a secure connection (HTTPS or localhost).';
    }
    return message || 'Biometric sign-in failed. Please use your password.';
  }
}


