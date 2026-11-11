import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { buildDepositRequestEmail, sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * 입금 요청 안내 메일
 *
 * GET  : 발송될 메일의 미리보기(제목/본문/수신자)를 반환한다. 실제 발송은 하지 않는다.
 * POST : 메일을 발송한다. body 에 emailSubject/emailHtml 이 있으면 관리자가 미리보기에서
 *        수정한 내용을 그대로 쓰고, 없으면 템플릿으로 생성한 내용을 보낸다.
 *
 * 계좌 정보는 주문에 배정된 계좌(assigned_bank_account_id) → 활성 계좌 중 정렬 1순위 순으로 찾는다.
 */

type Named = { name: string | null; email?: string | null };
type PlanRow = { duration_months: number | null };

type OrderRow = {
    id: string;
    order_number: string | null;
    amount: number | null;
    payment_status: string | null;
    buyer_name: string | null;
    buyer_email: string | null;
    depositor_name: string | null;
    payment_due_at: string | null;
    assigned_bank_account_id: string | null;
    profiles: Named | Named[] | null;
    products: Named | Named[] | null;
    product_plans: PlanRow | PlanRow[] | null;
};

type BankRow = { bank_name: string; account_number: string; account_holder: string };

function one<T>(v: T | T[] | null | undefined): T | null {
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
}

/** ISO 시각을 한국 시간 'YYYY-MM-DD HH:mm' 문자열로 */
function formatDue(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const day = String(kst.getUTCDate()).padStart(2, '0');
    const hh = String(kst.getUTCHours()).padStart(2, '0');
    const mm = String(kst.getUTCMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
}

type Loaded =
    | { error: string; status: 400 | 404 }
    | {
        order: OrderRow;
        recipientEmail: string;
        buyerName: string;
        details: Parameters<typeof buildDepositRequestEmail>[0];
    };

async function loadOrderAndBank(orderId: string): Promise<Loaded> {
    const { data, error } = await supabaseAdmin
        .from('orders')
        .select(`
            id,
            order_number,
            amount,
            payment_status,
            buyer_name,
            buyer_email,
            depositor_name,
            payment_due_at,
            assigned_bank_account_id,
            profiles ( name, email ),
            products ( name ),
            product_plans ( duration_months )
        `)
        .eq('id', orderId)
        .maybeSingle();

    if (error) throw error;
    const order = data as unknown as OrderRow | null;
    if (!order) return { error: '주문을 찾을 수 없습니다.', status: 404 };

    const profile = one(order.profiles);
    const recipientEmail = profile?.email || order.buyer_email || '';
    if (!recipientEmail) return { error: '이메일 정보가 없는 주문입니다.', status: 400 };

    // 계좌: 주문에 배정된 계좌 → 활성 계좌 1순위
    let bank: BankRow | null = null;
    if (order.assigned_bank_account_id) {
        const { data: b } = await supabaseAdmin
            .from('bank_accounts')
            .select('bank_name, account_number, account_holder')
            .eq('id', order.assigned_bank_account_id)
            .maybeSingle();
        bank = (b as BankRow | null) ?? null;
    }
    if (!bank) {
        const { data: b } = await supabaseAdmin
            .from('bank_accounts')
            .select('bank_name, account_number, account_holder')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .limit(1)
            .maybeSingle();
        bank = (b as BankRow | null) ?? null;
    }
    if (!bank) {
        return { error: '등록된 입금 계좌가 없습니다. 관리자 설정에서 계좌를 먼저 등록하세요.', status: 400 };
    }

    const buyerName = profile?.name || order.buyer_name || '고객';
    const plan = one(order.product_plans);
    const planName = plan?.duration_months ? `${plan.duration_months}개월` : '-';

    return {
        order,
        recipientEmail,
        buyerName,
        details: {
            buyerName,
            orderNumber: order.order_number || order.id,
            productName: one(order.products)?.name || '상품',
            planName,
            amount: order.amount || 0,
            depositorName: order.depositor_name || buyerName,
            bankName: bank.bank_name,
            accountNumber: bank.account_number,
            accountHolder: bank.account_holder,
            paymentDueAt: formatDue(order.payment_due_at),
        },
    };
}

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const denied = await requireAdmin(req);
    if (denied) return denied;
    const { id } = await props.params;

    try {
        const loaded = await loadOrderAndBank(id);
        if ('error' in loaded) {
            return NextResponse.json({ error: loaded.error }, { status: loaded.status });
        }

        const { subject, html } = await buildDepositRequestEmail(loaded.details);
        return NextResponse.json({
            subject,
            html,
            recipientEmail: loaded.recipientEmail,
            recipientName: loaded.buyerName,
            paymentStatus: loaded.order.payment_status,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const denied = await requireAdmin(req);
    if (denied) return denied;
    const { id } = await props.params;

    try {
        const body = await req.json().catch(() => ({} as Record<string, unknown>));

        const loaded = await loadOrderAndBank(id);
        if ('error' in loaded) {
            return NextResponse.json({ error: loaded.error }, { status: loaded.status });
        }

        let subject: string;
        let html: string;
        const customSubject = typeof body.emailSubject === 'string' ? body.emailSubject.trim() : '';
        const customHtml = typeof body.emailHtml === 'string' ? body.emailHtml.trim() : '';
        if (customSubject && customHtml) {
            subject = customSubject;
            html = customHtml;
        } else {
            ({ subject, html } = await buildDepositRequestEmail(loaded.details));
        }

        const result = await sendEmail({
            recipient_email: loaded.recipientEmail,
            recipient_name: loaded.buyerName,
            subject,
            html,
            mailType: '입금 요청 안내',
        });

        if (!result.success) {
            const err = result.error;
            const errMsg = err instanceof Error
                ? err.message
                : typeof err === 'string' ? err : JSON.stringify(err);
            return NextResponse.json({ success: false, error: errMsg }, { status: 502 });
        }

        // 마지막 입금요청 발송 시각 기록 (컬럼이 아직 없으면 경고만 남기고 넘어감)
        const { error: stampError } = await supabaseAdmin
            .from('orders')
            .update({ deposit_requested_at: new Date().toISOString() })
            .eq('id', id);
        if (stampError) console.warn('deposit_requested_at update skipped:', stampError.message);

        return NextResponse.json({ success: true, recipientEmail: loaded.recipientEmail });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
