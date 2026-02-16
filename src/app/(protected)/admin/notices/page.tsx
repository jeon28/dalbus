"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useServices } from '@/lib/ServiceContext';
import { Pencil, Trash2, Plus, Pin, PinOff } from 'lucide-react';

interface Notice {
    id: string;
    title: string;
    content: string;
    category: string;
    is_published: boolean;
    is_pinned: boolean;
    created_at: string;
}

interface NoticeCategory {
    id: string;
    name: string;
    sort_order: number;
}

export default function NoticeAdminPage() {
    const { isAdmin } = useServices();
    const [notices, setNotices] = useState<Notice[]>([]);
    const [categories, setCategories] = useState<NoticeCategory[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        category: '',
        is_published: true,
        is_pinned: false
    });
    const [newCategory, setNewCategory] = useState('');

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [noticeRes, catRes] = await Promise.all([
                fetch('/api/admin/notices'),
                fetch('/api/admin/notice-categories')
            ]);
            if (noticeRes.ok) setNotices(await noticeRes.json());
            if (catRes.ok) {
                const catData = await catRes.json();
                setCategories(catData);
                if (catData.length > 0 && !formData.category) {
                    setFormData(prev => ({ ...prev, category: catData[0].name }));
                }
            }
        } catch (error: unknown) {
            console.error('Error fetching notice data:', error);
        } finally {
            setLoading(false);
        }
    }, [formData.category]);

    useEffect(() => {
        if (isAdmin) {
            fetchData();
        }
    }, [isAdmin, fetchData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const url = isEditing ? `/api/admin/notices/${isEditing}` : '/api/admin/notices';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                alert(isEditing ? '수정되었습니다.' : '등록되었습니다.');
                setIsEditing(null);
                setFormData({ title: '', content: '', category: categories[0]?.name || '', is_published: true, is_pinned: false });
                fetchData();
            } else {
                const errorData = await res.json();
                throw new Error(errorData.error || '처리 중 오류가 발생했습니다.');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            alert(`오류: ${message}`);
        }
    };

    const handleEdit = (notice: Notice) => {
        setIsEditing(notice.id);
        setFormData({
            title: notice.title,
            content: notice.content,
            category: notice.category,
            is_published: notice.is_published,
            is_pinned: notice.is_pinned
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/admin/notices/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchData();
            } else {
                throw new Error('삭제 실패');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            alert(message);
        }
    };

    const handleTogglePin = async (notice: Notice) => {
        const res = await fetch(`/api/admin/notices/${notice.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_pinned: !notice.is_pinned })
        });
        if (res.ok) fetchData();
    };

    const handleAddCategory = async () => {
        if (!newCategory) return;
        const res = await fetch('/api/admin/notice-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newCategory, sort_order: categories.length + 1 })
        });
        if (res.ok) {
            setNewCategory('');
            fetchData();
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm('카테고리를 삭제하시겠습니까?')) return;
        const res = await fetch(`/api/admin/notice-categories/${id}`, { method: 'DELETE' });
        if (res.ok) fetchData();
    };

    if (!isAdmin) return null;

    return (
        <div className="container mx-auto py-10 px-4 max-w-6xl">
            <h1 className="text-3xl font-bold mb-8">공지사항 관리</h1>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-sm border-none bg-white/60 backdrop-blur">
                        <CardHeader>
                            <CardTitle>{isEditing ? '공지사항 수정' : '신규 공지사항 등록'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>카테고리</Label>
                                        <select
                                            className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background"
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        >
                                            {categories.map(c => (
                                                <option key={c.id} value={c.name}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-6 pt-8">
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id="pin"
                                                className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                                checked={formData.is_pinned}
                                                onChange={e => setFormData({ ...formData, is_pinned: e.target.checked })}
                                            />
                                            <Label htmlFor="pin" className="cursor-pointer">상단 고정</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id="publish"
                                                className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                                checked={formData.is_published}
                                                onChange={e => setFormData({ ...formData, is_published: e.target.checked })}
                                            />
                                            <Label htmlFor="publish" className="cursor-pointer">게시 여부</Label>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>제목</Label>
                                    <Input
                                        placeholder="공지사항 제목을 입력하세요"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>내용</Label>
                                    <Textarea
                                        placeholder="공지내용을 상세히 입력하세요"
                                        className="min-h-[200px]"
                                        value={formData.content}
                                        onChange={e => setFormData({ ...formData, content: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-4">
                                    {isEditing && (
                                        <Button type="button" variant="outline" onClick={() => setIsEditing(null)}>취소</Button>
                                    )}
                                    <Button type="submit" className="bg-black text-white hover:bg-gray-800 px-8">
                                        {isEditing ? '변경사항 저장' : '공지사항 등록하기'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Notice List */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center justify-between">
                            등록된 공지사항 목록
                            <Badge variant="secondary">{notices.length}개</Badge>
                        </h3>
                        {loading ? (
                            <div className="text-center py-10">로딩 중...</div>
                        ) : (
                            notices.map((notice) => (
                                <Card key={notice.id} className={`group shadow-none border hover:border-primary/30 transition-all ${notice.is_pinned ? 'bg-orange-50/30' : ''}`}>
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    {notice.is_pinned && <Pin className="h-3.5 w-3.5 text-orange-500 fill-orange-500" />}
                                                    <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-100 text-[10px]">
                                                        {notice.category}
                                                    </Badge>
                                                    {!notice.is_published && <Badge variant="destructive" className="text-[10px]">비공개</Badge>}
                                                    <span className="text-xs text-muted-foreground">{new Date(notice.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <h4 className="font-bold text-lg mb-1">{notice.title}</h4>
                                                <p className="text-sm text-muted-foreground line-clamp-2">{notice.content}</p>
                                            </div>
                                            <div className="flex flex-col gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" onClick={() => handleTogglePin(notice)} className={`h-8 w-8 ${notice.is_pinned ? 'text-orange-500' : 'text-gray-400'}`}>
                                                    {notice.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(notice)} className="h-8 w-8 text-blue-500">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(notice.id)} className="h-8 w-8 text-red-500">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>

                {/* Categories Section */}
                <div className="space-y-6">
                    <Card className="shadow-sm border-none bg-white/60 backdrop-blur self-start sticky top-24">
                        <CardHeader>
                            <CardTitle className="text-lg">카테고리 관리</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="새 카테고리"
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                />
                                <Button size="icon" onClick={handleAddCategory} className="bg-black text-white shrink-0">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {categories.map(c => (
                                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border group">
                                        <span className="font-medium text-sm">{c.name}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDeleteCategory(c.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
