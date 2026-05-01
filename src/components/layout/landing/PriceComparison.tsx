import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import Link from "next/link";

export default function PriceComparison() {
    return (
        <section className="w-full py-12 md:py-16 lg:py-20 bg-background" id="pricing">
            <div className="container px-4 md:px-6">
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">가격 비교</h2>
                        <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                            정가 대비 압도적인 가격 경쟁력을 확인하세요.
                        </p>
                    </div>
                </div>
                <div className="mx-auto grid max-w-5xl items-center gap-6 py-8 lg:grid-cols-2 lg:gap-12">
                    <Card className="relative overflow-hidden border-2 border-muted bg-background">
                        <CardHeader className="flex flex-col items-center justify-center space-y-2 border-b p-6">
                            <div className="grid place-items-center rounded-full bg-muted p-3">
                                <X className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <CardTitle className="text-xl font-bold">개별 구독 (정가)</CardTitle>
                            <div className="text-4xl font-bold">₩16,000<span className="text-sm font-normal text-muted-foreground">/월</span></div>
                        </CardHeader>
                        <CardContent className="grid gap-4 p-6 place-items-center">
                            <ul className="grid gap-2 text-sm text-center">
                                <li className="flex items-center gap-2"><X className="h-4 w-4 text-red-500" /> 높은 비용 부담</li>
                                <li className="flex items-center gap-2"><X className="h-4 w-4 text-red-500" /> 복잡한 가입 및 결제 절차</li>
                                <li className="flex items-center gap-2"><X className="h-4 w-4 text-red-500" /> 환율 변동 영향</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Link href="/public/products" className="block group">
                        <Card className="relative overflow-hidden border-2 border-primary bg-background shadow-lg cursor-pointer transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-xl active:scale-[0.98]">
                            <div className="absolute top-0 right-0 bg-primary px-3 py-1 text-xs font-bold text-primary-foreground rounded-bl-lg">
                                BEST CHOICE
                            </div>
                            <CardHeader className="flex flex-col items-center justify-center space-y-2 border-b p-6 bg-primary/5">
                                <div className="grid place-items-center rounded-full bg-primary p-3 transition-transform group-hover:scale-110">
                                    <Check className="h-6 w-6 text-primary-foreground" />
                                </div>
                                <CardTitle className="text-xl font-bold text-primary">달버스 (Dalbus)</CardTitle>
                                <div className="text-4xl font-bold text-primary">₩4,900<span className="text-sm font-normal text-primary/70">/월</span></div>
                                <p className="text-xs text-muted-foreground">6개월권 약 ₩30,000</p>
                            </CardHeader>
                            <CardContent className="grid gap-4 p-6 place-items-center">
                                <ul className="grid gap-2 text-sm text-center">
                                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> 압도적인 가격 혜택</li>
                                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> 6개월 / 12개월 선택 가능</li>
                                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> 장기간 안정적 이용</li>
                                </ul>
                                <div className="mt-2 text-sm font-bold text-primary flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                    서비스 신청하기 →
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </div>
        </section>
    );
}
