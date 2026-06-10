import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// 상품/가격 변동 반영을 위해 1분 단위 재생성 (SEO + 빠른 초기 렌더)
export const revalidate = 60;

export const metadata: Metadata = {
    title: '구독 상품 | 달버스',
    description: '타이달(TIDAL) HIFI를 월 최저가로. 달버스의 프리미엄 구독 상품을 확인하세요.',
};

interface ProductResponse {
    id: string;
    name: string;
    image_url: string | null;
    original_price: number;
    description: string | null;
    tags: string[] | null;
}

interface Product {
    id: string;
    name: string;
    icon: string;
    price: string;
    description: string;
    tag: string;
}

async function getProducts(): Promise<Product[]> {
    const { data, error } = await supabaseAdmin
        .from('products')
        .select(`*, product_plans (*)`)
        .eq('is_active', true)
        .eq('product_plans.is_active', true)
        .not('name', 'ilike', '%HifiTidal%')
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Error fetching public products (SSR):', error);
        return [];
    }

    return ((data as ProductResponse[]) ?? [])
        // Hifitidal 상품 2차 필터(안전망)
        .filter((p) => !p.name.toLowerCase().includes('hifitidal'))
        .map((p) => ({
            id: p.id,
            name: p.name,
            icon: p.image_url || 'default',
            price: p.original_price.toLocaleString(),
            description: p.description || '가장 저렴하고 안전한 공유 계정 이용.',
            tag: (p.tags && p.tags.length > 0) ? p.tags[0] : '',
        }));
}

export default async function ProductsPage() {
    const products = await getProducts();

    return (
        <div className="container py-12 px-4 max-w-4xl mx-auto">
            <div className="flex flex-col items-center mb-12 text-center text-zinc-900">
                <p className="max-w-[700px] text-muted-foreground md:text-xl">
                    달버스에서 제공하는 프리미엄 구독 서비스를 놀라운 가격에 만나보세요.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                    고정 아이디 · 안정 운영 · 플레이리스트 이관 지원
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.length > 0 ? (
                    products.map((product) => (
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
                                    ) : (
                                        <div className="text-4xl">
                                            {(!product.icon || product.icon === 'default') ? '🎧' : product.icon}
                                        </div>
                                    )}
                                </div>
                                <CardTitle className="text-xl">{product.name}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 pb-6">
                                <p className="text-sm text-muted-foreground mb-4">
                                    {product.description}
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
