"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css';
import { useRouter } from 'next/navigation';
import { 
    Plus, 
    Edit2, 
    Trash2, 
    Mail, 
    Search, 
    RefreshCw,
    AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { EmailTemplateModal } from '@/components/admin/EmailTemplateModal';

interface Placeholder {
    key: string;
    label: string;
}

interface EmailTemplate {
    id: string;
    key: string;
    name: string;
    subject: string;
    content: string;
    placeholders: Placeholder[];
    updated_at: string;
}

export default function EmailTemplateListPage() {
    const { isAdmin } = useServices();
    const router = useRouter();
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (!isAdmin) {
            router.push('/admin');
        }
    }, [isAdmin, router]);

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiFetch('/api/admin/email-templates');
            if (response.ok) {
                const data = await response.json();
                setTemplates(data);
            }
        } catch (error) {
            console.error('Error fetching templates:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin) {
            fetchTemplates();
        }
    }, [isAdmin, fetchTemplates]);

    const handleOpenCreate = () => {
        setSelectedTemplate(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (template: EmailTemplate) => {
        setSelectedTemplate(template);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`'${name}' 템플릿을 삭제하시겠습니까?`)) return;

        try {
            const res = await apiFetch(`/api/admin/email-templates/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setTemplates(templates.filter(t => t.id !== id));
            } else {
                throw new Error('Delete failed');
            }
        } catch {
            alert('❌ 삭제 중 오류가 발생했습니다.');
        }
    };

    const filteredTemplates = templates.filter(t => 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.key.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isAdmin) return null;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container flex justify-between items-center bg-white/50 py-3 rounded-xl px-6 border border-white/20 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-200">
                            <Mail className="text-white w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">메일 템플릿 관리</h1>
                            <p className="text-xs text-slate-500">시스템에서 발송되는 각종 알림 메일 문구를 편집합니다.</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white/80 rounded-full px-4 py-2 shadow-sm border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                            <Search className="w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="템플릿 이름 또는 키 검색..."
                                className="bg-transparent border-none outline-none text-sm w-48 placeholder:text-slate-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="icon" onClick={() => fetchTemplates()} className="rounded-full bg-white hover:bg-slate-50 border-slate-200">
                            <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button 
                            onClick={handleOpenCreate} 
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 px-5 rounded-full shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            새 템플릿 추가
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex-1 p-8">
                {templates.length === 0 && !loading ? (
                    <div className="bg-white rounded-3xl p-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 shadow-inner">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <Mail className="w-10 h-10 text-slate-200" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-600 mb-2">등록된 템플릿이 없습니다.</h2>
                        <p className="text-slate-400 text-sm mb-8 text-center max-w-md">
                            가입 환영, 서비스 만료 안내 등 고객에게 전달될 <br/>다양한 메일 템플릿을 먼저 등록해 보세요.
                        </p>
                        <AlertCircle className="w-4 h-4 text-amber-500 mb-2" />
                        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 mb-6">
                            최초 실행 시 `supabase_schema.sql`을 실행하여 테이블을 생성해야 합니다.
                        </p>
                        <Button onClick={handleOpenCreate} className="bg-slate-900 hover:bg-black text-white px-8 rounded-full">
                            기본 템플릿 만들기 시작
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {loading && templates.length === 0 ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="bg-white rounded-2xl h-48 animate-pulse border border-slate-100 shadow-sm" />
                            ))
                        ) : (
                            filteredTemplates.map((template) => (
                                <div 
                                    key={template.id} 
                                    className="group bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:bg-blue-50 transition-colors duration-300" />
                                    
                                    <div className="relative z-10 flex flex-col h-full">
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 uppercase tracking-wider">
                                                {template.key}
                                            </span>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="w-8 h-8 rounded-full hover:bg-blue-50 hover:text-blue-600"
                                                    onClick={() => handleOpenEdit(template)}
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="w-8 h-8 rounded-full hover:bg-red-50 hover:text-red-500"
                                                    onClick={() => handleDelete(template.id, template.name)}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>

                                        <h3 className="text-base font-bold text-slate-800 mb-1 group-hover:text-blue-700 transition-colors">
                                            {template.name}
                                        </h3>
                                        <p className="text-xs text-slate-500 line-clamp-2 mb-6 flex-1">
                                            {template.subject}
                                        </p>

                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                            <span className="text-[10px] text-slate-400">
                                                수정: {new Date(template.updated_at).toLocaleDateString()}
                                            </span>
                                            <Button 
                                                variant="link" 
                                                className="h-auto p-0 text-blue-600 text-[11px] font-bold hover:no-underline hover:translate-x-1 transition-transform"
                                                onClick={() => handleOpenEdit(template)}
                                            >
                                                편집하기 →
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <EmailTemplateModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                template={selectedTemplate}
                onSave={fetchTemplates}
            />
        </main>
    );
}
