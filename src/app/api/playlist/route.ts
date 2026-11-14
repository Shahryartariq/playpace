import { YouTubeError } from '@/lib/youtube/client';
import { parseToken } from '@/lib/youtube/parse-input';
import type { ErrorCode, StreamEvent } from '@/lib/youtube/types';
import { loadList } from '@/lib/server/lists';
import { chargeUnits, clientIp } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** A 5,000-video playlist takes about 20 seconds the first time. */
export const maxDuration = 120;

const STATUS: Record<ErrorCode, number> = {
  invalid_input: 400,
  not_found: 404,
  mix: 400,
  private_list: 400,
  custom_url: 400,
  quota: 503,
  rate_limited: 429,
  upstream: 502,
  config: 500,
};

/** Only Playpace's own pages may use this endpoint from a browser. */
const PRIVATE = { 'cross-origin-resource-policy': 'same-origin' } as const;

function errorResponse(code: ErrorCode): Response {
  const body: StreamEvent = { type: 'error', code };
  return new Response(`${JSON.stringify(body)}\n`, {
    status: STATUS[code],
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', ...PRIVATE },
  });
}

/**
 * GET /api/playlist?src=p:PLxxxx
 * Streams newline-delimited JSON: one `meta` line, `progress` lines while videos load, then `done`
 * with every video, or a single `error` line.
 */
export async function GET(request: Request): Promise<Response> {
  // Another site's page calling this from its visitors' browsers would spend Playpace's YouTube quota.
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return new Response(null, { status: 403, headers: { 'cache-control': 'no-store', ...PRIVATE } });
  }
  const url = new URL(request.url);
  const source = parseToken(url.searchParams.get('src') ?? '');
  if (!source) return errorResponse('invalid_input');

  const ip = clientIp(request.headers);
  const encoder = new TextEncoder();
  // If the viewer leaves, we only stop writing: the lookup itself finishes and is cached for the next person.
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };
      let lastProgress = 0;
      try {
        const data = await loadList(source, {
          charge: (units) => chargeUnits(ip, units),
          onMeta: (meta, cached) => send({ type: 'meta', meta, cached }),
          onProgress: (loaded, total) => {
            const now = Date.now();
            if (loaded < total && now - lastProgress < 120) return;
            lastProgress = now;
            send({ type: 'progress', loaded, total });
          },
        });
        send({ type: 'done', data });
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          const code: ErrorCode = err instanceof YouTubeError ? err.code : 'upstream';
          if (code === 'upstream' || code === 'config') console.error('[playlist]', (err as Error).message);
          send({ type: 'error', code });
        }
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed by the client
          }
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      // Streamed per request: errors can arrive mid-stream, so the CDN must not keep a copy.
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      // Ask proxies not to buffer, so progress lines arrive as they're written.
      'x-accel-buffering': 'no',
      ...PRIVATE,
    },
  });
}
