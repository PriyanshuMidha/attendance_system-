import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiFetch } from '../../lib/api';

export interface Holiday {
  date: string;
  month: number;
  year: number;
}

/** Parse `<input type="date">` value (YYYY-MM-DD) so month/year are not shifted by UTC. */
export function holidayFromDateInput(isoDate: string): Holiday {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(isoDate);
  if (m) {
    return { date: isoDate, month: Number(m[2]), year: Number(m[1]) };
  }
  const d = new Date(isoDate);
  return {
    date: isoDate,
    month: d.getMonth() + 1,
    year: d.getFullYear(),
  };
}

export interface Employee {
  id: string;
  name: string;
  /** Empty string or omitted when not provided */
  phone?: string;
  salary: number;
  aadharPhoto?: string;
  dateOfJoining?: string;
  holidays: Holiday[];
}

/** PATCH body: use `aadharPhoto: null` to clear the image in MongoDB. */
export type EmployeeUpdate = Partial<Omit<Employee, 'aadharPhoto'>> & { aadharPhoto?: string | null };

interface EmployeeContextType {
  employees: Employee[];
  loading: boolean;
  error: string | null;
  refreshEmployees: () => Promise<void>;
  addEmployee: (employee: Omit<Employee, 'id' | 'holidays'> & { holidays?: Holiday[] }) => Promise<void>;
  updateEmployee: (id: string, employee: EmployeeUpdate) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  addHoliday: (id: string, holiday: Holiday) => Promise<void>;
  removeHoliday: (id: string, date: string) => Promise<void>;
  getEmployee: (id: string) => Employee | undefined;
  calculateSalary: (employee: Employee, month?: number, year?: number) => {
    baseSalary: number;
    absentDays: number;
    daysOnTime: number;
    dailyRate: number;
    deduction: number;
    finalSalary: number;
  };
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export const useEmployees = () => {
  const context = useContext(EmployeeContext);
  if (!context) {
    throw new Error('useEmployees must be used within EmployeeProvider');
  }
  return context;
};

export const EmployeeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshEmployees = useCallback(async () => {
    setError(null);
    try {
      const list = await apiFetch<Employee[]>('/employees');
      setEmployees(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load employees');
      setEmployees([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refreshEmployees();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshEmployees]);

  const addEmployee = async (
    employee: Omit<Employee, 'id' | 'holidays'> & { holidays?: Holiday[] }
  ) => {
    setError(null);
    try {
      const created = await apiFetch<Employee>('/employees', {
        method: 'POST',
        body: JSON.stringify({
          name: employee.name,
          phone: employee.phone?.trim() ?? '',
          salary: employee.salary,
          aadharPhoto: employee.aadharPhoto,
          dateOfJoining: employee.dateOfJoining,
          holidays: employee.holidays || [],
        }),
      });
      setEmployees((prev) => [...prev, created]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add employee';
      setError(msg);
      throw e;
    }
  };

  const updateEmployee = async (id: string, updates: EmployeeUpdate) => {
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.salary !== undefined) payload.salary = updates.salary;
      if (updates.dateOfJoining !== undefined) payload.dateOfJoining = updates.dateOfJoining;
      if (updates.aadharPhoto === null) payload.aadharPhoto = null;
      else if (updates.aadharPhoto !== undefined) payload.aadharPhoto = updates.aadharPhoto;

      const updated = await apiFetch<Employee>(`/employees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setEmployees((prev) => prev.map((emp) => (emp.id === id ? updated : emp)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update employee';
      setError(msg);
      throw e;
    }
  };

  const deleteEmployee = async (id: string) => {
    setError(null);
    try {
      await apiFetch(`/employees/${id}`, { method: 'DELETE' });
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete employee';
      setError(msg);
      throw e;
    }
  };

  const addHoliday = async (id: string, holiday: Holiday) => {
    setError(null);
    try {
      const updated = await apiFetch<Employee>(`/employees/${id}/holidays`, {
        method: 'POST',
        body: JSON.stringify(holiday),
      });
      setEmployees((prev) => prev.map((emp) => (emp.id === id ? updated : emp)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add holiday';
      setError(msg);
      throw e;
    }
  };

  const removeHoliday = async (id: string, date: string) => {
    setError(null);
    try {
      const enc = encodeURIComponent(date);
      const updated = await apiFetch<Employee>(`/employees/${id}/holidays/${enc}`, {
        method: 'DELETE',
      });
      setEmployees((prev) => prev.map((emp) => (emp.id === id ? updated : emp)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to remove holiday';
      setError(msg);
      throw e;
    }
  };

  const getEmployee = (id: string) => employees.find((emp) => emp.id === id);

  const calculateSalary = (employee: Employee, month?: number, year?: number) => {
    const currentDate = new Date();
    const targetMonth = month ?? currentDate.getMonth() + 1;
    const targetYear = year ?? currentDate.getFullYear();

    const monthHolidays = employee.holidays.filter(
      (h) => h.month === targetMonth && h.year === targetYear
    );

    const absentDays = monthHolidays.length;
    const dailyRate = employee.salary / 30;

    let deduction = 0;
    if (absentDays > 0) {
      const firstTwoDays = Math.min(absentDays, 2);
      const remainingDays = Math.max(0, absentDays - 2);

      deduction = firstTwoDays * dailyRate * 0.5 + remainingDays * dailyRate;
    }

    const daysOnTime = 30 - absentDays;
    const finalSalary = employee.salary - deduction;

    return {
      baseSalary: employee.salary,
      absentDays,
      daysOnTime,
      dailyRate: parseFloat(dailyRate.toFixed(2)),
      deduction: parseFloat(deduction.toFixed(2)),
      finalSalary: parseFloat(finalSalary.toFixed(2)),
    };
  };

  return (
    <EmployeeContext.Provider
      value={{
        employees,
        loading,
        error,
        refreshEmployees,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        addHoliday,
        removeHoliday,
        getEmployee,
        calculateSalary,
      }}
    >
      {children}
    </EmployeeContext.Provider>
  );
};
