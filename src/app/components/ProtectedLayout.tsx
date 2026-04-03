import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { EmployeeProvider } from '../context/EmployeeContext';
import { ViewMonthProvider } from '../context/ViewMonthContext';
import { Layout } from './Layout';

/** Auth gate + employee data scope + main shell with nav. */
export const ProtectedLayout = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <EmployeeProvider>
      <ViewMonthProvider>
        <Layout />
      </ViewMonthProvider>
    </EmployeeProvider>
  );
};
