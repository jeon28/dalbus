"use client";

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ShieldCheck, Lock, Eye, EyeOff } from 'lucide-react';

export function ForgotPasswordDialog() {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(1); // 1: Verify Identity & OTP, 2: New Password
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [statusMsg, setStatusMsg] = useState({ text: '', isError: false });
    const [code, setCode] = useState('');
    const [passwords, setPasswords] = useState({
        new: '',
        confirm: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (countdown > 0) {
            timer = setInterval(() => {
                setCountdown((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [countdown]);

    const handleRequestCode = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setStatusMsg({ text: '', isError: false });

        if (!name || !phone || !email) {
            setStatusMsg({ text: '이름, 전화번호, 이메일을 모두 입력해 주세요.', isError: true });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/password-reset/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name, phone })
            });
            const data = await res.json();
            if (res.ok) {
                setStatusMsg({ text: data.message, isError: false });
                setIsOtpSent(true);
                setCountdown(60); // Start 60s cooldown
            } else {
                setStatusMsg({ text: data.message || data.error, isError: true });
            }
        } catch (error) {
            console.error(error);
            setStatusMsg({ text: '인증번호 요청 중 오류가 발생했습니다.', isError: true });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatusMsg({ text: '', isError: false });
        setLoading(true);
        try {
            const res = await fetch('/api/auth/password-reset/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code })
            });
            const data = await res.json();
            if (res.ok) {
                setStep(2); // Move to password reset
                setStatusMsg({ text: '', isError: false });
            } else {
                setStatusMsg({ text: data.message || data.error, isError: true });
            }
        } catch (error) {
            console.error(error);
            setStatusMsg({ text: '인증번호 확인 중 오류가 발생했습니다.', isError: true });
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatusMsg({ text: '', isError: false });

        if (passwords.new !== passwords.confirm) {
            setStatusMsg({ text: '비밀번호가 일치하지 않습니다.', isError: true });
            return;
        }
        if (passwords.new.length < 6) {
            setStatusMsg({ text: '비밀번호는 6자 이상이어야 합니다.', isError: true });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/password-reset/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, newPassword: passwords.new })
            });
            const data = await res.json();
            if (res.ok) {
                alert('비밀번호가 성공적으로 변경되었습니다. 다시 로그인해 주세요.');
                setOpen(false);
                resetState();
            } else {
                setStatusMsg({ text: data.message || data.error, isError: true });
            }
        } catch (error) {
            console.error(error);
            setStatusMsg({ text: '비밀번호 변경 중 오류가 발생했습니다.', isError: true });
        } finally {
            setLoading(false);
        }
    };

    const resetState = () => {
        setStep(1);
        setIsOtpSent(false);
        setStatusMsg({ text: '', isError: false });
        setEmail('');
        setName('');
        setPhone('');
        setCode('');
        setPasswords({ new: '', confirm: '' });
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) resetState();
        }}>
            <DialogTrigger asChild>
                <button type="button" style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '13px',
                    cursor: 'pointer',
                    padding: '0',
                    textDecoration: 'underline'
                }}>
                    비밀번호를 잊으셨나요?
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>비밀번호 찾기</DialogTitle>
                    <DialogDescription>
                        {step === 1 && "회원가입 시 등록한 정보를 입력해 주세요."}
                        {step === 2 && "새로 사용할 비밀번호를 입력해 주세요."}
                    </DialogDescription>
                </DialogHeader>

                {step === 1 && (
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="reset-name">이름</Label>
                            <Input
                                id="reset-name"
                                type="text"
                                placeholder="가입 시 등록한 이름"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isOtpSent}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reset-phone">전화번호</Label>
                            <Input
                                id="reset-phone"
                                type="tel"
                                placeholder="010-0000-0000"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                disabled={isOtpSent}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reset-email">이메일 (ID)</Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="reset-email"
                                        type="email"
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10"
                                        disabled={isOtpSent}
                                        required
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => handleRequestCode()}
                                    disabled={loading || isOtpSent || countdown > 0}
                                    className="whitespace-nowrap"
                                >
                                    {isOtpSent ? (countdown > 0 ? `${countdown}초 후 재발송 가능` : "재발송 받기") : "인증번호 받기"}
                                </Button>
                            </div>
                            {statusMsg.text && (
                                <p className={`text-xs mt-1 ${statusMsg.isError ? 'text-red-500' : 'text-blue-500'}`}>
                                    {statusMsg.text}
                                </p>
                            )}
                        </div>

                        {isOtpSent && (
                            <form onSubmit={handleVerifyCode} className="space-y-4 pt-4 border-t mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="reset-code">인증번호</Label>
                                    <div className="relative">
                                        <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="reset-code"
                                            type="text"
                                            placeholder="6자리 숫자 입력"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value)}
                                            className="pl-10"
                                            maxLength={6}
                                            required
                                        />
                                    </div>
                                </div>
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? "확인 중..." : "인증하기"}
                                </Button>
                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={() => handleRequestCode()}
                                        className="text-xs text-muted-foreground underline"
                                        disabled={loading || countdown > 0}
                                    >
                                        {countdown > 0 ? `재발송 대기중 (${countdown}초)` : '인증번호 재발송'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {step === 2 && (
                    <form onSubmit={handleResetPassword} className="space-y-4 pt-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-password">새 비밀번호</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="new-password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="6자 이상 입력"
                                        value={passwords.new}
                                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                        className="pl-10 pr-10"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-2.5 text-muted-foreground"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">비밀번호 확인</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="confirm-password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="비밀번호 다시 입력"
                                        value={passwords.confirm}
                                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                        className="pl-10 pr-10"
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                        {statusMsg.text && (
                            <p className="text-xs text-red-500">
                                {statusMsg.text}
                            </p>
                        )}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "변경 중..." : "비밀번호 변경하기"}
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
