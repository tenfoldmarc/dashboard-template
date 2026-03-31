import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    hasGmailClientId: !!process.env.GMAIL_CLIENT_ID,
    hasGmailClientSecret: !!process.env.GMAIL_CLIENT_SECRET,
    hasGmailRefreshToken: !!process.env.GMAIL_REFRESH_TOKEN,
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasMetaToken: !!process.env.META_ACCESS_TOKEN,
    hasIgToken: !!process.env.IG_ACCESS_TOKEN,
    gmailClientIdPrefix: process.env.GMAIL_CLIENT_ID?.slice(0, 10) || 'MISSING',
    stripeKeyPrefix: process.env.STRIPE_SECRET_KEY?.slice(0, 10) || 'MISSING',
  });
}
