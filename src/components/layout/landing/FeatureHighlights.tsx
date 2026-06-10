import { Card, CardTitle } from "@/components/ui/card";

// 상품페이지에서 랜딩으로 이관한 가치 제안 카드 — 설득은 랜딩에서 한 번만 한다.
const FEATURES = [
    {
        icon: '🆔',
        title: '고정 아이디 부여',
        description: '몇 달마다 바뀌는 일회용 계정은 이제 그만. 본인만의 고정 아이디로 끊김 없는 음악 여정을 지원합니다.',
    },
    {
        icon: '🛡️',
        title: '안심 구독 서비스',
        description: '불투명한 운영이 아닙니다. 지속적인 피드백과 모니터링을 통해 안정적인 스트리밍을 보장합니다.',
    },
    {
        icon: '🎵',
        title: '플레이리스트 이관',
        description: '기존 계정에서 듣던 노래들, 일일이 찾지 마세요. 달버스가 플레이리스트를 그대로 옮겨드립니다.',
    },
];

export default function FeatureHighlights() {
    return (
        <section className="w-full py-16 px-4">
            <div className="container max-w-4xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
                    달버스가 다른 이유
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {FEATURES.map(({ icon, title, description }) => (
                        <Card key={title} className="flex flex-col items-center text-center p-6 bg-primary/5 border-none shadow-sm hover:translate-y-[-4px] transition-transform duration-300">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                <span className="text-2xl">{icon}</span>
                            </div>
                            <CardTitle className="text-lg mb-2">{title}</CardTitle>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {description}
                            </p>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
