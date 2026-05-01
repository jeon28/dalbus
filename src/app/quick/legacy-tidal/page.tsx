"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { PasswordGate } from '@/components/admin/PasswordGate';
import { LegacyTidalContent } from '@/components/admin/LegacyTidalContent';
import { quickFetch } from '@/lib/quickFetch';

export default function QuickLegacyTidalPage() {
    const [isUnlocked, setIsUnlocked] = useState(false);

    useEffect(() => {
        const token = sessionStorage.getItem('quick-token');
        if (token) setIsUnlocked(true);
    }, []);

    if (!isUnlocked) {
        return <PasswordGate onUnlock={() => setIsUnlocked(true)} />;
    }

    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-slate-900 border-white/10 text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                <span className="ml-3">데이터 로딩 중...</span>
            </div>
        }>
            <LegacyTidalContent 
                basePath="/quick/legacy-tidal" 
                titlePrefix="Quick" 
                fetchFn={quickFetch} 
            />
        </Suspense>
    );
}
