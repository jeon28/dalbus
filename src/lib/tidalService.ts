import { supabaseAdmin } from './supabaseAdmin';
import { Database } from '@/types/database';

export const tidalService = {
  async getAllAccounts(options: { showInactive?: boolean; showDeleted?: boolean } = {}) {
    const { showInactive, showDeleted } = options;
    
    let query = supabaseAdmin
      .from('tidal_accounts')
      .select(`
        *,
        tidal_assignments(
          *,
          orders(
            id,
            order_number,
            created_at,
            amount,
            payment_status,
            assignment_status,
            user_id,
            profiles(name, phone, email, memo),
            product_plans(duration_months),
            products(name)
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (showDeleted) {
      // 삭제 데이터 보기: 계정은 disabled 제외 모두 포함, 배정만 is_deleted=true 필터
      query = query.neq('status', 'disabled');
    } else {
      query = query.neq('status', 'disabled').neq('status', 'deleted');
    }

    const { data, error } = await query;
    if (error) throw error;

    return data.map(account => {
        type AssignmentRow = { is_active?: boolean | null; is_deleted?: boolean | null; slot_number?: number | null; [key: string]: unknown };
        const assignments = (account.tidal_assignments || []) as AssignmentRow[];
        const filteredAssignments = assignments
            .filter((oa) => {
                if (showDeleted) return oa.is_deleted === true;
                if (showInactive) return oa.is_deleted !== true;
                return oa.is_active !== false && oa.is_deleted !== true;
            })
            .sort((a, b) => (a.slot_number || 0) - (b.slot_number || 0));

        return {
            ...account,
            order_accounts: filteredAssignments, // Compatibility mapping
            // 보기 모드(showDeleted/showInactive)와 무관하게 실제 active 배정 수를 반영
            used_slots: (account.tidal_assignments || []).filter(
                (oa: AssignmentRow) => oa.is_active !== false && oa.is_deleted !== true
            ).length
        };
    });
  },

  async createAccount(data: Database['public']['Tables']['tidal_accounts']['Insert']) {
    const { data: result, error } = await supabaseAdmin
      .from('tidal_accounts')
      .insert([data])
      .select()
      .single();
    if (error) throw error;
    return result;
  },

  async updateAccount(id: string, data: Database['public']['Tables']['tidal_accounts']['Update']) {
    const { data: result, error } = await supabaseAdmin
      .from('tidal_accounts')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result;
  }
};
