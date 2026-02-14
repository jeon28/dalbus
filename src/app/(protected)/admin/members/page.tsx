/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css'; // Reusing admin styles
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MemberListPage() {
    const { isAdmin } = useServices();
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!isAdmin) {
            router.push('/admin');
        } else {
            fetchMembers();
        }
    }, [isAdmin, router]);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/members');
            if (!response.ok) throw new Error('Failed to fetch members');
            const data = await response.json();
            setMembers(data);
        } catch (error) {
            console.error('Error fetching members:', error);
        }
        setLoading(false);
    };

    const handleDeleteMember = async (member: any) => {
        if (!confirm(`'${member.name}' (${member.email}) 회원을 삭제하시겠습니까?\n\n주의: 이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/members?id=${member.id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '삭제 실패');
            }

            alert('✅ ' + result.message);
            fetchMembers(); // Refresh the list
        } catch (error) {
            const e = error as Error;
            alert('❌ ' + e.message);
        }
    };

    if (!isAdmin) return null;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container">
                    <h1 className={styles.title}>회원 정보 관리</h1>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                <section className={styles.orderSection}>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>가입일</th>
                                    <th>이름</th>
                                    <th>이메일</th>
                                    <th>연락처</th>
                                    <th className="text-center" style={{ width: '80px' }}>관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8">로딩 중...</td>
                                    </tr>
                                ) : members.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8">가입된 회원이 없습니다.</td>
                                    </tr>
                                ) : (
                                    members.map(member => (
                                        <tr key={member.id}>
                                            <td>{new Date(member.created_at).toLocaleDateString()}</td>
                                            <td className="font-medium">{member.name}</td>
                                            <td>{member.email}</td>
                                            <td>{member.phone || '-'}</td>
                                            <td className="text-center">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                                                    title="회원 삭제"
                                                    onClick={() => handleDeleteMember(member)}
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </main>
    );
}
