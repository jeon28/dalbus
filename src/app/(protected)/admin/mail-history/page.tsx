"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { apiFetch } from '@/lib/api';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
    CheckCircle2,
    XCircle,
    RefreshCcw,
    Eye,
    Search,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronDown
} from "lucide-react";
import { format } from 'date-fns';

interface MailHistory {
    id: string;
    recipient_email: string;
    recipient_name: string | null;
    mail_type: string;
    subject: string;
    content: string;
    status: 'success' | 'failed';
    error_message: string | null;
    sent_at: string;
}

interface PaginationInfo {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export default function MailHistoryPage() {
    const { isAdmin, isHydrated } = useServices();
    const router = useRouter();

    const [history, setHistory] = useState<MailHistory[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Filters
    const [searchRecipient, setSearchRecipient] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [page, setPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({
        key: 'sent_at',
        direction: 'desc'
    });

    const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
        sent_at: 220,
        mail_type: 200,
        recipient: 280,
        subject: 400,
        status: 100,
        actions: 200
    });

    const [resizingCol, setResizingCol] = useState<string | null>(null);

    // Modal state
    const [selectedMail, setSelectedMail] = useState<MailHistory | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchRecipient) params.append('recipient', searchRecipient);
            if (filterType !== 'all') params.append('type', filterType);
            if (filterStatus !== 'all') params.append('status', filterStatus);
            params.append('page', page.toString());
            params.append('limit', '20');
            params.append('sort', sortConfig.key);
            params.append('order', sortConfig.direction);

            const response = await apiFetch(`/api/admin/mail-history?${params.toString()}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to fetch mail history');
            }

            const result = await response.json();
            setHistory(result.data);
            setPagination(result.pagination);
        } catch (error) {
            console.error('Error fetching mail history:', error);
        } finally {
            setIsLoading(false);
        }
    }, [searchRecipient, filterType, filterStatus, page, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
        setPage(1);
    };

    const startResizing = (key: string, e: React.MouseEvent) => {
        e.preventDefault();
        setResizingCol(key);
        const startX = e.pageX;
        const startWidth = columnWidths[key];

        const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(50, startWidth + (moveEvent.pageX - startX));
            setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
        };

        const onMouseUp = () => {
            setResizingCol(null);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    useEffect(() => {
        if (isHydrated && !isAdmin) {
            router.push('/admin');
        } else if (isHydrated && isAdmin) {
            fetchHistory();
        }
    }, [isAdmin, isHydrated, router, fetchHistory]);

    const handleResend = async (id: string) => {
        if (isProcessing) return;
        if (!confirm('해당 메일을 재발송하시겠습니까?')) return;

        setIsProcessing(true);
        try {
            const response = await apiFetch('/api/admin/mail-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '재발송 실패');
            }

            alert('메일이 성공적으로 재발송되었습니다.');
            fetchHistory(); // Refresh to see the new log
        } catch (error) {
            const e = error as Error;
            alert(`오류: ${e.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleViewDetail = (mail: MailHistory) => {
        setSelectedMail(mail);
        setIsViewModalOpen(true);
    };

    const mailTypes = [
        "주문 알림 (관리자)",
        "주문 접수 안내",
        "서비스 배정 안내",
        "서비스 만료 안내",
        "비밀번호 재설정"
    ];

    if (!isAdmin) return null;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>메일 발송 이력</h1>
                <p className={styles.description}>시스템에서 발송된 모든 메일의 상세 내역과 상태를 확인합니다.</p>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">수신자 (이름/이메일)</label>
                    <div className="relative">
                        <Input
                            placeholder="수신자 검색..."
                            value={searchRecipient}
                            onChange={(e) => setSearchRecipient(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
                            className="pl-9"
                        />
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                </div>

                <div className="w-[180px]">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">메일 유형</label>
                    <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
                        <SelectTrigger>
                            <SelectValue placeholder="모든 유형" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">모든 유형</SelectItem>
                            {mailTypes.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-[140px]">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">발송 상태</label>
                    <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
                        <SelectTrigger>
                            <SelectValue placeholder="모든 상태" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">모든 상태</SelectItem>
                            <SelectItem value="success">성공</SelectItem>
                            <SelectItem value="failed">실패</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Button variant="secondary" onClick={() => { setPage(1); fetchHistory(); }}>
                    <Search className="h-4 w-4 mr-2" />
                    검색
                </Button>
            </div>

            {/* Table */}
            <div className={styles.tableWrapper}>
                <table className={`${styles.table} ${styles.resizableTable} text-xs mx-auto`} style={{ width: '1400px', minWidth: '1400px' }}>
                    <thead>
                        <tr>
                            <th
                                style={{ width: columnWidths.sent_at, position: 'relative' }}
                                className="cursor-pointer hover:bg-gray-50 group"
                                onClick={() => handleSort('sent_at')}
                            >
                                <div className="flex items-center">
                                    발송 일시
                                    {sortConfig.key === 'sent_at' && (
                                        sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />
                                    )}
                                </div>
                                <div
                                    className={`absolute right-0 top-0 h-full w-[4px] cursor-col-resize hover:bg-blue-400 transition-colors ${resizingCol === 'sent_at' ? 'bg-blue-500' : ''}`}
                                    onMouseDown={(e) => startResizing('sent_at', e)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </th>
                            <th
                                style={{ width: columnWidths.mail_type, position: 'relative' }}
                                className="cursor-pointer hover:bg-gray-50 group"
                                onClick={() => handleSort('mail_type')}
                            >
                                <div className="flex items-center">
                                    메일 유형
                                    {sortConfig.key === 'mail_type' && (
                                        sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />
                                    )}
                                </div>
                                <div
                                    className={`absolute right-0 top-0 h-full w-[4px] cursor-col-resize hover:bg-blue-400 transition-colors ${resizingCol === 'mail_type' ? 'bg-blue-500' : ''}`}
                                    onMouseDown={(e) => startResizing('mail_type', e)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </th>
                            <th
                                style={{ width: columnWidths.recipient, position: 'relative' }}
                                className="cursor-pointer hover:bg-gray-50 group"
                                onClick={() => handleSort('recipient_email')}
                            >
                                <div className="flex items-center">
                                    수신자
                                    {sortConfig.key === 'recipient_email' && (
                                        sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />
                                    )}
                                </div>
                                <div
                                    className={`absolute right-0 top-0 h-full w-[4px] cursor-col-resize hover:bg-blue-400 transition-colors ${resizingCol === 'recipient' ? 'bg-blue-500' : ''}`}
                                    onMouseDown={(e) => startResizing('recipient', e)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </th>
                            <th style={{ width: columnWidths.subject, position: 'relative' }}>
                                제목
                                <div
                                    className={`absolute right-0 top-0 h-full w-[4px] cursor-col-resize hover:bg-blue-400 transition-colors ${resizingCol === 'subject' ? 'bg-blue-500' : ''}`}
                                    onMouseDown={(e) => startResizing('subject', e)}
                                />
                            </th>
                            <th style={{ width: columnWidths.status }}>상태</th>
                            <th style={{ width: columnWidths.actions }}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="text-center py-10 text-gray-500">데이터를 불러오는 중...</td>
                            </tr>
                        ) : history.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-10 text-gray-500">발송 이력이 없습니다.</td>
                            </tr>
                        ) : (
                            history.map((item) => (
                                <tr key={item.id}>
                                    <td className="text-sm">
                                        {format(new Date(item.sent_at), 'yyyy-MM-dd HH:mm:ss')}
                                    </td>
                                    <td>
                                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                            {item.mail_type}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="font-medium">{item.recipient_name || '-'}</div>
                                        <div className="text-xs text-gray-400">{item.recipient_email}</div>
                                    </td>
                                    <td style={{ width: columnWidths.subject }}>
                                        <div
                                            className="truncate"
                                            style={{ maxWidth: columnWidths.subject ? columnWidths.subject - 20 : '300px' }}
                                            title={item.subject}
                                        >
                                            {item.subject}
                                        </div>
                                    </td>
                                    <td>
                                        {item.status === 'success' ? (
                                            <span className="flex items-center text-green-600 text-xs font-medium">
                                                <CheckCircle2 className="h-3 w-3 mr-1" /> 성공
                                            </span>
                                        ) : (
                                            <div className="flex flex-col">
                                                <span className="flex items-center text-red-600 text-xs font-medium">
                                                    <XCircle className="h-3 w-3 mr-1" /> 실패
                                                </span>
                                                {item.error_message && (
                                                    <span className="text-[10px] text-red-400 truncate max-w-[100px]" title={item.error_message}>
                                                        {item.error_message}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => handleViewDetail(item)}>
                                                <Eye className="h-3 w-3 mr-1" /> 보기
                                            </Button>
                                            <Button size="sm" variant="secondary" onClick={() => handleResend(item.id)} disabled={isProcessing}>
                                                <RefreshCcw className={`h-3 w-3 mr-1 ${isProcessing ? 'animate-spin' : ''}`} /> 재발송
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" /> 이전
                    </Button>
                    <span className="text-sm font-medium">
                        {pagination.page} / {pagination.totalPages}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={page === pagination.totalPages}
                        onClick={() => setPage(p => p + 1)}
                    >
                        다음 <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            )}

            {/* Detail Modal */}
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b">
                        <DialogTitle>메일본문 상세보기</DialogTitle>
                    </DialogHeader>

                    {selectedMail && (
                        <>
                            <div className="p-6 bg-gray-50 border-b space-y-2">
                                <div className="grid grid-cols-[100px_1fr] text-sm">
                                    <span className="text-gray-500">수신자:</span>
                                    <span>{selectedMail.recipient_name ? `${selectedMail.recipient_name} (${selectedMail.recipient_email})` : selectedMail.recipient_email}</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] text-sm">
                                    <span className="text-gray-500">유형:</span>
                                    <span>{selectedMail.mail_type}</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] text-sm font-bold">
                                    <span className="text-gray-500 font-normal">제목:</span>
                                    <span>{selectedMail.subject}</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto p-6 bg-white">
                                <div
                                    className="mail-content-preview border rounded p-4 min-h-[400px]"
                                    dangerouslySetInnerHTML={{ __html: selectedMail.content }}
                                />
                            </div>
                        </>
                    )}

                    <DialogFooter className="p-4 border-t bg-gray-50">
                        <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>닫기</Button>
                        {selectedMail && (
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setIsViewModalOpen(false);
                                    handleResend(selectedMail.id);
                                }}
                                disabled={isProcessing}
                            >
                                <RefreshCcw className="h-3 w-3 mr-1" /> 이 본문으로 재발송
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
