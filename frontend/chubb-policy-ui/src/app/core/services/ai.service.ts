import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AiHealth,
  AiScope,
  AiStreamEvent,
  PortfolioBrief,
  PromptResponse,
  RiskAssessment,
} from '../models/ai.model';

const BASE_URL = '/api/v1/ai';

/**
 * All AI I/O for the app. Deliberately not cached client-side: the server already
 * caches identical prompts in memory and reports `usage.cached`, so a second cache
 * here would only hide that signal from the UI.
 */
@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);

  health(): Observable<AiHealth> {
    return this.http.get<AiHealth>(`${BASE_URL}/health`);
  }

  ask(prompt: string, scope: AiScope): Observable<PromptResponse> {
    return this.http.post<PromptResponse>(`${BASE_URL}/prompt`, { prompt, scope });
  }

  assessPolicy(policyId: string): Observable<RiskAssessment> {
    return this.http.post<RiskAssessment>(`${BASE_URL}/policies/${policyId}/risk-assessment`, {});
  }

  portfolioBrief(scope: AiScope): Observable<PortfolioBrief> {
    return this.http.post<PortfolioBrief>(`${BASE_URL}/portfolio-brief`, { scope });
  }

  /**
   * Streams an answer token by token over SSE.
   *
   * Uses `fetch` rather than HttpClient: HttpClient buffers the whole response
   * before emitting, which would defeat the point of streaming, and `EventSource`
   * cannot issue a POST with a JSON body.
   *
   * The returned Observable's teardown aborts the request, so navigating away or
   * starting a new question cancels the in-flight generation instead of leaving it
   * running.
   */
  askStream(prompt: string, scope: AiScope): Observable<AiStreamEvent> {
    return new Observable<AiStreamEvent>((subscriber) => {
      const controller = new AbortController();

      (async () => {
        try {
          const response = await fetch(`${BASE_URL}/prompt/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, scope }),
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            subscriber.next({
              type: 'error',
              message: `The AI service responded with ${response.status}.`,
            });
            subscriber.complete();
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // SSE frames are separated by a blank line; the last fragment may be
            // a partial frame, so it stays in the buffer for the next chunk.
            const frames = buffer.split('\n\n');
            buffer = frames.pop() ?? '';

            for (const frame of frames) {
              const line = frame.split('\n').find((l) => l.startsWith('data: '));
              if (!line) continue;

              try {
                subscriber.next(JSON.parse(line.slice(6)) as AiStreamEvent);
              } catch {
                // A malformed frame is not worth failing the whole stream over.
              }
            }
          }

          subscriber.complete();
        } catch (error) {
          // An abort is a deliberate cancellation, not a failure to report.
          if (!controller.signal.aborted) {
            subscriber.next({ type: 'error', message: 'The AI response was interrupted.' });
          }
          subscriber.complete();
        }
      })();

      return () => controller.abort();
    });
  }
}
