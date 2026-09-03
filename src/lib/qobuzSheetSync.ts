import { after } from 'next/server';
import { JWT } from 'google-auth-library';
import { supabaseAdmin } from './supabaseAdmin';

/**
 * QOBUZ DB → 구글 시트 단방향 미러링.
 *
 * 원장은 DB다. 시트는 보기 전용 사본이며, 시트에서 고친 값은 다음 동기화 때 덮어써진다.
 * (양방향은 의도적으로 만들지 않았다. 시트에는 행 식별자도 변경 시각도 없어서 충돌을
 *  판정할 근거가 없고, 슬롯 번호 고정 정책·used_slots 동기화·활성 부분 유니크 인덱스가
 *  전부 서버 로직에 걸려 있어 시트 편집이 그 규칙을 우회한다.)
 *
 * 행 단위 부분 업데이트는 하지 않는다. 매번 탭 전체를 지우고 다시 쓴다.
 * 행 매칭 로직이 없어야 깨질 여지가 없고, 몇 번을 돌려도 결과가 같다.
 *
 * 원본 QOBUZ 탭은 절대 건드리지 않는다. 전용 탭에만 쓴다.
 */

/** 미러링 대상 탭 이름. 원본 QOBUZ 탭과 반드시 달라야 한다. */
const SHEET_TAB = process.env.QOBUZ_SHEET_TAB || 'QOBUZ_백업';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

/**
 * 시트 열 구성. 원본 QOBUZ 탭의 A~K 순서를 그대로 따라가고 뒤에 운영용 열을 덧붙인다.
 * 시트를 보던 사람이 열 위치를 새로 익히지 않아도 되게 하려는 것이다.
 */
const HEADERS = [
    '그룹',            // A
    '대표계정',        // B
    '대표계정 종료일', // C
    'ID',              // D
    'SCREEN NAME',     // E
    'TEL',             // F
    '이메일',          // G
    '이름',            // H
    '구독 개시',       // I
    '구독 종료일',     // J
    '구독 기간',       // K
    '계약금액',
    '슬롯',
    '상태',
    '주문번호',
    '메모',
    '최종수정',
];

interface SyncResult {
    ok: boolean;
    rows?: number;
    skipped?: string;
    error?: string;
}

/** 서비스 계정 자격증명. 하나라도 없으면 동기화를 건너뛴다(설정 전에도 앱은 정상 동작). */
function getCredentials(): { email: string; key: string; sheetId: string } | null {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
    const sheetId = process.env.QOBUZ_SHEET_ID?.trim();
    // Vercel 환경변수는 개행을 리터럴 \n 으로 저장한다. 실제 개행으로 되돌린다.
    const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();

    if (!email || !key || !sheetId) return null;
    return { email, key, sheetId };
}

async function getAccessToken(email: string, key: string): Promise<string> {
    const jwt = new JWT({ email, key, scopes: [SCOPE] });
    const { access_token: token } = await jwt.authorize();
    if (!token) throw new Error('구글 액세스 토큰 발급 실패');
    return token;
}

async function sheetsFetch(
    token: string,
    path: string,
    init?: { method?: string; body?: unknown }
): Promise<unknown> {
    const res = await fetch(`${SHEETS_API}/${path}`, {
        method: init?.method || 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Sheets API ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
}

/** 대상 탭이 없으면 만든다. 있으면 그대로 쓴다. */
async function ensureTab(token: string, sheetId: string): Promise<void> {
    const meta = await sheetsFetch(token, `${sheetId}?fields=sheets.properties.title`) as {
        sheets?: { properties?: { title?: string } }[];
    };

    const exists = meta.sheets?.some(s => s.properties?.title === SHEET_TAB);
    if (exists) return;

    await sheetsFetch(token, `${sheetId}:batchUpdate`, {
        method: 'POST',
        body: { requests: [{ addSheet: { properties: { title: SHEET_TAB } } }] },
    });
}

type AssignmentRow = {
    slot_number: number | null;
    qobuz_id: string | null;
    screen_name: string | null;
    buyer_name: string | null;
    buyer_phone: string | null;
    buyer_email: string | null;
    order_number: string | null;
    start_date: string | null;
    end_date: string | null;
    period_months: number | null;
    amount: number | null;
    memo: string | null;
    is_active: boolean | null;
    is_deleted: boolean | null;
    updated_at: string | null;
};

type AccountRow = {
    login_id: string;
    master_email: string | null;
    master_end_date: string | null;
    max_slots: number;
    qobuz_assignments: AssignmentRow[] | null;
};

/** DB 스냅샷 → 시트 2차원 배열. 정렬은 관리 화면과 같다(대표계정 종료일 → 그룹 → 슬롯). */
async function buildRows(): Promise<string[][]> {
    const { data, error } = await supabaseAdmin
        .from('qobuz_accounts')
        .select(`
            login_id, master_email, master_end_date, max_slots,
            qobuz_assignments(
                slot_number, qobuz_id, screen_name, buyer_name, buyer_phone, buyer_email,
                order_number, start_date, end_date, period_months, amount, memo,
                is_active, is_deleted, updated_at
            )
        `)
        .neq('status', 'deleted');

    if (error) throw error;

    const accounts = (data || []) as unknown as AccountRow[];

    accounts.sort((a, b) => {
        const ea = a.master_end_date || '9999-12-31';
        const eb = b.master_end_date || '9999-12-31';
        if (ea !== eb) return ea.localeCompare(eb);
        return a.login_id.localeCompare(b.login_id);
    });

    const rows: string[][] = [HEADERS];

    for (const acc of accounts) {
        // 삭제 행은 제외한다. 앱의 "삭제 내역" 화면에서 복구할 수 있고, 시트에 섞이면 읽기 어렵다.
        const slots = (acc.qobuz_assignments || [])
            .filter(a => a.is_deleted !== true)
            .sort((a, b) => (a.slot_number || 0) - (b.slot_number || 0));

        for (const s of slots) {
            rows.push([
                `${acc.login_id}-${(s.slot_number || 0) + 1}`,
                acc.master_email || '',
                acc.master_end_date || '',
                s.qobuz_id || '',
                s.screen_name || '',
                s.buyer_phone || '',
                s.buyer_email || '',
                s.buyer_name || '',
                s.start_date || '',
                s.end_date || '',
                s.period_months != null ? String(s.period_months) : '',
                s.amount != null ? String(s.amount) : '',
                `${(s.slot_number || 0) + 1}/${acc.max_slots}`,
                s.is_active === false ? '비활성' : '활성',
                s.order_number || '',
                s.memo || '',
                s.updated_at || '',
            ]);
        }
    }

    return rows;
}

/**
 * DB 전체를 시트에 덮어쓴다.
 *
 * 절대 throw 하지 않는다. 관리 화면의 쓰기 작업에서 호출되는데, 시트 API 장애가
 * 계정 배정을 막으면 안 된다. 실패는 결과 객체와 로그로만 알린다.
 */
export async function syncQobuzToSheet(): Promise<SyncResult> {
    const creds = getCredentials();
    if (!creds) {
        return { ok: false, skipped: '구글 시트 환경변수 미설정 — 동기화 건너뜀' };
    }

    try {
        const token = await getAccessToken(creds.email, creds.key);
        await ensureTab(token, creds.sheetId);

        const rows = await buildRows();
        const tab = encodeURIComponent(SHEET_TAB);

        // 지우고 → 다시 쓴다. 이전 스냅샷이 더 길었을 때 잔여 행이 남는 것을 막는다.
        await sheetsFetch(token, `${creds.sheetId}/values/${tab}:clear`, { method: 'POST', body: {} });
        await sheetsFetch(
            token,
            `${creds.sheetId}/values/${tab}!A1?valueInputOption=RAW`,
            { method: 'PUT', body: { values: rows } }
        );

        // 헤더 행 제외한 데이터 행 수
        return { ok: true, rows: rows.length - 1 };
    } catch (error) {
        const message = (error as Error).message;
        console.error('[qobuzSheetSync] 동기화 실패:', message);
        return { ok: false, error: message };
    }
}

/**
 * 쓰기 라우트에서 부르는 진입점. 응답을 보낸 뒤에 동기화가 돌게 한다.
 *
 * await 하지 않는 이유: 시트 API 왕복(수백 ms)이 관리자 화면 응답 시간에 그대로 붙는다.
 * 그렇다고 그냥 떼어놓으면(fire-and-forget) 서버리스 함수가 응답 직후 종료돼 동기화가
 * 중간에 끊긴다. next/server 의 after() 가 응답 후 실행을 보장해 준다.
 */
export function scheduleQobuzSheetSync(): void {
    after(async () => {
        const result = await syncQobuzToSheet();
        if (result.skipped) return; // 환경변수 미설정은 정상 상황이라 로그를 남기지 않는다
        if (result.ok) console.log(`[qobuzSheetSync] 시트 동기화 완료 (${result.rows}행)`);
    });
}
