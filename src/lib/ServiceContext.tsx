"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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
    phone?: string;
    role?: string;
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

interface ProductResponse {
    id: string;
    name: string;
    image_url: string | null;
    original_price: number;
    description: string | null;
    tags: string[] | null;
}

export function ServiceProvider({ children }: { children: ReactNode }) {
    const [services, setServices] = useState<Service[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);

    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Fetch services (products) via XHR to bypass Next.js 15 fetch/abort issues
    const fetchServices = useCallback(async () => {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', '/api/public/products', true);

            xhr.onload = function () {
                if (!isMounted.current) return;
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const productsData = JSON.parse(xhr.responseText) as ProductResponse[];
                        if (productsData) {
                            const mappedServices: Service[] = productsData.map((p) => ({
                                id: p.id,
                                name: p.name,
                                icon: p.image_url || 'default',
                                price: p.original_price.toLocaleString(),
                                description: p.description || '',
                                tag: (p.tags && p.tags.length > 0) ? p.tags[0] : '',
                                color: 'default'
                            }));
                            setServices(mappedServices);
                        }
                    } catch (e) {
                        console.error('ServiceContext: JSON Parse error', e);
                    }
                }
            };

            xhr.onerror = function () {
                // Network error, ignore or log silently
            };

            xhr.send();
        } catch {
            // Ignore any sync errors
        }
    }, []);

    useEffect(() => {
        // 초기 session 확인 및 설정
        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!isMounted.current) return;

                if (session?.user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('name, email, phone, role')
                        .eq('id', session.user.id)
                        .single();

                    if (!isMounted.current) return;

                    const userObj: User = {
                        id: session.user.id,
                        name: profile?.name || session.user.user_metadata.name || session.user.email?.split('@')[0] || 'User',
                        email: profile?.email || session.user.email || '',
                        phone: profile?.phone || '',
                        role: profile?.role
                    };
                    setUser(userObj);
                    localStorage.setItem('dalbus-user', JSON.stringify(userObj));
                    setIsAdmin(false);
                } else {
                    setUser(null);
                    setIsAdmin(false);
                    localStorage.removeItem('dalbus-user');
                }
            } catch (error) {
                const err = error as Error;
                if (err.name !== 'AbortError' && !err.message?.includes('aborted')) {
                    console.error('Failed to initialize auth:', error);
                }
                setUser(null);
                setIsAdmin(false);
                localStorage.removeItem('dalbus-user');
            } finally {
                if (isMounted.current) setIsHydrated(true);
            }
        };

        const init = async () => {
            if (!isMounted.current) return;
            await fetchServices();
            if (!isMounted.current) return;
            await initializeAuth();
        };

        void init();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted.current) return;
            try {
                if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setIsAdmin(false);
                    localStorage.removeItem('dalbus-user');
                } else if (session?.user) {
                    const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('name, email, phone, role')
                        .eq('id', session.user.id)
                        .single();

                    if (!isMounted.current) return;

                    if (profileError) {
                        if (profileError.message?.includes('AbortError') || profileError.code === 'PGRST301') {
                            return;
                        }
                        console.error('Profile fetch error during auth change:', profileError);
                    }

                    const userObj: User = {
                        id: session.user.id,
                        name: profile?.name || session.user.user_metadata.name || session.user.email?.split('@')[0] || 'User',
                        email: profile?.email || session.user.email || '',
                        phone: profile?.phone || '',
                        role: profile?.role
                    };
                    setUser(userObj);
                    localStorage.setItem('dalbus-user', JSON.stringify(userObj));
                    setIsAdmin(false);
                } else {
                    setUser(null);
                    setIsAdmin(false);
                    localStorage.removeItem('dalbus-user');
                }
            } catch (error) {
                const err = error as { name?: string; message?: string };
                if (err?.name !== 'AbortError' && !err?.message?.includes('aborted')) {
                    console.error('Unexpected error in onAuthStateChange:', error);
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchServices]);

    const updatePrice = async (id: string, newPrice: string) => {
        const numericPrice = parseInt(newPrice.replace(/,/g, ''));
        try {
            const { error } = await supabase
                .from('products')
                .update({ original_price: numericPrice })
                .eq('id', id);

            if (error) throw error;
            await fetchServices();
        } catch (error) {
            console.error('Error updating price:', error);
            throw error;
        }
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
        window.location.replace('/public');
    };

    const loginAdmin = () => setIsAdmin(true);
    const logoutAdmin = () => setIsAdmin(false);

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
