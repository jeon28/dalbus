import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'not set',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set' : 'not set',
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'not set',
    });
}
