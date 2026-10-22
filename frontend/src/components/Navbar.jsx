import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Code, Home, User, LogOut } from 'lucide-react';
import { isAuthenticated, removeToken, removeUser } from '../utils/auth';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const authenticated = isAuthenticated();

  const handleLogout = () => {
    removeToken();
    removeUser();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Ana Sayfa', icon: Home },
    { path: '/setup', label: 'Simülasyon', icon: Code },
    { path: '/profile', label: 'Profil', icon: User },
  ];

  return (
    <nav className="bg-white shadow-sm border-b safe-top">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Code className="w-5 h-5 text-white" />
            </div>
            <span className="hidden sm:inline font-bold text-xl text-blue-600">InterviewAI</span>
          </Link>

          <div className="flex gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-label={item.label}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {authenticated ? (
              <button
                onClick={handleLogout}
                aria-label="Çıkış"
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">Çıkış</span>
              </button>
            ) : (
              <div className="flex gap-2">
                <Link to="/login" className="btn-secondary text-sm">
                  Giriş
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                  Kayıt
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;