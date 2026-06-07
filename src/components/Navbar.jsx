import { NavLink, useLocation } from 'react-router-dom';
import { ShoppingCart, Package, History, Settings, LayoutDashboard, Truck, FileText } from 'lucide-react';
import { useAuth } from './AuthContext';

const Navbar = () => {
    const location = useLocation();
    const { isSuperuser } = useAuth();
    if (location.pathname === '/login') return null;

    return (
        <nav className="bottom-nav">
            {isSuperuser && (
                <>
                    <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                        <LayoutDashboard size={20} />
                        <span>Dashboard</span>
                    </NavLink>
                    <NavLink to="/history" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                        <History size={20} />
                        <span>Riwayat</span>
                    </NavLink>
                </>
            )}

            <div className="nav-center-wrapper">
                <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-item center-fab active' : 'nav-item center-fab')}>
                    <ShoppingCart size={24} />
                    <span>Kasir</span>
                </NavLink>
            </div>

            {isSuperuser && (
                <NavLink to="/products" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                    <Package size={20} />
                    <span>Barang</span>
                </NavLink>
            )}

            <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                <Settings size={20} />
                <span>Setelan</span>
            </NavLink>
        </nav>
    );
};

export default Navbar;
