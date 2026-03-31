import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const clientId = process.env.GMAIL_CLIENT_ID || '';
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || '';
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN || '';

  // Try direct token refresh
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        refresh_token: refreshToken.trim(),
        grant_type: 'refresh_token',
      }),
    });
    const data = await res.json();
    return NextResponse.json({
      success: !!data.access_token,
      tokenLength: data.access_token?.length,
      error: data.error,
      errorDesc: data.error_description,
      clientIdLen: clientId.length,
      clientIdTrimLen: clientId.trim().length,
      secretLen: clientSecret.length,
      secretTrimLen: clientSecret.trim().length,
      tokenLen: refreshToken.length,
      tokenTrimLen: refreshToken.trim().length,
      clientIdFull: clientId,
      secretFirst10: clientSecret.slice(0, 10),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) });
  }
}
