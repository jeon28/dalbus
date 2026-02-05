"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
    updatePrice: (id: string, newPrice: string) => void;
    isHydrated: boolean;
    user: User | null;
    login: (id: string, name: string, email: string) => void;
    logout: () => void;
}

const INITIAL_SERVICES: Service[] = [
    { id: 'tidal', name: 'TIDAL HI-FI', icon: 'tidal', price: '4,900', color: '#000000', tag: 'PREMIUM' },
];

const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

export function ServiceProvider({ children }: { children: ReactNode }) {
    const [services, setServices] = useState<Service[]>(INITIAL_SERVICES);
    const [user, setUser] = useState<User | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const savedUser = localStorage.getItem('dalbus-user');
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (e) {
                console.error('Failed to parse saved user', e);
            }
        }

        setIsHydrated(true);
    }, []);

    // Save user to localStorage whenever it changes
    useEffect(() => {
        if (isHydrated) {
            if (user) {
                localStorage.setItem('dalbus-user', JSON.stringify(user));
            } else {
                localStorage.removeItem('dalbus-user');
            }
        }
    }, [user, isHydrated]);

    const updatePrice = (id: string, newPrice: string) => {
        setServices(prev => prev.map(s => s.id === id ? { ...s, price: newPrice } : s));
    };

    const login = (id: string, name: string, email: string) => {
        setUser({ id, name, email });
    };

    const logout = () => {
        setUser(null);
    };

    return (
        <ServiceContext.Provider value={{ services, updatePrice, isHydrated, user, login, logout }}>
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
