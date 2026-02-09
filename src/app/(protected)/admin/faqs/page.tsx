"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useServices } from '@/lib/ServiceContext';
import { Pencil, Trash2, Plus } from 'lucide-react';

interface FAQ {
    id: string;
    question: string;
    answer: string;
    category: string;
    sort_order: number;
    is_published: boolean;
    created_at?: string;
}

interface FAQCategory {
    id: string;
    name: string;
    sort_order: number;
}

export default function FAQAdminPage() {
    const { isAdmin } = useServices();
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [categories, setCategories] = useState<FAQCategory[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        question: '',
        answer: '',
        category: '',
        sort_order: 0,
        is_published: true
    });
    const [newCategory, setNewCategory] = useState('');

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        const [faqRes, catRes] = await Promise.all([
            fetch('/api/admin/faqs'),
            fetch('/api/admin/faq-categories')
        ]);
        if (faqRes.ok) setFaqs(await faqRes.json());
        if (catRes.ok) {
            const catData = await catRes.json();
            setCategories(catData);
            if (catData.length > 0 && !formData.category) {
                setFormData(prev => ({ ...prev, category: catData[0].name }));
            }
        }
        setLoading(false);
    }, [formData.category]);

    useEffect(() => {
        if (isAdmin) {
            fetchData();
        }
    }, [isAdmin, fetchData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const url = isEditing ? `/api/admin/faqs/${isEditing}` : '/api/admin/faqs';
        const method = isEditing ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (res.ok) {
            alert(isEditing ? '수정되었습니다.' : '등록되었습니다.');
            setIsEditing(null);
            setFormData({ question: '', answer: '', category: categories[0]?.name || '', sort_order: 0, is_published: true });
            fetchData();
        }
    };

    const handleEdit = (faq: FAQ) => {
        setIsEditing(faq.id);
        setFormData({
            question: faq.question,
            answer: faq.answer,
            category: faq.category,
            sort_order: faq.sort_order,
            is_published: faq.is_published
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const res = await fetch(`/api/admin/faqs/${id}`, { method: 'DELETE' });
        if (res.ok) fetchData();
    };

    const handleAddCategory = async () => {
        if (!newCategory) return;
        const res = await fetch('/api/admin/faq-categories', {
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
        if (!confirm('카테고리를 삭제하시겠습니까? 해당 카테고리의 FAQ들은 유지되지만 카테고리 명이 일치하지 않을 수 있습니다.')) return;
        const res = await fetch(`/api/admin/faq-categories/${id}`, { method: 'DELETE' });
        if (res.ok) fetchData();
    };

    if (!isAdmin) return null;

    return (
        <div className="container mx-auto py-10 px-4 max-w-6xl">
            <h1 className="text-3xl font-bold mb-8">FAQ 관리</h1>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-sm border-none bg-white/60 backdrop-blur">
                        <CardHeader>
                            <CardTitle>{isEditing ? 'FAQ 수정' : '신규 FAQ 등록'}</CardTitle>
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
                                    <div className="space-y-2">
                                        <Label>정렬 순서</Label>
                                        <Input
                                            type="number"
                                            value={formData.sort_order}
                                            onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>질문 (Question)</Label>
                                    <Input
                                        placeholder="질문을 입력하세요"
                                        value={formData.question}
                                        onChange={e => setFormData({ ...formData, question: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>답변 (Answer)</Label>
                                    <Textarea
                                        placeholder="답변을 입력하세요"
                                        className="min-h-[150px]"
                                        value={formData.answer}
                                        onChange={e => setFormData({ ...formData, answer: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-4">
                                    {isEditing && (
                                        <Button type="button" variant="outline" onClick={() => setIsEditing(null)}>취소</Button>
                                    )}
                                    <Button type="submit" className="bg-black text-white hover:bg-gray-800 px-8">
                                        {isEditing ? '변경사항 저장' : 'FAQ 등록하기'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* FAQ List */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center justify-between">
                            등록된 FAQ 목록
                            <Badge variant="secondary">{faqs.length}개</Badge>
                        </h3>
                        {loading ? (
                            <div className="text-center py-10">로딩 중...</div>
                        ) : (
                            faqs.map((faq) => (
                                <Card key={faq.id} className="group shadow-none border hover:border-primary/30 transition-all">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 uppercase text-[10px]">
                                                        {faq.category}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">순서: {faq.sort_order}</span>
                                                </div>
                                                <h4 className="font-bold text-lg mb-1">{faq.question}</h4>
                                                <p className="text-sm text-muted-foreground line-clamp-2">{faq.answer}</p>
                                            </div>
                                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(faq)} className="h-8 w-8 text-blue-500">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(faq.id)} className="h-8 w-8 text-red-500">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                        {!loading && faqs.length === 0 && (
                            <div className="text-center py-20 bg-gray-50 rounded-xl text-gray-400">등록된 FAQ가 없습니다.</div>
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
                            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
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
                                {categories.length === 0 && (
                                    <p className="text-center text-xs text-muted-foreground py-4">카테고리가 없습니다.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
