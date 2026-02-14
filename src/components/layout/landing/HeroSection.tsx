
export default function HeroSection() {
    return (
        <section className="w-full py-12 md:py-16 lg:py-20 bg-gradient-to-b from-background to-muted/50">
            <div className="container px-4 md:px-6">
                <div className="flex flex-col items-center space-y-6 text-center">
                    <div className="space-y-4">
                        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl text-muted-foreground">
                            지속적 으로 안정적인
                        </h1>
                        <div className="flex flex-col space-y-2">
                            <span className="text-4xl font-bold tracking-tighter sm:text-6xl md:text-7xl">
                                가장 편리한
                            </span>
                            <span className="text-4xl font-bold tracking-tighter sm:text-6xl md:text-7xl text-primary">
                                TIDAL HIFI service
                            </span>
                        </div>
                        <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400 whitespace-pre-line leading-relaxed">
                            복잡한 우회 가입은 이제 그만,{"\n"}
                            달버스에서 타이달을 만나보세요
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
