"use client";

import { LegacyTidalContent } from '@/components/admin/LegacyTidalContent';
import { apiFetch } from '@/lib/api';
import React, { Suspense } from 'react';

export default function AdminLegacyTidalPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
        }>
            <LegacyTidalContent basePath="/admin/legacy-tidal" titlePrefix="Legacy" fetchFn={apiFetch} />
        </Suspense>
    );
}
