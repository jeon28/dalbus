"use client";

import { QobuzContent } from '@/components/admin/QobuzContent';
import { apiFetch } from '@/lib/api';
import React, { Suspense } from 'react';

export default function AdminQobuzPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
            </div>
        }>
            <QobuzContent basePath="/admin/qobuz" titlePrefix="QOBUZ" fetchFn={apiFetch} />
        </Suspense>
    );
}
