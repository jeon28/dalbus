import HeroSection from "@/components/layout/landing/HeroSection";
import PriceComparison from "@/components/layout/landing/PriceComparison";
import StepGuide from "@/components/layout/landing/StepGuide";
import ReviewCarousel from "@/components/layout/landing/ReviewCarousel";
export default async function LandingPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-between">
            <HeroSection />
            <PriceComparison />
            <StepGuide />
            <ReviewCarousel />
        </main>
    );
}
