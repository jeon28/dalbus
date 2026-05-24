"use client";

export function PageLoading() {
    return (
        <div className="container py-20 flex flex-col items-center justify-center gap-3 min-h-[300px]">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            <span className="text-sm text-muted-foreground">로딩 중...</span>
        </div>
    );
}
