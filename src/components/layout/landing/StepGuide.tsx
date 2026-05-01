import { WalletCards, KeyRound, PlayCircle } from "lucide-react";

export default function StepGuide() {
    return (
        <section className="w-full py-12 md:py-16 lg:py-20 bg-muted/50" id="how-it-works">
            <div className="container px-4 md:px-6">
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">이용 방법</h2>
                        <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                            복잡한 절차 없이 3단계만 거치면 바로 이용 가능합니다.
                        </p>
                    </div>
                </div>
                <div className="mx-auto grid max-w-5xl items-start gap-6 py-12 lg:grid-cols-3 lg:gap-12">
                    <div className="grid gap-4 place-items-center text-center">
                        <div className="bg-background p-4 rounded-full shadow-sm">
                            <WalletCards className="h-10 w-10 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold">1. 결제</h3>
                        <p className="text-muted-foreground">
                            원하는 서비스와 이용 기간을 선택하고<br />
                            간편하게 결제하세요.
                        </p>
                    </div>
                    <div className="grid gap-4 place-items-center text-center">
                        <div className="bg-background p-4 rounded-full shadow-sm">
                            <KeyRound className="h-10 w-10 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold">2. 계정 수령</h3>
                        <p className="text-muted-foreground">
                            결제 후 영업시간 내에<br />
                            SMS로 계정 정보가 발송됩니다.
                        </p>
                    </div>
                    <div className="grid gap-4 place-items-center text-center">
                        <div className="bg-background p-4 rounded-full shadow-sm">
                            <PlayCircle className="h-10 w-10 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold">3. 즉시 이용</h3>
                        <p className="text-muted-foreground">
                            전달받은 ID/PW로 로그인하여<br />
                            프리미엄 서비스를 즐기세요.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
