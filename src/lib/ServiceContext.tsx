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

        // 초기 session 확인 및 설정
        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    // 실제 session이 있으면 profile 가져오기
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

                    if (profile?.role === 'admin') {
                        setIsAdmin(true);
                        localStorage.setItem('dalbus-isAdmin', 'true');
                    } else {
                        setIsAdmin(false);
                        localStorage.removeItem('dalbus-isAdmin');
                    }
                } else {
                    // session이 없으면 localStorage 정리
                    setUser(null);
                    setIsAdmin(false);
                    localStorage.removeItem('dalbus-user');
                    localStorage.removeItem('dalbus-isAdmin');
                }
            } catch (error) {
                console.error('Failed to initialize auth:', error);
                // 에러 발생 시에도 기본 상태로 설정
                setUser(null);
                setIsAdmin(false);
                localStorage.removeItem('dalbus-user');
                localStorage.removeItem('dalbus-isAdmin');
            } finally {
                // 에러 발생 여부와 관계없이 hydration 완료
                setIsHydrated(true);
            }
        };

        initializeAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                // 로그아웃 이벤트 명시적 처리
                setUser(null);
                setIsAdmin(false);
                localStorage.removeItem('dalbus-user');
                localStorage.removeItem('dalbus-isAdmin');
            } else if (session?.user) {
                // 로그인 이벤트
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

                if (profile?.role === 'admin') {
                    setIsAdmin(true);
                    localStorage.setItem('dalbus-isAdmin', 'true');
                } else {
                    setIsAdmin(false);
                    localStorage.removeItem('dalbus-isAdmin');
                }
            } else {
                // session이 없는 경우
                setUser(null);
                setIsAdmin(false);
                localStorage.removeItem('dalbus-user');
                localStorage.removeItem('dalbus-isAdmin');
            }
        });

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
        try {
            // Supabase 로그아웃
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // 상태 초기화
            setUser(null);
            setIsAdmin(false);
            localStorage.removeItem('dalbus-user');
            localStorage.removeItem('dalbus-isAdmin');

            // 로그인 페이지로 리다이렉트
            window.location.href = '/login';
        }
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
