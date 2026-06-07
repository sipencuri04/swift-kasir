import React, { createContext, useContext, useState, useEffect } from 'react';
import { dbService } from '../services/DatabaseService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('kasir_user');
        if (stored) {
            setUser(JSON.parse(stored));
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        const found = await dbService.login(username, password);
        if (found) {
            setUser(found);
            localStorage.setItem('kasir_user', JSON.stringify(found));
            return true;
        }
        return false;
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('kasir_user');
    };

    if (loading) return null;

    return (
        <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === 'admin', isSuperuser: user?.role === 'superuser' }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
