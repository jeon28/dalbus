export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          id: string
          login_id: string
          login_pw: string
          max_slots: number
          memo: string | null
          product_id: string
          status: 'available' | 'assigned' | 'disabled'
          used_slots: number
          payment_day: number
        }
        Insert: {
          created_at?: string
          id?: string
          login_id: string
          login_pw: string
          max_slots?: number
          memo?: string | null
          product_id: string
          status?: 'available' | 'assigned' | 'disabled'
          used_slots?: number
          payment_day?: number
        }
        Update: {
          created_at?: string
          id?: string
          login_id?: string
          login_pw?: string
          max_slots?: number
          memo?: string | null
          product_id?: string
          status?: 'available' | 'assigned' | 'disabled'
          used_slots?: number
          payment_day?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounts_product_id_fkey"
            columns: ["product_id"]
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      faqs: {
        Row: {
          answer: string
          category: 'general' | 'payment' | 'account' | 'refund'
          created_at: string
          id: string
          is_published: boolean
          question: string
          sort_order: number
        }
        Insert: {
          answer: string
          category?: 'general' | 'payment' | 'account' | 'refund'
          created_at?: string
          id?: string
          is_published?: boolean
          question: string
          sort_order?: number
        }
        Update: {
          answer?: string
          category?: 'general' | 'payment' | 'account' | 'refund'
          created_at?: string
          id?: string
          is_published?: boolean
          question?: string
          sort_order?: number
        }
        Relationships: []
      }
      notices: {
        Row: {
          category: 'service' | 'update' | 'event' | 'maintenance'
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          is_published: boolean
          title: string
        }
        Insert: {
          category?: 'service' | 'update' | 'event' | 'maintenance'
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          title: string
        }
        Update: {
          category?: 'service' | 'update' | 'event' | 'maintenance'
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          title?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          channel: 'sms' | 'alimtalk'
          id: string
          message: string | null
          order_id: string | null
          sent_at: string | null
          status: 'pending' | 'sent' | 'failed'
          type: 'assignment' | 'expiry_d7' | 'expiry_d1' | 'replacement' | 'delay'
          user_id: string | null
        }
        Insert: {
          channel?: 'sms' | 'alimtalk'
          id?: string
          message?: string | null
          order_id?: string | null
          sent_at?: string | null
          status?: 'pending' | 'sent' | 'failed'
          type: 'assignment' | 'expiry_d7' | 'expiry_d1' | 'replacement' | 'delay'
          user_id?: string | null
        }
        Update: {
          channel?: 'sms' | 'alimtalk'
          id?: string
          message?: string | null
          order_id?: string | null
          sent_at?: string | null
          status?: 'pending' | 'sent' | 'failed'
          type?: 'assignment' | 'expiry_d7' | 'expiry_d1' | 'replacement' | 'delay'
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_order_id_fkey"
            columns: ["order_id"]
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      order_accounts: {
        Row: {
          id: string
          order_id: string
          slot_number: number
          slot_password: string | null
          tidal_id: string | null
        }
        Insert: {
          account_id: string
          assigned_at?: string
          id?: string
          order_id: string
          slot_number?: number
          slot_password?: string | null
          tidal_id?: string | null
        }
        Update: {
          account_id?: string
          assigned_at?: string
          id?: string
          order_id?: string
          slot_number?: number
          slot_password?: string | null
          tidal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_accounts_account_id_fkey"
            columns: ["account_id"]
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_accounts_order_id_fkey"
            columns: ["order_id"]
            referencedRelation: "orders"
            referencedColumns: ["id"]
          }
        ]
      }
      orders: {
        Row: {
          amount: number
          assigned_at: string | null
          assignment_status: 'waiting' | 'assigned' | 'expired' | 'replaced'
          created_at: string
          end_date: string | null
          id: string
          order_number: string
          paid_at: string | null
          payment_status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'
          plan_id: string
          portone_payment_id: string | null
          product_id: string
          start_date: string | null
          user_id: string
        }
        Insert: {
          amount: number
          assigned_at?: string | null
          assignment_status?: 'waiting' | 'assigned' | 'expired' | 'replaced'
          created_at?: string
          end_date?: string | null
          id?: string
          order_number?: string
          paid_at?: string | null
          payment_status?: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'
          plan_id: string
          portone_payment_id?: string | null
          product_id: string
          start_date?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          assigned_at?: string | null
          assignment_status?: 'waiting' | 'assigned' | 'expired' | 'replaced'
          created_at?: string
          end_date?: string | null
          id?: string
          order_number?: string
          paid_at?: string | null
          payment_status?: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'
          plan_id?: string
          portone_payment_id?: string | null
          product_id?: string
          start_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_plan_id_fkey"
            columns: ["plan_id"]
            referencedRelation: "product_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      product_plans: {
        Row: {
          created_at: string
          discount_rate: number | null
          duration_months: number
          id: string
          is_active: boolean
          price: number
          product_id: string
        }
        Insert: {
          created_at?: string
          discount_rate?: number | null
          duration_months: number
          id?: string
          is_active?: boolean
          price: number
          product_id: string
        }
        Update: {
          created_at?: string
          discount_rate?: number | null
          duration_months?: number
          id?: string
          is_active?: boolean
          price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_plans_product_id_fkey"
            columns: ["product_id"]
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      products: {
        Row: {
          benefits: string[] | null
          cautions: string[] | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          original_price: number
          slug: string
          sort_order: number
          tags: string[] | null
        }
        Insert: {
          benefits?: string[] | null
          cautions?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          original_price: number
          slug: string
          sort_order?: number
          tags?: string[] | null
        }
        Update: {
          benefits?: string[] | null
          cautions?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          original_price?: number
          slug?: string
          sort_order?: number
          tags?: string[] | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          role: 'user' | 'admin'
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          phone?: string | null
          role?: 'user' | 'admin'
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          role?: 'user' | 'admin'
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      account_status: 'available' | 'assigned' | 'disabled'
      assignment_status: 'waiting' | 'assigned' | 'expired' | 'replaced'
      faq_category: 'general' | 'payment' | 'account' | 'refund'
      notice_category: 'service' | 'update' | 'event' | 'maintenance'
      notification_channel: 'sms' | 'alimtalk'
      notification_status: 'pending' | 'sent' | 'failed'
      notification_type: 'assignment' | 'expiry_d7' | 'expiry_d1' | 'replacement' | 'delay'
      payment_status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'
      user_role: 'user' | 'admin'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
