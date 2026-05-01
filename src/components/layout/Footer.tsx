import Link from "next/link";

export default function Footer() {
    return (
        <footer className="border-t bg-muted/40">
            <div className="container flex flex-col gap-4 py-10 md:h-24 md:flex-row md:py-0 items-center justify-between">
                <div className="flex flex-col gap-2 md:gap-0">
                    <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                        Built by{" "}
                        <span className="font-medium underline underline-offset-4">
                            Dalbus Team
                        </span>
                        . All rights reserved.
                    </p>
                </div>
                <div className="flex gap-4">
                    <Link href="/public/terms" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                        이용약관
                    </Link>
                    <Link href="/public/privacy" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                        개인정보처리방침
                    </Link>
                </div>
            </div>
        </footer>
    );
}
