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
import { Loader2, Send, Save, Variable, Eye, Layout } from 'lucide-react';
import EmailEditor, { EditorRef } from 'react-email-editor';

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
    design?: any;
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
    const [editorReady, setEditorReady] = useState(false);
    const emailEditorRef = React.useRef<EditorRef>(null);

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
        if (!emailEditorRef.current?.editor) return;

        setSaving(true);
        try {
            // Unlayer에서 HTML과 Design(JSON)을 추출
            const exportedData = await new Promise<any>((resolve) => {
                emailEditorRef.current?.editor?.exportHtml((data) => {
                    resolve(data);
                });
            });

            const { design, html } = exportedData;

            const endpoint = template?.id 
                ? `/api/admin/email-templates/${template.id}` 
                : '/api/admin/email-templates';
            const method = template?.id ? 'PUT' : 'POST';

            const res = await apiFetch(endpoint, {
                method,
                body: JSON.stringify({
                    ...formData,
                    content: html,
                    design: design
                })
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

    const onEditorLoad = () => {
        setEditorReady(true);
        if (template?.design) {
            emailEditorRef.current?.editor?.loadDesign(template.design);
        }
    };

    // 템플릿이 변경될 때 (에디터가 이미 로드된 경우) 디자인 로드
    useEffect(() => {
        if (editorReady && template?.design) {
            emailEditorRef.current?.editor?.loadDesign(template.design);
        }
    }, [template, editorReady]);

    const insertPlaceholder = (key: string) => {
        // Unlayer 에디터 내부에 치환자 삽입은 에디터 자체 기능을 사용하는 것이 좋지만,
        // 여기서는 간단히 텍스트로 복사 안내를 하는 방식으로 구현합니다.
        navigator.clipboard.writeText(`{${key}}`);
        // 간단한 시각적 피드백이나 토스트가 있으면 좋지만, 현재는 콘솔 기록으로 대체하거나 
        // 사용자 제안에 따라 alert을 제거합니다.
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

                <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
                    {/* 편집 영역 */}
                    <div className="flex-1 p-6 overflow-y-auto space-y-4">
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
                                    치환자 삽입 (클릭 시 복사)
                                </label>
                                <span className="text-[10px] text-slate-400">버튼을 클릭하여 코드를 복사한 후, 에디터 본문에 붙여넣으세요.</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                {DEFAULT_PLACEHOLDERS.map(p => (
                                    <Button 
                                        key={p.key} 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-7 text-[10px] bg-white hover:bg-blue-50 hover:text-blue-600 border-slate-200 transition-colors"
                                        onClick={() => insertPlaceholder(p.key)}
                                    >
                                        <span className="font-medium">{p.label}</span>
                                        <code className="ml-1.5 text-[9px] text-slate-400 opacity-70 group-hover:text-blue-400">{`{${p.key}}`}</code>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5 flex-1 flex flex-col min-h-[600px] bg-white rounded-xl border border-slate-200 overflow-hidden shadow-inner">
                            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                    <Layout className="w-3 h-3" />
                                    드래그 앤 드롭 에디터
                                </label>
                                {!editorReady && <div className="flex items-center gap-2 text-[10px] text-slate-400"><Loader2 className="w-3 h-3 animate-spin" /> 로딩 중...</div>}
                            </div>
                            <div className="flex-1 relative">
                                <EmailEditor
                                    ref={emailEditorRef}
                                    onLoad={onEditorLoad}
                                    options={{
                                        locale: 'ko-KR',
                                        appearance: {
                                            theme: 'light',
                                        },
                                        mergeTags: DEFAULT_PLACEHOLDERS.reduce((acc, p) => ({
                                            ...acc,
                                            [p.key]: { name: p.label, value: `{${p.key}}` }
                                        }), {})
                                    }}
                                    style={{
                                        minHeight: '600px',
                                        width: '100%'
                                    }}
                                />
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
