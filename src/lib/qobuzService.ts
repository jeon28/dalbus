import { supabaseAdmin } from './supabaseAdmin';
import { Database } from '@/types/database';

/**
 * Qobuz 계정 관리 서비스.
 *
 * qobuz_accounts(대표계정 = 그룹) 1 : N qobuz_assignments(하부계정 = 슬롯).
 * Tidal 계열과 달리 대표계정은 슬롯을 차지하지 않으므로 마스터 슬롯 개념이 없다.
 */
export const qobuzService = {
  async getAllAccounts(options: { showInactive?: boolean; showDeleted?: boolean } = {}) {
    const { showInactive, showDeleted } = options;

    let query = supabaseAdmin
      .from('qobuz_accounts')
      .select(`
        *,
        qobuz_assignments(*)
      `)
      .order('login_id', { ascending: true });

    if (showDeleted) {
      query = query.eq('status', 'deleted');
    } else {
      query = query.neq('status', 'disabled').neq('status', 'deleted');
    }

    const { data, error } = await query;
    if (error) throw error;

    return data.map(account => {
      type AssignmentRow = {
        id: string;
        is_active?: boolean | null;
        is_deleted?: boolean | null;
        slot_number?: number | null;
        [key: string]: unknown;
      };
      const assignments = (account.qobuz_assignments || []) as AssignmentRow[];
      const filteredAssignments = assignments
        .filter((a) => {
          if (showDeleted) return a.is_deleted === true;
          if (showInactive) return a.is_deleted !== true;
          return a.is_active !== false && a.is_deleted !== true;
        })
        .sort((a, b) => (a.slot_number || 0) - (b.slot_number || 0));

      return {
        ...account,
        assignments: filteredAssignments,
        // 보기 모드(showDeleted/showInactive)와 무관하게 실제 active 배정 수를 반영
        used_slots: assignments.filter(
          (a) => a.is_active !== false && a.is_deleted !== true
        ).length
      };
    });
  },

  async createAccount(data: Database['public']['Tables']['qobuz_accounts']['Insert']) {
    const { data: result, error } = await supabaseAdmin
      .from('qobuz_accounts')
      .insert([data])
      .select()
      .single();
    if (error) throw error;
    return result;
  },

  async updateAccount(id: string, data: Database['public']['Tables']['qobuz_accounts']['Update']) {
    const { data: result, error } = await supabaseAdmin
      .from('qobuz_accounts')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result;
  }
};
