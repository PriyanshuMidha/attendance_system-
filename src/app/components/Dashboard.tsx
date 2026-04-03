import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  useEmployees,
  consecutiveHolidaysFrom,
} from '../context/EmployeeContext';
import { useViewMonth, firstDayOfMonthIso } from '../context/ViewMonthContext';
import { Calendar, Plus, UserCircle } from 'lucide-react';
import { formatInr } from '../../lib/formatInr';

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export const Dashboard = () => {
  const { employees, loading, addHoliday, calculateSalary, patchMonthDaysOnTime } = useEmployees();
  const { month: viewMonth, year: viewYear, setViewMonthYear } = useViewMonth();
  const navigate = useNavigate();
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayDayCount, setHolidayDayCount] = useState('1');
  const [leaveHolidayNoDeduction, setLeaveHolidayNoDeduction] = useState(false);
  const [daysOnTimeDraft, setDaysOnTimeDraft] = useState('');

  const yearNow = new Date().getFullYear();
  const yearOptions = Array.from({ length: 14 }, (_, i) => yearNow + 1 - i);

  useEffect(() => {
    if (!selectedEmployee) return;
    setHolidayDate(firstDayOfMonthIso(viewYear, viewMonth));
  }, [viewMonth, viewYear, selectedEmployee]);

  const selectedEmp = selectedEmployee
    ? employees.find((e) => e.id === selectedEmployee)
    : undefined;
  const selectedLeaveKey =
    selectedEmp?.holidays
      .filter((h) => h.month === viewMonth && h.year === viewYear)
      .map((h) => `${h.date}:${h.excludeFromDeduction ? 1 : 0}`)
      .join('|') ?? '';
  const selectedDotKey =
    selectedEmp?.monthlyDaysOnTime
      ?.map((e) => `${e.month}-${e.year}-${e.daysOnTime}`)
      .sort()
      .join('|') ?? '';

  useEffect(() => {
    if (!selectedEmployee) return;
    const emp = employees.find((e) => e.id === selectedEmployee);
    if (!emp) return;
    const totalLeave = emp.holidays.filter(
      (h) => h.month === viewMonth && h.year === viewYear
    ).length;
    const computed = 30 - totalLeave;
    const o = emp.monthlyDaysOnTime?.find(
      (e) => e.month === viewMonth && e.year === viewYear
    );
    const shown =
      o != null && Number.isFinite(o.daysOnTime)
        ? Math.min(30, Math.max(0, Math.round(o.daysOnTime)))
        : computed;
    setDaysOnTimeDraft(String(shown));
  }, [selectedEmployee, employees, viewMonth, viewYear, selectedLeaveKey, selectedDotKey]);

  const handleSaveDaysOnTime = async (employeeId: string) => {
    const n = parseInt(daysOnTimeDraft, 10);
    if (Number.isNaN(n) || n < 0 || n > 30) {
      alert('Enter days on time between 0 and 30');
      return;
    }
    try {
      await patchMonthDaysOnTime(employeeId, viewMonth, viewYear, { daysOnTime: n });
    } catch {
      /* error shown in layout */
    }
  };

  const handleResetDaysOnTime = async (employeeId: string) => {
    try {
      await patchMonthDaysOnTime(employeeId, viewMonth, viewYear, { clear: true });
    } catch {
      /* error shown in layout */
    }
  };

  const handleAddHoliday = async (employeeId: string) => {
    if (!holidayDate) {
      alert('Please select a start date');
      return;
    }
    const count = Math.max(1, parseInt(holidayDayCount, 10) || 1);
    const days = consecutiveHolidaysFrom(holidayDate, count, {
      excludeFromDeduction: leaveHolidayNoDeduction,
    });
    if (days.length === 0) {
      alert('Invalid start date');
      return;
    }

    try {
      for (const h of days) {
        await addHoliday(employeeId, h);
      }
      setSelectedEmployee(null);
      setHolidayDate('');
      setHolidayDayCount('1');
      setLeaveHolidayNoDeduction(false);
    } catch {
      /* error shown in layout */
    }
  };

  const payrollLabel =
    MONTH_OPTIONS.find((m) => m.value === viewMonth)?.label ?? '';
  const headerDateLine = `${payrollLabel} ${viewYear}`;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-6">
        <div>
          <h2 className="text-2xl text-gray-900 mb-1">Employee Dashboard</h2>
          <p className="text-sm text-gray-600 mb-3">{headerDateLine}</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Payroll month</label>
              <select
                value={viewMonth}
                onChange={(e) => setViewMonthYear(Number(e.target.value), viewYear)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Year</label>
              <select
                value={viewYear}
                onChange={(e) => setViewMonthYear(viewMonth, Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 max-w-xl">
            Card totals use this month. Add leave defaults the date picker to the first day of this month.
          </p>
        </div>
        <button
          onClick={() => navigate('/add')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0"
        >
          <Plus className="w-5 h-5" />
          Add Employee
        </button>
      </div>

      {loading && employees.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-600">
          Loading employees…
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <UserCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg text-gray-900 mb-2">No employees yet</h3>
          <p className="text-gray-600 mb-4">Get started by adding your first employee</p>
          <button
            onClick={() => navigate('/add')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Employee
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((employee) => {
            const salaryData = calculateSalary(employee, viewMonth, viewYear);
            return (
              <div
                key={employee.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div
                  onClick={() => navigate(`/employee/${employee.id}`)}
                  className="cursor-pointer mb-4"
                >
                  <h3 className="text-lg text-gray-900 mb-2">{employee.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {employee.phone?.trim()
                      ? `📞 ${employee.phone}`
                      : <span className="text-gray-400">No phone on file</span>}
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Absent Days:</span>
                      <span className="text-xl text-red-600">{salaryData.absentDays}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Days On Time:</span>
                      <span className="text-xl text-green-600">{salaryData.daysOnTime}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Salary ({payrollLabel}):</span>
                      <span className="text-base text-gray-900">₹{formatInr(salaryData.finalSalary)}</span>
                    </div>
                  </div>
                </div>

                {selectedEmployee === employee.id ? (
                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                      <p className="text-xs font-medium text-gray-700">Days on time ({payrollLabel})</p>
                      <p className="text-xs text-gray-500">
                        Display only — salary still follows holidays. Calculated:{' '}
                        {30 -
                          employee.holidays.filter(
                            (h) => h.month === viewMonth && h.year === viewYear
                          ).length}
                        {employee.monthlyDaysOnTime?.some(
                          (e) => e.month === viewMonth && e.year === viewYear
                        )
                          ? ' · override saved'
                          : ''}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={daysOnTimeDraft}
                          onChange={(e) => setDaysOnTimeDraft(e.target.value)}
                          className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-green-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveDaysOnTime(employee.id)}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Save
                        </button>
                        {employee.monthlyDaysOnTime?.some(
                          (e) => e.month === viewMonth && e.year === viewYear
                        ) && (
                          <button
                            type="button"
                            onClick={() => void handleResetDaysOnTime(employee.id)}
                            className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded-lg hover:bg-white"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Start date plus number of days adds consecutive leave entries. Check &quot;Leave holiday&quot; to
                      record leave without salary deduction.
                    </p>
                    <input
                      type="date"
                      value={holidayDate}
                      onChange={(e) => setHolidayDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Number of days</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={holidayDayCount}
                        onChange={(e) => setHolidayDayCount(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={leaveHolidayNoDeduction}
                        onChange={(e) => setLeaveHolidayNoDeduction(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      Leave holiday (no salary deduction)
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddHoliday(employee.id)}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEmployee(null);
                          setHolidayDate('');
                          setHolidayDayCount('1');
                          setLeaveHolidayNoDeduction(false);
                        }}
                        className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedEmployee(employee.id);
                      setHolidayDayCount('1');
                      setLeaveHolidayNoDeduction(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    Add Holiday
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
