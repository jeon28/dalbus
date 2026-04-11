"use client";

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from '@/lib/api';
import { Loader2, Send, Save, Variable, Eye } from 'lucide-react';

interface Placeholder {
    key: string;
    label: string;
}

interface EmailTemplate {
    id?: string;
    key: string;
    name: string;
    subject: string;
    content: string;
    placeholders: Placeholder[];
}

interface EmailTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    template: EmailTemplate | null;
    onSave: () => void;
}

const DEFAULT_PLACEHOLDERS: Placeholder[] = [
    { key: 'buyer_name', label: '구매자명' },
    { key: 'product_name', label: '상품명' },
    { key: 'plan_name', label: '요금제' },
    { key: 'amount', label: '결제금액' },
    { key: 'order_id', label: '주문번호' },
    { key: 'depositor_name', label: '입금자명' },
    { key: 'tidal_id', label: '타이달ID' },
    { key: 'tidal_pw', label: '타이달PW' },
    { key: 'end_date', label: '만료예정일' },
    { key: 'message', label: '추가메시지' }
];

export function EmailTemplateModal({ isOpen, onClose, template, onSave }: EmailTemplateModalProps) {
    const [formData, setFormData] = useState<EmailTemplate>({
        key: '',
        name: '',
        subject: '',
        content: '',
        placeholders: DEFAULT_PLACEHOLDERS
    });
    const [saving, setSaving] = useState(false);
    const [testSending, setTestSending] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');

    useEffect(() => {
        if (template) {
            setFormData(template);
        } else {
            setFormData({
                key: '',
                name: '',
                subject: '',
                content: '',
                placeholders: DEFAULT_PLACEHOLDERS
            });
        }
    }, [template, isOpen]);

    useEffect(() => {
        // 프리뷰 생성 (샘플 데이터 적용)
        const sampleData: Record<string, string> = {
            buyer_name: '홍길동',
            product_name: '테스트 상품',
            plan_name: '프리미엄 1개월',
            amount: '12,000',
            order_id: 'ORD-12345',
            depositor_name: '홍길동',
            tidal_id: 'test@example.com',
            tidal_pw: 'password!',
            end_date: '2026-05-12',
            message: '안녕하세요. 요청하신 서비스 배정이 완료되었습니다.'
        };

        let html = formData.content;
        Object.keys(sampleData).forEach(key => {
            const regex = new RegExp(`{${key}}`, 'g');
            html = html.replace(regex, `<span style="background: #dcfce7; color: #166534; padding: 0 4px; border-radius: 4px; border: 1px solid #bbf7d0;">${sampleData[key]}</span>`);
        });
        setPreviewHtml(html);
    }, [formData.content]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const endpoint = template?.id 
                ? `/api/admin/email-templates/${template.id}` 
                : '/api/admin/email-templates';
            const method = template?.id ? 'PUT' : 'POST';

            const res = await apiFetch(endpoint, {
                method,
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error('Failed to save');
            
            alert('✅ 저장되었습니다.');
            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving template:', error);
            alert('❌ 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleTestSend = async () => {
        const email = prompt('테스트 메일을 발송할 이메일 주소를 입력하세요:');
        if (!email) return;

        setTestSending(true);
        try {
            const res = await apiFetch('/api/admin/email-templates/test-send', {
                method: 'POST',
                body: JSON.stringify({
                    target_email: email,
                    subject: formData.subject,
                    content: formData.content
                })
            });

            if (!res.ok) throw new Error('Failed to send test email');
            alert('✅ 테스트 메일이 발송되었습니다. 수신함을 확인해 주세요.');
        } catch (error) {
            console.error('Error sending test email:', error);
            alert('❌ 테스트 메일 발송에 실패했습니다.');
        } finally {
            setTestSending(false);
        }
    };

    const insertPlaceholder = (key: string) => {
        const textarea = document.getElementById('template-content') as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const after = text.substring(end);
        const newContent = before + `{${key}}` + after;

        setFormData({ ...formData, content: newContent });
        
        // 커서 위치 조정
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + key.length + 2, start + key.length + 2);
        }, 0);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 bg-slate-900 text-white">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Save className="w-5 h-5 text-blue-400" />
                        {template ? '메일 템플릿 수정' : '신규 메일 템플릿 생성'}
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        치환자를 활용하여 동적인 메일 본문을 작성할 수 있습니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50">
                    {/* 편집 영역 */}
                    <div className="flex-1 p-6 border-r border-slate-200 overflow-y-auto space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">시스템 키 (Unique)</label>
                                <Input 
                                    placeholder="EXPIRY_NOTICE" 
                                    value={formData.key}
                                    onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase() })}
                                    className="bg-white border-slate-200 focus:ring-blue-500 font-mono text-sm"
                                    disabled={!!template?.id}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">템플릿 식별 이름</label>
                                <Input 
                                    placeholder="만료 안내 메일" 
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="bg-white border-slate-200"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase">메일 제목</label>
                            <Input 
                                placeholder="[Dalbus] 계정 세팅 완료 안내 - {buyer_name}님" 
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                className="bg-white border-slate-200"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                    <Variable className="w-3 h-3" />
                                    치환자 삽입 (클릭)
                                </label>
                            </div>
                            <div className="flex flex-wrap gap-1.5 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                {DEFAULT_PLACEHOLDERS.map(p => (
                                    <Button 
                                        key={p.key} 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-7 text-[10px] bg-slate-50 hover:bg-blue-50 hover:text-blue-600 border-slate-200"
                                        onClick={() => insertPlaceholder(p.key)}
                                    >
                                        {p.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5 flex-1 flex flex-col">
                            <label className="text-xs font-bold text-slate-500 uppercase">본문 내용 (HTML 가능)</label>
                            <Textarea 
                                id="template-content"
                                placeholder="<html>...</html>" 
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                className="flex-1 min-h-[300px] bg-white border-slate-200 font-mono text-[13px] leading-relaxed resize-none focus:ring-blue-500 shadow-inner"
                            />
                        </div>
                    </div>

                    {/* 미리보기 영역 */}
                    <div className="w-full md:w-[450px] bg-[#fdfdfd] flex flex-col">
                        <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Eye className="w-4 h-4 text-blue-500" />
                                실시간 미리보기
                            </h3>
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Sample Data Applied</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                            <div className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex-1">
                                <div className="bg-slate-50 border-b border-slate-100 p-4">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Subject</div>
                                    <div className="text-sm font-medium text-slate-800">
                                        {formData.subject || '(제목 없음)'}
                                    </div>
                                </div>
                                <div className="p-4 overflow-x-auto min-h-full">
                                    {formData.content ? (
                                        <div 
                                            dangerouslySetInnerHTML={{ __html: previewHtml }} 
                                            className="text-sm preview-container"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                                            <Eye className="w-12 h-12 mb-2 opacity-20" />
                                            <p className="text-xs">내용을 입력하면 여기에 미리보기가 나타납니다.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 bg-white border-t border-slate-200 gap-2">
                    <Button 
                        variant="ghost" 
                        onClick={handleTestSend} 
                        disabled={testSending || !formData.content}
                        className="text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                    >
                        {testSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                        내 메일로 테스트 발송
                    </Button>
                    <div className="flex-1" />
                    <Button variant="outline" onClick={onClose} className="border-slate-200">취소</Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={saving || !formData.key || !formData.name}
                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px] shadow-lg shadow-blue-200"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        템플릿 저장
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
