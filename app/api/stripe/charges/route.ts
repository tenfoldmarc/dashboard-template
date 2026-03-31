import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '25');
    const from = searchParams.get('from'); // Unix timestamp
    const to = searchParams.get('to');

    const stripe = getStripe();
    const params: Record<string, unknown> = { limit };

    if (from || to) {
      params.created = {};
      if (from) (params.created as Record<string, number>).gte = parseInt(from);
      if (to) (params.created as Record<string, number>).lte = parseInt(to);
    }

    const charges = await stripe.charges.list(params as never);

    const transactions = charges.data.map((charge) => ({
      id: charge.id,
      amount: charge.amount / 100,
      currency: charge.currency,
      status: charge.status,
      description: charge.description || 'Payment',
      created: new Date(charge.created * 1000).toISOString(),
      refunded: charge.refunded,
      amount_refunded: charge.amount_refunded / 100,
      fee: charge.balance_transaction ? 0 : 0, // Will be populated from balance_transactions
      customer_email: charge.billing_details?.email || '',
    }));

    return NextResponse.json({ transactions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
