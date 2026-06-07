import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import PosPage from './pages/PosPage';
import ProductsPage from './pages/ProductsPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import RestockPage from './pages/RestockPage';
import ReportPage from './pages/ReportPage';
import { dbService } from './services/DatabaseService';
import { syncService } from './services/SyncService';
import { AuthProvider, useAuth } from './components/AuthContext';
import SplashScreen from './components/SplashScreen';
import ShiftManager from './components/ShiftManager';
import { ThemeProvider } from './components/ThemeContext';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'superuser') return <Navigate to="/" replace />;
  return children;
};

import AdminReportPage from './pages/AdminReportPage';
import ActivationPage from './pages/ActivationPage';
import { licenseService } from './services/LicenseService';

function AppContent() {
  const [ready, setReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isActivated, setIsActivated] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const init = async () => {
      await dbService.init();
      const activated = await licenseService.isActivated();
      if (activated) {
        await syncService.init();
      }
      setIsActivated(activated);
      setReady(true);
    };
    init();
  }, []);

  if (showSplash || !ready) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (!isActivated) {
    return <ActivationPage onSuccess={() => setIsActivated(true)} />;
  }

  return (
    <ShiftManager>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/login" element={user ? (user.role === 'superuser' ? <Navigate to="/dashboard" /> : <Navigate to="/" />) : <LoginPage />} />

            <Route path="/dashboard" element={
              <AdminRoute><DashboardPage /></AdminRoute>
            } />
            <Route path="/" element={
              <ProtectedRoute><PosPage /></ProtectedRoute>
            } />
            <Route path="/products" element={
              <AdminRoute><ProductsPage /></AdminRoute>
            } />
            <Route path="/restock" element={
              <AdminRoute><RestockPage /></AdminRoute>
            } />
            <Route path="/history" element={
              <AdminRoute><HistoryPage /></AdminRoute>
            } />
            <Route path="/reports" element={
              <AdminRoute><ReportPage /></AdminRoute>
            } />
            <Route path="/admin-reports" element={
              <AdminRoute><AdminReportPage /></AdminRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute><SettingsPage /></ProtectedRoute>
            } />
          </Routes>
        </div>
        {user && <Navbar />}
      </div>
    </ShiftManager>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
