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
    birth_date?: string;
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
    refreshUser: () => Promise<void>;
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

    // Optimized User state update
    const safeSetUser = useCallback((newUser: User | null) => {
        setUser(prevUser => {
            if (!prevUser && !newUser) return null;
            if (prevUser && newUser && JSON.stringify(prevUser) === JSON.stringify(newUser)) {
                return prevUser; // Keep same reference
            }
            return newUser;
        });
    }, []);

    // Auth 초기화 및 세션 체크 로직을 별도 함수로 추출하여 재사용
    const fetchUserProfile = useCallback(async (userId: string) => {
        const { data: profile } = await supabase
            .from('profiles')
            .select('name, email, phone, birth_date, role')
            .eq('id', userId)
            .single();

        return profile;
    }, []);

    const initializeAuth = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!isMounted.current) return;

            if (session?.user) {
                const profile = await fetchUserProfile(session.user.id);

                if (!isMounted.current) return;

                const userObj: User = {
                    id: session.user.id,
                    name: profile?.name || session.user.user_metadata.name || session.user.email?.split('@')[0] || 'User',
                    email: profile?.email || session.user.email || '',
                    phone: profile?.phone || '',
                    birth_date: profile?.birth_date || session.user.user_metadata.birthdate || '',
                    role: profile?.role
                };
                safeSetUser(userObj);
                localStorage.setItem('dalbus-user', JSON.stringify(userObj));
                setIsAdmin(profile?.role === 'admin');
            } else {
                safeSetUser(null);
                setIsAdmin(false);
                localStorage.removeItem('dalbus-user');
            }
        } catch (error) {
            const err = error as Error;
            if (err.name !== 'AbortError' && !err.message?.includes('aborted')) {
                console.error('Failed to initialize auth:', error);
            }
            safeSetUser(null);
            setIsAdmin(false);
            localStorage.removeItem('dalbus-user');
        } finally {
            if (isMounted.current) setIsHydrated(true);
        }
    }, [fetchUserProfile, safeSetUser]);


    const refreshUserProfile = useCallback(async () => {
        if (!user?.id) return;
        const profile = await fetchUserProfile(user.id);
        if (!isMounted.current) return;

        if (profile) {
            const userObj: User = {
                ...user,
                name: profile.name || user.name,
                email: profile.email || user.email,
                phone: profile.phone || '',
                birth_date: profile.birth_date || '',
                role: profile.role
            };
            safeSetUser(userObj);
            localStorage.setItem('dalbus-user', JSON.stringify(userObj));
        }
    }, [user, fetchUserProfile, safeSetUser]);

    useEffect(() => {
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
                    safeSetUser(null);
                    setIsAdmin(false);
                    localStorage.removeItem('dalbus-user');
                } else if (session?.user) {
                    const profile = await fetchUserProfile(session.user.id);

                    if (!isMounted.current) return;

                    const userObj: User = {
                        id: session.user.id,
                        name: profile?.name || session.user.user_metadata.name || session.user.email?.split('@')[0] || 'User',
                        email: profile?.email || session.user.email || '',
                        phone: profile?.phone || '',
                        birth_date: profile?.birth_date || session.user.user_metadata.birthdate || '',
                        role: profile?.role
                    };
                    safeSetUser(userObj);
                    localStorage.setItem('dalbus-user', JSON.stringify(userObj));
                    setIsAdmin(profile?.role === 'admin');
                } else {
                    safeSetUser(null);
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
    }, [fetchServices, initializeAuth, fetchUserProfile, safeSetUser]);

    const updatePrice = useCallback(async (id: string, newPrice: string) => {
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
    }, [fetchServices]);

    const login = useCallback((id: string, name: string, email: string) => {
        const userObj = { id, name, email };
        safeSetUser(userObj);
        localStorage.setItem('dalbus-user', JSON.stringify(userObj));
    }, [safeSetUser]);

    const logout = useCallback(async () => {
        try {
            console.log('ServiceContext: Starting logout...');

            // 1. Clear local UI state immediately
            safeSetUser(null);
            setIsAdmin(false);
            localStorage.removeItem('dalbus-user');

            // 2. Clear Supabase session
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('ServiceContext: Supabase signOut error', error);
            }

            console.log('ServiceContext: Logout successful');
        } catch (error) {
            console.error('ServiceContext: Unexpected logout error', error);
        } finally {
            // 3. Final cleanup and redirect to clear any residual memory state
            window.location.href = '/public';
        }
    }, [safeSetUser]);

    const loginAdmin = useCallback(() => setIsAdmin(true), []);
    const logoutAdmin = useCallback(() => setIsAdmin(false), []);

    // Memoize the context value to avoid unnecessary re-renders of consuming components
    const contextValue = React.useMemo(() => ({
        services,
        updatePrice,
        isHydrated,
        user,
        login,
        logout,
        refreshServices: fetchServices,
        isAdmin,
        loginAdmin,
        logoutAdmin,
        refreshUser: refreshUserProfile
    }), [services, updatePrice, isHydrated, user, login, logout, isAdmin, loginAdmin, logoutAdmin, fetchServices, refreshUserProfile]);

    return (
        <ServiceContext.Provider value={contextValue}>
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
