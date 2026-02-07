import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HeroSection() {
    return (
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-gradient-to-b from-background to-muted/50">
            <div className="container px-4 md:px-6">
                <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                            프리미엄 구독, <br className="hidden sm:inline" />
                            <span className="text-primary">최대 70% 할인</span>된 가격으로.
                        </h1>
                        <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                            달버스(Dalbus)에서 안전하고 저렴하게 공유 계정을 이용하세요.
                            Tidal, Netflix, Youtube Premium 등 다양한 서비스를 지원합니다.
                        </p>
                    </div>
                    <div className="space-x-4">
                        <Link href="/public/products">
                            <Button size="lg" className="h-11 px-8">
                                서비스 시작하기
                            </Button>
                        </Link>
                        <Link href="#how-it-works">
                            <Button variant="outline" size="lg" className="h-11 px-8">
                                이용 방법
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
