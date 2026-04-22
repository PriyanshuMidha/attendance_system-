import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { Users, UserPlus, FileText, BarChart3, LogOut } from 'lucide-react';
import { useEmployees } from '../context/EmployeeContext';
import { useAuth } from '../context/AuthContext';

export const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, authMode } = useAuth();
  const { error, refreshEmployees } = useEmployees();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Users },
    { path: '/add', label: 'Add Employee', icon: UserPlus },
    { path: '/reports', label: 'Reports', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl text-gray-900">Attendance & Salary Management</h1>
                <p className="text-xs text-gray-500">
                  {authMode === 'enhanced' ? 'Enhanced payroll mode' : 'Legacy payroll mode'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login', { replace: true });
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                <LogOut className="w-5 h-5" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
      {error && (
        <div className="bg-red-50 border-b border-red-200 text-red-800 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => refreshEmployees()}
              className="underline font-medium hover:text-red-950"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};
