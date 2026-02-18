import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('id');

  if (!fileId) {
    return NextResponse.json({ error: 'Missing file ID' }, { status: 400 });
  }

  const urls = [
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
    `https://lh3.googleusercontent.com/d/${fileId}=w400`,
    `https://drive.google.com/uc?export=view&id=${fileId}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://drive.google.com/',
        },
        redirect: 'follow',
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        
        // Only proxy image responses
        if (contentType.startsWith('image/')) {
          const buffer = await response.arrayBuffer();
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
      }
    } catch (e) {
      continue;
    }
  }

  // Return placeholder SVG if all failed
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <rect width="128" height="128" fill="#e5e7eb" rx="8"/>
    <text x="64" y="56" text-anchor="middle" fill="#9ca3af" font-size="11" font-family="sans-serif">Foto tidak</text>
    <text x="64" y="72" text-anchor="middle" fill="#9ca3af" font-size="11" font-family="sans-serif">dapat dimuat</text>
  </svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=60',
    },
  });
}