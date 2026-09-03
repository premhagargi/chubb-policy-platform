import { Injectable } from '@angular/core';

/**
 * The one place that touches localStorage. Every read/write is JSON-safe and wrapped in
 * try/catch — private browsing or storage-disabled environments throw on access, and a
 * failed preference read/write should never break the app.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore — best-effort persistence only
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
