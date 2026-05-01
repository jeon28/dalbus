import { NextRequest, NextResponse } from 'next/server';
import { legacyTidalService } from '@/lib/legacyTidalService';

export const dynamic = 'force-dynamic';

function validateQuickToken(req: NextRequest) {
    const token = req.headers.get('X-Quick-Token');
    const quickPassword = process.env.ADMIN_QUICK_PASSWORD;
    return token && quickPassword && token === quickPassword;
}

export async function GET(req: NextRequest) {
    try {
        if (!validateQuickToken(req)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
