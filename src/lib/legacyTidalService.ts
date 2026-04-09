import { supabaseAdmin } from './supabaseAdmin';
import { Database } from '@/types/database';

export const legacyTidalService = {
  async getAllAccounts(options: { showInactive?: boolean; showDeleted?: boolean } = {}) {
    const { showInactive, showDeleted } = options;
    
    const query = supabaseAdmin
      .from('legacy_tidal_accounts')
      .select(`
        *,
        legacy_tidal_assignments(
          *,
          created_at,
          updated_at
        )
      `)
      .neq('status', 'disabled')
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return data.map(account => {
        type AssignmentRow = { 
            id: string,
            is_active?: boolean | null; 
            is_deleted?: boolean | null; 
            slot_number?: number | null; 
            updated_at?: string | null;
            assigned_at?: string | null;
            [key: string]: unknown 
        };
        const assignments = (account.legacy_tidal_assignments || []) as AssignmentRow[];
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
            used_slots: filteredAssignments.filter((oa) => oa.is_active !== false && oa.is_deleted !== true).length
        };
    });
  },

  async createAccount(data: Database['public']['Tables']['legacy_tidal_accounts']['Insert']) {
    const { data: result, error } = await supabaseAdmin
      .from('legacy_tidal_accounts')
      .insert([data])
      .select()
      .single();
    if (error) throw error;
    return result;
  },

  async updateAccount(id: string, data: Database['public']['Tables']['legacy_tidal_accounts']['Update']) {
    const { data: result, error } = await supabaseAdmin
      .from('legacy_tidal_accounts')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result;
  }
};
