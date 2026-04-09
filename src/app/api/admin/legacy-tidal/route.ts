import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, isAdmin } from '@/lib/auth';
import { legacyTidalService } from '@/lib/legacyTidalService';

export const dynamic = 'force-dynamic';

// GET: Fetch all Legacy Tidal accounts (Grid View)
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(req);
        if (!session) {
            return NextResponse.json({ error: 'Session not found or invalid' }, { status: 401 });
        }
        if (!isAdmin(session)) {
            return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const showInactive = searchParams.get('showInactive') === 'true';
        const showDeleted = searchParams.get('showDeleted') === 'true';

        const data = await legacyTidalService.getAllAccounts({ showInactive, showDeleted });

        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST: Create a new shared Legacy Tidal account
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(req);
        if (!session) {
            return NextResponse.json({ error: 'Session not found or invalid' }, { status: 401 });
        }
        if (!isAdmin(session)) {
            return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
        }

        const body = await req.json();
        
        const normalizedBody = {
            ...body,
            login_id: body.login_id ? body.login_id.toLowerCase().trim() : body.login_id,
            payment_email: body.payment_email ? body.payment_email.toLowerCase().trim() : body.payment_email
        };

        if (normalizedBody.product_id) delete normalizedBody.product_id;

        const data = await legacyTidalService.createAccount(normalizedBody);

        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
