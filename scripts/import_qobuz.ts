/**
 * QOBUZ 초기 데이터 임포트.
 *
 * 구글 스프레드시트("Qobuz Bus")의 QOBUZ 탭을 CSV 로 내려받아 qobuz_accounts /
 * qobuz_assignments 로 옮긴다.
 *
 * 사용법:
 *   npx tsx scripts/import_qobuz.ts data/qobuz.csv --dry-run   # 리포트만 뽑고 DB 는 안 건드림
 *   npx tsx scripts/import_qobuz.ts data/qobuz.csv             # 실제 INSERT
 *
 * 규칙 (확정 사항):
 *   - 시트 A열(그룹)은 폐기(QG13~QG22 뒤에 57·58 같은 맨 숫자가 섞여 형식이 일관되지 않다).
 *     대표계정(B열) 오름차순으로 QG01 부터 새로 부여하고 이후 불변으로 쓴다.
 *     이메일은 그룹핑 키라서 중복이 없고 종료일처럼 시간에 따라 바뀌지도 않으므로,
 *     재실행해도 같은 그룹이 같은 번호를 받는다.
 *   - A~K 열만 쓴다. L열 이후(개인 이메일·주민등록번호·메모 문장이 섞인 오염 열)는 버린다.
 *   - 계약금액은 전 행 75,000원 고정. 메모는 비운다.
 *   - 비밀번호는 시트에 없으므로 비운다.
 *
 * 자동 보정이 위험한 값은 건드리지 않고 null 로 두고 리뷰 리포트에 기록한다.
 * 리포트를 보고 관리 화면에서 수동 보정하면 된다.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------
// 상수
// ------------------------------------------------------------

/** 전 행 고정 계약금액 (칠만오천원) */
const FIXED_AMOUNT = 75000;
/** 대표계정 1개당 하부계정 5개 */
const DEFAULT_MAX_SLOTS = 5;
/** 그룹 ID 접두사 */
const GROUP_PREFIX = 'QG';
/** 스프레드시트 수식 에러값 — 전부 null 처리한다 */
const FORMULA_ERRORS = new Set(['#VALUE!', '#REF!', '#N/A', '#NAME?', '#DIV/0!', '#NULL!', '#NUM!']);

// ------------------------------------------------------------
// 환경변수 (.env.local 직접 파싱 — dotenv 미설치)
// ------------------------------------------------------------

function loadEnvLocal(): Record<string, string> {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const env: Record<string, string> = {};
    if (!fs.existsSync(envPath)) return env;

    for (const rawLine of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        env[key] = value;
    }
    return env;
}

// ------------------------------------------------------------
// CSV 파싱
// ------------------------------------------------------------

/**
 * RFC4180 형식 CSV 파서.
 *
 * 쿼팅된 콤마("Ryu, Chung", "KIM, JIN HONG")와 셀 안 줄바꿈이 실제로 들어 있으므로
 * split(',') 로는 안 된다.
 */
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    // BOM 제거
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    for (let i = 0; i < text.length; i++) {
        const c = text[i];

        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else {
                field += c;
            }
            continue;
        }

        if (c === '"') { inQuotes = true; continue; }
        if (c === ',') { row.push(field); field = ''; continue; }
        if (c === '\r') continue;
        if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
        field += c;
    }

    if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
}

/** 모든 셀에서 앞뒤 공백을 제거한다 ("Han Sangmin  ", "최동준 " 등 후행 공백이 실재) */
function cell(row: string[], idx: number): string {
    return (row[idx] ?? '').trim();
}

// ------------------------------------------------------------
// 값 정규화
// ------------------------------------------------------------

function isBlank(v: string): boolean {
    return !v || FORMULA_ERRORS.has(v);
}

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

/**
 * 시트 날짜 → YYYY-MM-DD.
 *
 * 실측된 포맷이 최소 5가지 섞여 있다:
 *   "2025. 4. 2" (Google 로컬) / "2024-05-30" (ISO) / "27-3-23" (yy-m-d, 2자리 연도)
 *   "4/9" (연도 없음) / "#VALUE!" / "매월" / 시리얼 숫자
 *
 * 연도를 알 수 없는 값은 추측하지 않고 null 을 반환한다. (호출부에서 역산/리포트 처리)
 */
function parseSheetDate(raw: string): { date: string | null; reason?: string } {
    const v = raw.trim();
    if (!v) return { date: null };
    if (FORMULA_ERRORS.has(v)) return { date: null, reason: `수식 에러(${v})` };

    // Excel/Sheets 시리얼 넘버 (1900-01-01 기준). 날짜로 해석 가능한 범위만 받는다.
    if (/^\d+(\.\d+)?$/.test(v)) {
        const serial = Number(v);
        if (serial > 20000 && serial < 80000) {
            const ms = (serial - 25569) * 86400 * 1000;
            const d = new Date(ms);
            return { date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` };
        }
        return { date: null, reason: `날짜로 해석 불가한 숫자(${v})` };
    }

    // 구분자를 통일해서 [a, b, c] 로 자른다. "2025. 4. 2" / "2024-05-30" / "27-3-23" / "4/9"
    const parts = v.split(/[.\-/\s]+/).map(s => s.trim()).filter(Boolean);

    if (parts.length === 3 && parts.every(p => /^\d+$/.test(p))) {
        const [rawYear, m, d] = parts.map(Number);
        // 2자리 연도: 70 미만이면 2000년대 ("27-3-23" → 2027-03-23)
        const y = rawYear >= 100 ? rawYear : (rawYear < 70 ? 2000 + rawYear : 1900 + rawYear);
        if (m < 1 || m > 12 || d < 1 || d > 31) return { date: null, reason: `날짜 범위 밖(${v})` };
        if (y < 1900 || y > 2100) return { date: null, reason: `연도 이상(${v})` };
        return { date: `${y}-${pad2(m)}-${pad2(d)}` };
    }

    if (parts.length === 2 && parts.every(p => /^\d+$/.test(p))) {
        // "4/9", "5/28" — 연도가 없다. 추측하지 않는다.
        return { date: null, reason: `연도 없는 날짜(${v})` };
    }

    return { date: null, reason: `해석 불가한 날짜(${v})` };
}

/** 날짜에 일수를 더한다 (YYYY-MM-DD 입출력) */
function addDaysIso(iso: string, days: number): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** 구독 기간(K열). "24"/"36" 정수 외에 "17일", "매월" 같은 문자열이 섞여 있다. */
function parsePeriodMonths(raw: string): { months: number | null; reason?: string } {
    const v = raw.trim();
    if (!v) return { months: null };
    if (FORMULA_ERRORS.has(v)) return { months: null, reason: `수식 에러(${v})` };
    if (/^\d+$/.test(v)) {
        const n = Number(v);
        if (n > 0 && n <= 600) return { months: n };
        return { months: null, reason: `기간 범위 밖(${v})` };
    }
    return { months: null, reason: `개월 수가 아님(${v})` };
}

/** 전화번호 정규화. 표준은 010-1234-5678, 공백 구분("010 9492 2902")도 실재한다. */
function normalizePhone(raw: string): { phone: string | null; reason?: string } {
    const v = raw.trim();
    if (!v) return { phone: null };
    const digits = v.replace(/[^0-9]/g, '');
    if (!digits) return { phone: null, reason: `숫자 없는 전화번호(${v})` };
    if (digits.startsWith('010') && digits.length === 11) {
        return { phone: digits.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3') };
    }
    if (digits.startsWith('010') && digits.length === 10) {
        return { phone: digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3') };
    }
    // 형식이 어긋나도 연락처는 버리면 안 된다. 원문을 살리고 리포트만 남긴다.
    return { phone: v, reason: `표준 형식이 아닌 전화번호(${v})` };
}

/** 이메일. 값이 있어도 이메일이 아닌 경우가 실재한다 ("mozart37" — 도메인 없음) */
function normalizeEmail(raw: string): { email: string | null; reason?: string } {
    const v = raw.trim();
    if (!v) return { email: null };
    if (!v.includes('@') || !v.includes('.')) return { email: null, reason: `이메일 형식 아님(${v})` };
    return { email: v.toLowerCase() };
}

const HANGUL_ONLY = /^[가-힣\s]+$/;

// ------------------------------------------------------------
// 타입
// ------------------------------------------------------------

interface SheetRow {
    csvLine: number;      // 사람이 시트에서 찾을 수 있도록 1-based 행 번호
    masterEmail: string;  // B열
    masterEndRaw: string; // C열
    qobuzId: string;      // D열
    screenName: string;   // E열
    tel: string;          // F열
    email: string;        // G열
    name: string;         // H열
    startRaw: string;     // I열
    endRaw: string;       // J열
    periodRaw: string;    // K열
}

interface ReviewIssue {
    csvLine: number;
    group: string;
    slot: string;
    field: string;
    rawValue: string;
    issue: string;
}

// ------------------------------------------------------------
// 메인
// ------------------------------------------------------------

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const csvPath = args.find(a => !a.startsWith('--'));

    if (!csvPath) {
        console.error('사용법: npx tsx scripts/import_qobuz.ts <csv경로> [--dry-run]');
        process.exit(1);
    }

    const absCsv = path.resolve(process.cwd(), csvPath);
    if (!fs.existsSync(absCsv)) {
        console.error(`CSV 파일을 찾을 수 없습니다: ${absCsv}`);
        process.exit(1);
    }

    // --- 1. CSV 파싱 ---------------------------------------------------
    const rows = parseCsv(fs.readFileSync(absCsv, 'utf-8'));

    // 헤더 행 찾기 (A열이 '그룹'). 못 찾으면 첫 행을 헤더로 본다.
    let headerIdx = rows.findIndex(r => cell(r, 0) === '그룹' && cell(r, 1) === '대표계정');
    if (headerIdx === -1) {
        console.warn('⚠ 헤더 행(A="그룹", B="대표계정")을 찾지 못했습니다. 1행을 헤더로 간주합니다.');
        headerIdx = 0;
    }

    const issues: ReviewIssue[] = [];
    const sheetRows: SheetRow[] = [];
    let skippedStubs = 0;

    for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        const csvLine = i + 1;

        const masterEmail = cell(r, 1).toLowerCase();
        const dataCells = [2, 3, 4, 5, 6, 7, 8, 9, 10].map(idx => cell(r, idx));
        const hasSlotData = [3, 4, 5, 6, 7, 8, 9, 10].some(idx => cell(r, idx) !== '');

        // 시트 상단에 A/B/C만 채워진 껍데기 행이 있다 (D~K 전부 빈칸). 건너뛴다.
        if (!hasSlotData) { if (masterEmail) skippedStubs++; continue; }

        if (!masterEmail) {
            issues.push({
                csvLine, group: '', slot: '', field: '대표계정(B)',
                rawValue: '', issue: '대표계정이 비어 있어 그룹을 묶을 수 없음 — 건너뜀'
            });
            continue;
        }

        sheetRows.push({
            csvLine,
            masterEmail,
            masterEndRaw: dataCells[0],
            qobuzId: cell(r, 3),
            screenName: cell(r, 4),
            tel: cell(r, 5),
            email: cell(r, 6),
            name: cell(r, 7),
            startRaw: cell(r, 8),
            endRaw: cell(r, 9),
            periodRaw: cell(r, 10),
        });
    }

    console.log(`CSV 읽기 완료: 데이터 ${sheetRows.length}행 (껍데기 행 ${skippedStubs}건 건너뜀)`);

    // --- 2. 대표계정(B열) 기준 그룹핑 ------------------------------------
    // A/B/C 가 그룹 내 전 행에 반복 기입돼 있으므로(병합셀 아님) forward-fill 불필요.
    const groupMap = new Map<string, { rows: SheetRow[]; firstLine: number }>();
    for (const row of sheetRows) {
        let g = groupMap.get(row.masterEmail);
        if (!g) { g = { rows: [], firstLine: row.csvLine }; groupMap.set(row.masterEmail, g); }
        g.rows.push(row);
    }

    // --- 3. 대표계정 종료일 오름차순 정렬 → QG01 부터 부여 ------------------
    const groups = Array.from(groupMap.entries()).map(([masterEmail, g]) => {
        // 그룹 내 첫 유효 종료일을 대표계정 종료일로 본다
        let masterEnd: string | null = null;
        for (const r of g.rows) {
            const parsed = parseSheetDate(r.masterEndRaw);
            if (parsed.date) { masterEnd = parsed.date; break; }
        }
        if (!masterEnd) {
            const raw = g.rows[0].masterEndRaw;
            issues.push({
                csvLine: g.firstLine, group: '', slot: '', field: '대표계정 종료일(C)',
                rawValue: raw, issue: parseSheetDate(raw).reason || '값 없음'
            });
        }
        return { masterEmail, masterEnd, rows: g.rows, firstLine: g.firstLine };
    });

    groups.sort((a, b) => {
        // 대표계정 이메일 오름차순. 이메일이 그룹핑 키라서 중복이 없고, 종료일과 달리
        // 시간이 지나도 값이 바뀌지 않으므로 재실행해도 같은 번호가 나온다.
        // (firstLine tie-break 는 만일 같은 이메일이 두 그룹으로 갈리는 경우의 안전장치)
        if (a.masterEmail !== b.masterEmail) return a.masterEmail.localeCompare(b.masterEmail);
        return a.firstLine - b.firstLine;
    });

    const width = Math.max(2, String(groups.length).length);
    const numbered = groups.map((g, idx) => ({
        ...g,
        loginId: `${GROUP_PREFIX}${String(idx + 1).padStart(width, '0')}`
    }));

    console.log(`그룹 ${numbered.length}개 → ${numbered[0]?.loginId} ~ ${numbered[numbered.length - 1]?.loginId}`);

    // --- 4. 슬롯 레코드 만들기 -------------------------------------------
    interface SlotRecord {
        slot_number: number;
        qobuz_id: string | null;
        screen_name: string | null;
        buyer_name: string | null;
        buyer_phone: string | null;
        buyer_email: string | null;
        start_date: string | null;
        end_date: string | null;
        period_months: number | null;
        amount: number;
        memo: null;
    }

    const prepared = numbered.map(g => {
        const slots: SlotRecord[] = g.rows.map((r, slotIdx) => {
            const slotLabel = `${g.loginId}-${slotIdx + 1}`;
            const report = (field: string, rawValue: string, issue: string) =>
                issues.push({ csvLine: r.csvLine, group: g.loginId, slot: slotLabel, field, rawValue, issue });

            // --- 종료일 (J) ---
            const endParsed = parseSheetDate(r.endRaw);
            if (!endParsed.date && r.endRaw) report('구독 종료일(J)', r.endRaw, endParsed.reason || '해석 실패');

            // --- 기간 (K) ---
            const periodParsed = parsePeriodMonths(r.periodRaw);
            if (!periodParsed.months && r.periodRaw) report('구독 기간(K)', r.periodRaw, periodParsed.reason || '해석 실패');

            // --- 시작일 (I) ---
            // "4/9" 처럼 연도가 없는 값은 종료일 - 기간*30일 로 역산해 본다.
            let startDate = parseSheetDate(r.startRaw).date;
            if (!startDate && r.startRaw) {
                const reason = parseSheetDate(r.startRaw).reason || '해석 실패';
                if (endParsed.date && periodParsed.months) {
                    startDate = addDaysIso(endParsed.date, -periodParsed.months * 30);
                    report('구독 개시(I)', r.startRaw, `${reason} → 종료일-${periodParsed.months}개월로 역산(${startDate}). 확인 필요`);
                } else {
                    report('구독 개시(I)', r.startRaw, `${reason} — 역산 불가로 비움`);
                }
            }

            // --- 이름 / SCREEN NAME (H, E) ---
            // 텍스트 칸에도 수식 에러값(#VALUE! 등)이 그대로 남아 있다. 날짜/기간과 같게 null 로 버린다.
            if (r.name && isBlank(r.name)) report('이름(H)', r.name, `수식 에러(${r.name}) — 비움`);
            if (r.screenName && isBlank(r.screenName)) report('SCREEN NAME(E)', r.screenName, `수식 에러(${r.screenName}) — 비움`);
            // H가 비고 E에 한글 이름이 들어간 행이 실재한다 (예: 주재은).
            let buyerName: string | null = isBlank(r.name) ? null : r.name;
            let screenName: string | null = isBlank(r.screenName) ? null : r.screenName;
            if (!buyerName && screenName && HANGUL_ONLY.test(screenName)) {
                buyerName = screenName;
                screenName = null;
                report('이름(H)/SCREEN NAME(E)', r.screenName, `이름 칸이 비고 E열이 한글이라 이름으로 옮김`);
            }
            // E열에 생년월일이 섞인 경우("Hong Seonggon. 1971/01/10")는 자동 분리하지 않는다 (오탐 위험)
            if (screenName && /\d{2}[./-]\d{1,2}[./-]\d{1,2}/.test(screenName)) {
                report('SCREEN NAME(E)', screenName, '생년월일이 섞여 있음 — 원문 유지, 확인 필요');
            }

            // --- 전화번호 (F) / 이메일 (G) ---
            const phoneParsed = normalizePhone(r.tel);
            if (phoneParsed.reason) report('TEL(F)', r.tel, phoneParsed.reason);
            const emailParsed = normalizeEmail(r.email);
            if (emailParsed.reason) report('이메일(G)', r.email, emailParsed.reason);

            // --- ID (D) ---
            // 수식 에러가 그대로 들어가면 활성 부분 유니크 인덱스까지 점유한다. 반드시 비운다.
            const qobuzId = isBlank(r.qobuzId) ? null : r.qobuzId.toLowerCase();
            if (!qobuzId) report('ID(D)', r.qobuzId, r.qobuzId ? `수식 에러(${r.qobuzId}) — 비움` : 'Qobuz ID 없음');

            return {
                slot_number: slotIdx,
                qobuz_id: qobuzId,
                screen_name: screenName,
                buyer_name: buyerName,
                buyer_phone: phoneParsed.phone,
                buyer_email: emailParsed.email,
                start_date: startDate,
                end_date: endParsed.date,
                period_months: periodParsed.months,
                amount: FIXED_AMOUNT,
                memo: null,
            };
        });

        // 시트에 5행을 넘는 그룹이 있으면 정원을 늘려 준다 (화면에 "초과"로 뜨는 것을 막음)
        const maxSlots = Math.max(DEFAULT_MAX_SLOTS, slots.length);
        if (slots.length > DEFAULT_MAX_SLOTS) {
            issues.push({
                csvLine: g.firstLine, group: g.loginId, slot: '',
                field: '슬롯 수', rawValue: String(slots.length),
                issue: `하부계정이 ${slots.length}개 — 정원을 ${maxSlots}로 설정함. 확인 필요`
            });
        }

        return { ...g, slots, maxSlots };
    });

    // 중복 Qobuz ID 검사 — 활성 행에 부분 유니크 인덱스가 걸려 있어 INSERT 가 실패한다
    const idSeen = new Map<string, string>();
    for (const g of prepared) {
        for (const s of g.slots) {
            if (!s.qobuz_id) continue;
            const prev = idSeen.get(s.qobuz_id);
            if (prev) {
                issues.push({
                    csvLine: 0, group: g.loginId, slot: `${g.loginId}-${s.slot_number + 1}`,
                    field: 'ID(D)', rawValue: s.qobuz_id,
                    issue: `${prev} 와 중복 — 유니크 제약에 걸려 INSERT 실패함. 시트에서 먼저 정리 필요`
                });
            } else {
                idSeen.set(s.qobuz_id, `${g.loginId}-${s.slot_number + 1}`);
            }
        }
    }

    const totalSlots = prepared.reduce((n, g) => n + g.slots.length, 0);

    // --- 5. 리뷰 리포트 --------------------------------------------------
    const reportPath = path.resolve(process.cwd(), 'import_qobuz_review.csv');
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const reportCsv = [
        'CSV행,그룹,슬롯,항목,원본값,문제',
        ...issues.map(i => [i.csvLine || '', i.group, i.slot, i.field, i.rawValue, i.issue].map(esc).join(','))
    ].join('\n');
    fs.writeFileSync(reportPath, '﻿' + reportCsv, 'utf-8');

    console.log('');
    console.log('─'.repeat(60));
    console.log(`그룹      : ${prepared.length}개`);
    console.log(`하부계정  : ${totalSlots}건`);
    console.log(`계약금액  : 전 행 ${FIXED_AMOUNT.toLocaleString()}원 고정`);
    console.log(`리뷰 필요 : ${issues.length}건 → ${reportPath}`);
    console.log('─'.repeat(60));
    console.log('');
    console.log('그룹 번호 배정 (앞 5개):');
    prepared.slice(0, 5).forEach(g => {
        console.log(`  ${g.loginId}  ${g.masterEnd || '(종료일 없음)'}  ${g.masterEmail}  슬롯 ${g.slots.length}개`);
    });

    if (dryRun) {
        console.log('');
        console.log('--dry-run 이므로 DB 에는 아무것도 쓰지 않았습니다.');
        return;
    }

    // --- 6. DB INSERT ----------------------------------------------------
    const env = { ...loadEnvLocal(), ...process.env };
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
        console.error('');
        console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 .env.local 에서 찾지 못했습니다.');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('');
    console.log('DB 입력 시작...');

    let okGroups = 0;
    let okSlots = 0;
    const failures: string[] = [];

    for (const g of prepared) {
        const { data: account, error: accErr } = await supabase
            .from('qobuz_accounts')
            .insert([{
                login_id: g.loginId,
                master_email: g.masterEmail,
                master_end_date: g.masterEnd,
                max_slots: g.maxSlots,
                used_slots: 0,
                status: 'available'
            }])
            .select('id')
            .single();

        if (accErr || !account) {
            // login_id 유니크 제약에 걸리면 이미 임포트된 것이다 (중복 실행 방지)
            failures.push(`[${g.loginId}] 그룹 생성 실패: ${accErr?.message}`);
            continue;
        }
        okGroups++;

        const payload = g.slots.map(s => ({ account_id: account.id, ...s }));
        const { error: slotErr } = await supabase.from('qobuz_assignments').insert(payload);

        if (slotErr) {
            failures.push(`[${g.loginId}] 슬롯 ${payload.length}건 입력 실패: ${slotErr.message}`);
            continue;
        }
        okSlots += payload.length;

        // used_slots 동기화 (활성 + 미삭제 건수)
        const { error: syncErr } = await supabase
            .from('qobuz_accounts')
            .update({ used_slots: payload.length })
            .eq('id', account.id);
        if (syncErr) failures.push(`[${g.loginId}] used_slots 동기화 실패: ${syncErr.message}`);
    }

    console.log('');
    console.log('─'.repeat(60));
    console.log(`그룹     : ${okGroups}/${prepared.length} 생성`);
    console.log(`하부계정 : ${okSlots}/${totalSlots} 생성`);
    if (failures.length > 0) {
        console.log('');
        console.log(`실패 ${failures.length}건:`);
        failures.forEach(f => console.log(`  - ${f}`));
        console.log('');
        console.log('재임포트가 필요하면 아래를 실행한 뒤 다시 돌리세요 (QG 번호는 동일하게 재현됩니다):');
        console.log('  DELETE FROM qobuz_assignments; DELETE FROM qobuz_accounts;');
    }
    console.log('─'.repeat(60));
    console.log(`리뷰 리포트: ${reportPath}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
