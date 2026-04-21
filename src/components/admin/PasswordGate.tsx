"use client";

import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PasswordGateProps {
    onUnlock: () => void;
    title?: string;
    subtitle?: string;
}

export function PasswordGate({ 
    onUnlock, 
    title = "Quick Access", 
    subtitle = "Legacy Tidal 관리자" 
}: PasswordGateProps) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/quick/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            if (res.ok) {
                const data = await res.json();
                sessionStorage.setItem('quick-token', data.token);
                onUnlock();
            } else {
                setError('비밀번호가 올바르지 않습니다.');
            }
        } catch {
            setError('서버 연결 실패');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div className="w-full max-w-sm mx-4">
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/20">
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                            <Lock className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-white">{title}</h1>
                        <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Input
                                type="password"
                                placeholder="비밀번호 입력"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="h-12 bg-white/10 border-white/20 text-white placeholder:text-slate-400 text-center text-lg tracking-widest focus-visible:ring-orange-500"
                                autoFocus
                            />
                        </div>
                        {error && (
                            <p className="text-red-400 text-sm text-center animate-pulse">{error}</p>
                        )}
                        <Button
                            type="submit"
                            disabled={loading || !password}
                            className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold text-base shadow-lg"
                        >
                            {loading ? '확인 중...' : '접속'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
