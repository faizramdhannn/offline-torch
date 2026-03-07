import { NextRequest } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username') || '';

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial data
      try {
        const data = await getSheetData('request_store');
        const filtered = data.filter((row: any) => row.id);
        const sorted = filtered.sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        send({ type: 'init', data: sorted });
      } catch (e) {
        send({ type: 'error', message: 'Failed to fetch' });
      }

      // Poll every 10s and push updates
      const interval = setInterval(async () => {
        try {
          const data = await getSheetData('request_store');
          const filtered = data.filter((row: any) => row.id);
          const sorted = filtered.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          send({ type: 'update', data: sorted });
        } catch (e) {
          send({ type: 'error', message: 'Failed to fetch' });
        }
      }, 10000);

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}