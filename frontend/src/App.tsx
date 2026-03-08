import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Login } from './pages/Login/Login';
import { ForgotPassword } from './pages/ForgotPassword/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword/ResetPassword';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { Discover } from './pages/Discover/Discover';
import { MusicRoom } from './pages/MusicRoom/MusicRoom';

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const isAuth = useAuthStore(state => state.isAuthenticated());
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col items-center bg-term-bg text-term-text font-mono">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/room/:id" element={<AuthGuard><MusicRoom /></AuthGuard>} />
          <Route path="*" element={<div className="p-8 text-term-error">[ERROR] Route not found.</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
