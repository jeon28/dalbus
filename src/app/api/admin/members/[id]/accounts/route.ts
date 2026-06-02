import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: userId } = await params;

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        // 1. Get member profile to have the email for fallback
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            console.error('Profile not found:', userId);
            return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
        }

        // 2. Find all orders belonging to this user (by ID or Email)
        const { data: orders, error: ordersError } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                products ( name ),
                product_plans ( duration_months )
            `)
            .or(`user_id.eq.${userId},buyer_email.eq.${profile.email}`);

        if (ordersError) {
            console.error('Error fetching orders:', ordersError);
            return NextResponse.json({ error: ordersError.message }, { status: 500 });
        }

        const orderIds = (orders || []).map(o => o.id);
        const orderNumbers = (orders || []).map(o => o.order_number).filter(Boolean);

        // 3. Build OR filter — order_id / order_number / buyer_email (강제 연결 포함)
        const orClauses: string[] = [];
        if (orderIds.length > 0) orClauses.push(`order_id.in.(${orderIds.join(',')})`);
        if (orderNumbers.length > 0) orClauses.push(`order_number.in.(${orderNumbers.join(',')})`);
        if (profile.email) orClauses.push(`buyer_email.eq.${profile.email}`);

        // 매칭 기준이 전혀 없으면 빈 목록
        if (orClauses.length === 0) {
            return NextResponse.json([]);
        }

        const { data: assignments, error: assignmentsError } = await supabaseAdmin
            .from('tidal_assignments')
            .select('*, accounts:tidal_accounts ( login_id )')
            .eq('is_deleted', false)
            .or(orClauses.join(','))
            .order('assigned_at', { ascending: false });

        if (assignmentsError) {
            console.error('Error fetching assignments:', assignmentsError);
            return NextResponse.json({ error: assignmentsError.message }, { status: 500 });
        }

        const allAccounts = assignments || [];

        // 4. Transform data to include product/plan info
        const enrichedAccounts = allAccounts.map(account => {
            const relatedOrder = (orders || []).find(o => o.id === account.order_id || (account.order_number && o.order_number === account.order_number));
            return {
                ...account,
                orders: relatedOrder || null
            };
        });

        return NextResponse.json(enrichedAccounts);
    } catch (error) {
        console.error('Server error fetching member accounts:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

/**
 * 배정번호(로그인ID-슬롯, 예: "TG001-5")로 특정 배정을 찾아 이 회원으로 강제 연결한다.
 * 연결 = 해당 tidal_assignments 행의 buyer_email/이름/연락처를 회원 정보로 설정.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: userId } = await params;

    try {
        const body = await request.json();
        const raw: string = (body.assignmentNumber || '').toString();

        // "TG001 - #5" / "TG001-5" 등 → loginId, slot(1-based)
        const cleaned = raw.replace(/#/g, '').trim();
        const match = cleaned.match(/^(.+?)[\s-]+(\d+)\s*$/);
        if (!match) {
            return NextResponse.json({ error: '배정번호 형식이 올바르지 않습니다. (예: TG001-5)' }, { status: 400 });
        }
        const loginId = match[1].trim();
        const slotNumber = parseInt(match[2], 10) - 1; // 표시번호는 1-based
        if (slotNumber < 0) {
            return NextResponse.json({ error: '슬롯 번호가 올바르지 않습니다.' }, { status: 400 });
        }

        // 회원 정보
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('email, name, phone')
            .eq('id', userId)
            .single();
        if (profileError || !profile) {
            return NextResponse.json({ error: '회원 정보를 찾을 수 없습니다.' }, { status: 404 });
        }

        // 로그인ID로 계정 찾기
        const { data: account, error: accountError } = await supabaseAdmin
            .from('tidal_accounts')
            .select('id, login_id')
            .eq('login_id', loginId)
            .maybeSingle();
        if (accountError) {
            return NextResponse.json({ error: accountError.message }, { status: 500 });
        }
        if (!account) {
            return NextResponse.json({ error: `로그인ID '${loginId}' 계정을 찾을 수 없습니다.` }, { status: 404 });
        }

        // 계정 + 슬롯으로 배정 찾기 (가장 최근, 삭제되지 않은 것)
        const { data: assignments, error: assignError } = await supabaseAdmin
            .from('tidal_assignments')
            .select('id, tidal_id, slot_number')
            .eq('account_id', account.id)
            .eq('slot_number', slotNumber)
            .eq('is_deleted', false)
            .order('assigned_at', { ascending: false })
            .limit(1);
        if (assignError) {
            return NextResponse.json({ error: assignError.message }, { status: 500 });
        }
        const assignment = assignments?.[0];
        if (!assignment) {
            return NextResponse.json({ error: `배정번호 '${loginId}-${slotNumber + 1}'에 해당하는 배정을 찾을 수 없습니다.` }, { status: 404 });
        }

        // 회원으로 강제 연결
        const { error: updateError } = await supabaseAdmin
            .from('tidal_assignments')
            .update({
                buyer_email: profile.email,
                buyer_name: profile.name,
                buyer_phone: profile.phone,
            })
            .eq('id', assignment.id);
        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `배정번호 ${loginId}-${slotNumber + 1} (${assignment.tidal_id || '-'})을(를) ${profile.name || profile.email} 회원에게 연결했습니다.`
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Server error';
        console.error('Force-assign error:', error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
