"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

export interface Service {
    id: string;
    name: string;
    icon: string;
    price: string;
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
}

const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

export function ServiceProvider({ children }: { children: ReactNode }) {
    const [services, setServices] = useState<Service[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);

    // Fetch services from Supabase
    const fetchServices = async () => {
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching services:', JSON.stringify(error, null, 2));
            return;
        }

        if (data) {
            const mappedServices: Service[] = data.map(s => ({
                id: s.id,
                name: s.name,
                icon: s.icon || 'default',
                price: s.price.toLocaleString(),
                tag: s.tag,
                color: s.color
            }));
            setServices(mappedServices);
        }
    };

    useEffect(() => {
        fetchServices();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                // For simplicity in this demo, we'll use the user metadata or email
                const userObj: User = {
                    id: session.user.id,
                    name: session.user.user_metadata.name || session.user.email?.split('@')[0] || 'User',
                    email: session.user.email || ''
                };
                setUser(userObj);
                localStorage.setItem('dalbus-user', JSON.stringify(userObj));
            } else {
                setUser(null);
                localStorage.removeItem('dalbus-user');
            }
        });

        // Initial check from localStorage for immediate UI feedback
        const savedUser = localStorage.getItem('dalbus-user');
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (e) {
                console.error('Failed to parse saved user', e);
            }
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
            .from('services')
            .update({ price: numericPrice })
            .eq('id', id);

        if (error) {
            console.error('Error updating price:', error);
            alert('가격 업데이트에 실패했습니다.');
            return;
        }

        // Optimistic update or refetch
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
        localStorage.removeItem('dalbus-user');
    };

    return (
        <ServiceContext.Provider value={{
            services,
            updatePrice,
            isHydrated,
            user,
            login,
            logout,
            refreshServices: fetchServices
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
