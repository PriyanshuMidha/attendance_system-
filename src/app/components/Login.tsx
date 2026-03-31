import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { BarChart3, Lock } from 'lucide-react';

export const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">Opening app…</div>
    );
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (login(username.trim(), password)) {
      navigate('/', { replace: true });
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-blue-50 rounded-full">
            <BarChart3 className="w-10 h-10 text-blue-600" />
          </div>
        </div>
        <h1 className="text-xl font-semibold text-center text-gray-900 mb-1">
          Attendance & Salary Management
        </h1>
        <p className="text-sm text-center text-gray-500 mb-8">Sign in to continue</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="current-password"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
};
