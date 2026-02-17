"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from 'next/image';
import { Badge } from "@/components/ui/badge";
import { useServices } from '@/lib/ServiceContext';

export default function ProductsPage() {
    const { services, isHydrated } = useServices();

    if (!isHydrated) {
        return (
            <div className="container py-12 flex justify-center items-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="container py-12">
            <div className="flex flex-col items-center mb-12 text-center">
                <p className="max-w-[700px] text-muted-foreground md:text-xl">
                    달버스에서 제공하는 프리미엄 구독 서비스를 놀라운 가격에 만나보세요.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                <Card className="flex flex-col items-center text-center p-6 bg-primary/5 border-none shadow-sm hover:translate-y-[-4px] transition-transform duration-300">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <span className="text-2xl">🆔</span>
                    </div>
                    <CardTitle className="text-lg mb-2">고정 아이디 부여</CardTitle>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        몇 달마다 바뀌는 일회용 계정은 이제 그만.{"\n"}본인만의 고정 아이디로 끊김 없는 음악 여정을 지원합니다.
                    </p>
                </Card>
                <Card className="flex flex-col items-center text-center p-6 bg-primary/5 border-none shadow-sm hover:translate-y-[-4px] transition-transform duration-300">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <span className="text-2xl">🛡️</span>
                    </div>
                    <CardTitle className="text-lg mb-2">안심 구독 서비스</CardTitle>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        불투명한 운영이 아닙니다.{"\n"}지속적인 피드백과 모니터링을 통해 안정적인 스트리밍을 보장합니다.
                    </p>
                </Card>
                <Card className="flex flex-col items-center text-center p-6 bg-primary/5 border-none shadow-sm hover:translate-y-[-4px] transition-transform duration-300">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <span className="text-2xl">🎵</span>
                    </div>
                    <CardTitle className="text-lg mb-2">플레이리스트 이관</CardTitle>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        기존 계정에서 듣던 노래들, 일일이 찾지 마세요.{"\n"}달버스가 플레이리스트를 그대로 옮겨드립니다.
                    </p>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.length > 0 ? (
                    services.map((product) => (
                        <Card key={product.id} className="flex flex-col overflow-hidden glass hover:shadow-lg transition-all duration-300">
                            <CardHeader className="pb-4">
                                <div className="h-20 w-full relative flex items-center justify-center mb-4 bg-muted/30 rounded-lg overflow-hidden p-2">
                                    {product.icon && product.icon.startsWith('/') ? (
                                        <Image
                                            src={product.icon}
                                            alt={product.name}
                                            fill
                                            className="h-full w-auto object-contain transition-transform duration-500 hover:scale-110"
                                        />
                                    ) : null}
                                    <div
                                        className="text-4xl"
                                        style={{ display: product.icon && product.icon.startsWith('/') ? 'none' : 'block' }}
                                    >
                                        {(!product.icon || product.icon === 'default') ? '🎧' : product.icon}
                                    </div>
                                </div>
                                <CardTitle className="text-xl">{product.name}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 pb-6">
                                <p className="text-sm text-muted-foreground mb-4">
                                    {product.description || '가장 저렴하고 안전한 공유 계정 이용.'}
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold">₩{product.price}</span>
                                    {product.tag && (
                                        <Badge variant="secondary" className="ml-auto">
                                            {product.tag}
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">/월 이용료</p>
                            </CardContent>
                            <CardFooter className="pt-0 p-6">
                                <Link href={`/service/${product.id}`} className="w-full">
                                    <Button className="w-full">구매하기</Button>
                                </Link>
                            </CardFooter>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full text-center py-20">
                        <p className="text-muted-foreground">사용 가능한 서비스가 없습니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
