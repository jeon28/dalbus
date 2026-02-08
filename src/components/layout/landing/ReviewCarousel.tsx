import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// In a real app, this data would come from a database or CMS
const REVIEWS = [
    {
        name: "김철수",
        role: "Tidal 사용자",
        content: "음질 차이가 확실히 느껴지네요. 저렴하게 이용해서 너무 좋습니다.",
        avatar: "K",
    },
    {
        name: "이영희",
        role: "Youtube 사용자",
        content: "가족 요금제 찾기 힘들었는데 달버스 덕분에 편하게 쓰고 있어요. 배정도 빨라요!",
        avatar: "L",
    },
    {
        name: "박지성",
        role: "Netflix 사용자",
        content: "매달 결제 귀찮았는데 3개월권 끊어서 편합니다. 화질도 4K라 만족.",
        avatar: "P",
    },
];

export default function ReviewCarousel() {
    return (
        <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
            <div className="container px-4 md:px-6">
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">사용자 후기</h2>
                        <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                            이미 많은 분들이 달버스와 함께하고 있습니다.
                        </p>
                    </div>
                </div>
                <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3">
                    {REVIEWS.map((review, i) => (
                        <Card key={i} className="h-full">
                            <CardContent className="flex flex-col gap-4 p-6">
                                <p className="text-muted-foreground italic">&quot;{review.content}&quot;</p>
                                <div className="flex items-center gap-4 mt-auto">
                                    <Avatar>
                                        <AvatarFallback>{review.avatar}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-bold leading-none">{review.name}</p>
                                        <p className="text-xs text-muted-foreground">{review.role}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
