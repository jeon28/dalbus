import { Database } from './database';

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Domain Types
export type Product = Tables<'products'> & {
    plans?: Tables<'product_plans'>[];
};

export type ProductPlan = Tables<'product_plans'>;
export type Order = Tables<'orders'>;
export type Profile = Tables<'profiles'>;
export type Notice = Tables<'notices'>;
export type FAQ = Tables<'faqs'>;

// Frontend specific types
export interface CartItem {
    product: Product;
    plan: ProductPlan;
}
