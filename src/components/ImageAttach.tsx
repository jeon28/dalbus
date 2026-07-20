"use client";

import React from 'react';
import { compressImageToDataUrl } from '@/lib/image';
import { X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

export const MAX_IMAGES = 5;

/** 파일 목록을 압축해 기존 이미지 배열에 추가한다 (최대 개수 제한 적용). */
export async function addImageFiles(files: File[], current: string[], max = MAX_IMAGES): Promise<string[]> {
    const room = max - current.length;
    if (room <= 0) {
        toast.error(`이미지는 최대 ${max}개까지 첨부할 수 있습니다.`);
        return current;
    }
    const picked = files.slice(0, room);
    const out = [...current];
    for (const f of picked) {
        try {
            out.push(await compressImageToDataUrl(f));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : '이미지 처리에 실패했습니다.');
        }
    }
    if (files.length > room) {
        toast.error(`이미지는 최대 ${max}개까지 첨부할 수 있습니다.`);
    }
    return out;
}

/** 붙여넣기 이벤트에서 이미지 파일만 추출한다. */
export function extractImageFilesFromPaste(e: React.ClipboardEvent): File[] {
    const items = e.clipboardData?.items;
    if (!items) return [];
    const files: File[] = [];
    for (const it of Array.from(items)) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
            const f = it.getAsFile();
            if (f) files.push(f);
        }
    }
    return files;
}

/** 첨부 버튼 + 썸네일(삭제 가능) 편집 UI */
export function ImageAttach({ images, onChange, max = MAX_IMAGES, disabled }: {
    images: string[];
    onChange: (imgs: string[]) => void;
    max?: number;
    disabled?: boolean;
}) {
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length) onChange(await addImageFiles(files, images, max));
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={handleSelect} disabled={disabled} />
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={disabled}
                    className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50"
                >
                    <ImageIcon className="w-3.5 h-3.5" /> 이미지 첨부
                </button>
                <span className="text-xs text-gray-400">또는 입력창에 Ctrl+V로 붙여넣기 (최대 {max}개)</span>
            </div>
            {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {images.map((src, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="첨부 이미지" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                                aria-label="이미지 삭제"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/** 읽기 전용 썸네일 + 클릭 시 확대(라이트박스) */
export function ImageThumbs({ images, label }: { images: string[] | null | undefined; label?: string }) {
    const [zoom, setZoom] = React.useState<string | null>(null);
    if (!images || images.length === 0) return null;
    return (
        <>
            {label && <p className="text-xs font-bold text-gray-500 mt-2 mb-1">{label}</p>}
            <div className="flex flex-wrap gap-2 mt-1">
                {images.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        key={i}
                        src={src}
                        alt="첨부 이미지"
                        onClick={() => setZoom(src)}
                        className="w-24 h-24 object-cover rounded-md border cursor-zoom-in hover:opacity-90"
                    />
                ))}
            </div>
            {zoom && (
                <div
                    onClick={() => setZoom(null)}
                    className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={zoom} alt="첨부 이미지 확대" className="max-w-full max-h-full rounded" />
                </div>
            )}
        </>
    );
}
