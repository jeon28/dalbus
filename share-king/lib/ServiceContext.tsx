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
    { id: 'tidal', name: 'Tidal', icon: '🎧', price: '4,900', color: '#000000', tag: 'Hot' },
    { id: 'netflix', name: 'Netflix', icon: '🎬', price: '4,250', color: '#E50914', tag: 'Pop' },
    { id: 'disney', name: 'Disney+', icon: '🐭', price: '3,500', color: '#006E99', tag: 'Sale' },
    { id: 'youtube', name: 'YouTube', icon: '📺', price: '3,900', color: '#FF0000', tag: 'Best' },
];

const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

export function ServiceProvider({ children }: { children: ReactNode }) {
    const [services, setServices] = useState<Service[]>(INITIAL_SERVICES);
    const [user, setUser] = useState<User | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const savedServices = localStorage.getItem('share-king-services');
        if (savedServices) {
            try {
                setServices(JSON.parse(savedServices));
            } catch (e) {
                console.error('Failed to parse saved services', e);
            }
        }

        const savedUser = localStorage.getItem('share-king-user');
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (e) {
                console.error('Failed to parse saved user', e);
            }
        }

        setIsHydrated(true);
    }, []);

    // Save to localStorage whenever state changes
    useEffect(() => {
        if (isHydrated) {
            localStorage.setItem('share-king-services', JSON.stringify(services));
            if (user) {
                localStorage.setItem('share-king-user', JSON.stringify(user));
            } else {
                localStorage.removeItem('share-king-user');
            }
        }
    }, [services, user, isHydrated]);

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
