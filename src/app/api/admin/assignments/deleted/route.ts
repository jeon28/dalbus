import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const product = searchParams.get('product');
    const assignmentTable = 'tidal_assignments';

    let query = supabaseAdmin
      .from(assignmentTable)
      .select(`
        *,
        accounts:tidal_accounts!inner (
          login_id,
          products!inner ( name, slug )
        ),
        orders (
          order_number,
          buyer_name,
          buyer_email,
          buyer_phone,
          profiles ( name, phone )
        )
      `)
      .eq('is_deleted', true); // only deleted records

    if (product) {
      query = query.ilike('accounts.products.slug', `%${product}%`);
    } else {
      // default to Tidal if not specified
      query = query.ilike('accounts.products.slug', '%tidal%');
    }

    const { data, error } = await query.order('assigned_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
