import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
}

const DISMISS_AFTER_MS = 4000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(message: string): void {
    this.push('success', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  info(message: string): void {
    this.push('info', message);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(variant: ToastVariant, message: string): void {
    const id = this.nextId++;
    this._toasts.update((list) => [...list, { id, variant, message }]);
    setTimeout(() => this.dismiss(id), DISMISS_AFTER_MS);
  }
}
