"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Notice {
    id: string;
    title: string;
    content: string;
    category: 'service' | 'update' | 'event' | 'maintenance';
    is_pinned: boolean;
    created_at: string;
}

export default function NoticesPage() {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const { data, error } = await supabase
                .from('notices')
                .select('*')
                .eq('is_published', true)
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching notices:', JSON.stringify(error, null, 2));
            } else {
                setNotices(data || []);
            }
            setLoading(false);
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="container py-20 flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-12 px-4 max-w-4xl">
            <div className="text-center mb-12">
                <h1 className="text-3xl font-bold mb-4">공지사항</h1>
                <p className="text-muted-foreground">달버스의 새로운 소식과 안내를 확인하세요.</p>
            </div>

            <div className="space-y-4">
                {notices.length > 0 ? (
                    notices.map((notice) => (
                        <Card key={notice.id} className={`glass overflow-hidden hover:shadow-md transition-all duration-300 ${notice.is_pinned ? 'border-primary/50' : ''}`}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2 mb-1">
                                    {notice.is_pinned && (
                                        <Badge variant="default" className="bg-primary hover:bg-primary">중요</Badge>
                                    )}
                                    <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                                        {notice.category}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground ml-auto">
                                        {new Date(notice.created_at).toLocaleDateString('ko-KR')}
                                    </span>
                                </div>
                                <CardTitle className="text-xl font-bold">{notice.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                                    {notice.content}
                                </p>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-20 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">등록된 공지사항이 없습니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
