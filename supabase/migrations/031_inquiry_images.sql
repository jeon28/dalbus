-- 1:1 문의 이미지 첨부 (Base64 data URL 배열)
-- 문의(images)와 답변(answer_images) 모두 지원. 문의 삭제 시 함께 제거된다.
ALTER TABLE public.inquiries
    ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS answer_images TEXT[] DEFAULT '{}';
