import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

interface SettingRow {
    key: string;
    value: string;
    created_at?: string;
    updated_at?: string;
}

export async function GET() {
    const { data, error } = await supabaseAdmin
        .from('site_settings')
        .select('*');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform KV rows to object
    // Assuming data is an array of objects with key and value properties
    const settings = (data as SettingRow[] || []).reduce((acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {} as Record<string, string | undefined>);

    return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        // body is expected to be { key1: value1, key2: value2, ... }
        const updates = Object.entries(body);

        const results = [];
        const errors = [];

        for (const [key, value] of updates) {
            // Exclude empty keys if any, though frontend should handle this
            if (!key) continue;

            const { data, error } = await supabaseAdmin
                .from('site_settings')
                .upsert({
                    key,
                    value: String(value), // Ensure value is a string
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' })
                .select()
                .single();

            if (error) {
                console.error(`Error updating setting ${key}:`, error);
                errors.push({ key, error: error.message });
            } else {
                results.push(data);
            }
        }

        if (errors.length > 0) {
            // If some failed, return 207 Multi-Status or just return what succeeded with an error message
            // For simplicity in this app, we can return 200 if at least one succeeded, or 500 if all failed?
            // Or return a structure that the frontend can parse.
            // Let's return 200 but include error info.
            return NextResponse.json({
                message: 'Update completed with some errors',
                results,
                errors
            }, { status: 200 });
        }

        // Return the updated settings object as the frontend expects
        // (Re-construct object from results)
        const updatedSettings = results.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);

        return NextResponse.json(updatedSettings);
    } catch (err) {
        console.error('API Error:', err);
        return NextResponse.json({ error: 'Invalid request body or server error' }, { status: 400 });
    }
}
