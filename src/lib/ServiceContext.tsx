"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';

export interface Service {
    id: string;
    name: string;
    icon: string;
    price: string;
    description?: string;
    tag: string;
    color: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
}

interface ServiceContextType {
    services: Service[];
    updatePrice: (id: string, newPrice: string) => Promise<void>;
    isHydrated: boolean;
    user: User | null;
    login: (id: string, name: string, email: string) => void;
    logout: () => void;
    refreshServices: () => Promise<void>;
    isAdmin: boolean;
    loginAdmin: () => void;
    logoutAdmin: () => void;
}

const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

export function ServiceProvider({ children }: { children: ReactNode }) {
    const [services, setServices] = useState<Service[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);

    // Fetch services (products) from Supabase
    const fetchServices = async () => {
        try {
            // Fetch products and their active plans
            const { data: productsData, error: productsError } = await supabase
                .from('products')
                .select('*, product_plans(*)')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });

            if (productsError) {
                // Ignore AbortError (normal cleanup behavior)
                if (productsError.message?.includes('AbortError') || productsError.code === 'PGRST301') {
                    return;
                }
                console.error('Error fetching products:', JSON.stringify(productsError, null, 2));
                return;
            }

            if (productsData) {
                const mappedServices: Service[] = productsData.map(p => {
                    const displayPrice = p.original_price;

                    return {
                        id: p.id,
                        name: p.name,
                        icon: p.image_url || 'default',
                        price: displayPrice.toLocaleString(),
                        description: p.description || '',
                        tag: (p.tags && p.tags.length > 0) ? p.tags[0] : '',
                        color: 'default'
                    };
                });
                setServices(mappedServices);
            }
        } catch (error) {
            // Ignore AbortError (occurs during component unmount or cleanup)
            const err = error as Error;
            if (err.name === 'AbortError' || err.message?.includes('aborted')) {
                return;
            }
            console.error('Unexpected error in fetchServices:', error);
        }
    };

    useEffect(() => {
        fetchServices();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                // Fetch user profile to check admin role
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('name, email, role')
                    .eq('id', session.user.id)
                    .single();

                const userObj: User = {
                    id: session.user.id,
                    name: profile?.name || session.user.user_metadata.name || session.user.email?.split('@')[0] || 'User',
                    email: profile?.email || session.user.email || ''
                };
                setUser(userObj);
                localStorage.setItem('dalbus-user', JSON.stringify(userObj));

                // Check if user is admin
                if (profile?.role === 'admin') {
                    setIsAdmin(true);
                    localStorage.setItem('dalbus-isAdmin', 'true');
                } else {
                    setIsAdmin(false);
                    localStorage.removeItem('dalbus-isAdmin');
                }
            } else {
                setUser(null);
                setIsAdmin(false);
                localStorage.removeItem('dalbus-user');
                localStorage.removeItem('dalbus-isAdmin');
            }
        });

        // Initial check from localStorage for immediate UI feedback
        const savedUser = localStorage.getItem('dalbus-user');
        const savedIsAdmin = localStorage.getItem('dalbus-isAdmin');
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (e) {
                console.error('Failed to parse saved user', e);
            }
        }
        if (savedIsAdmin === 'true') {
            setIsAdmin(true);
        }

        setIsHydrated(true);

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const updatePrice = async (id: string, newPrice: string) => {
        // Remove commas from price string for storage
        const numericPrice = parseInt(newPrice.replace(/,/g, ''));

        const { error } = await supabase
            .from('products')
            .update({ original_price: numericPrice })
            .eq('id', id);

        if (error) {
            console.error('Error updating price:', error);
            alert('가격 업데이트에 실패했습니다.');
            return;
        }

        // Optimistic update
        setServices(prev => prev.map(s => s.id === id ? { ...s, price: newPrice } : s));
    };

    const login = (id: string, name: string, email: string) => {
        const userObj = { id, name, email };
        setUser(userObj);
        localStorage.setItem('dalbus-user', JSON.stringify(userObj));
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setIsAdmin(false);
        localStorage.removeItem('dalbus-user');
        localStorage.removeItem('dalbus-isAdmin');
        // Redirect to login page
        window.location.href = '/login';
    };

    const loginAdmin = () => {
        setIsAdmin(true);
    };

    const logoutAdmin = () => {
        setIsAdmin(false);
        localStorage.removeItem('dalbus-isAdmin');
    };

    return (
        <ServiceContext.Provider value={{
            services,
            updatePrice,
            isHydrated,
            user,
            login,
            logout,
            refreshServices: fetchServices,
            isAdmin,
            loginAdmin,
            logoutAdmin
        }}>
            {children}
        </ServiceContext.Provider>
    );
}

export function useServices() {
    const context = useContext(ServiceContext);
    if (context === undefined) {
        throw new Error('useServices must be used within a ServiceProvider');
    }
    return context;
}
