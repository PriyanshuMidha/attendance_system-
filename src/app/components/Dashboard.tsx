import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useEmployees, holidayFromDateInput } from '../context/EmployeeContext';
import { Calendar, Plus, UserCircle } from 'lucide-react';

export const Dashboard = () => {
  const { employees, loading, addHoliday, calculateSalary } = useEmployees();
  const navigate = useNavigate();
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [holidayDate, setHolidayDate] = useState('');

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const handleAddHoliday = async (employeeId: string) => {
    if (!holidayDate) {
      alert('Please select a date');
      return;
    }

    try {
      await addHoliday(employeeId, holidayFromDateInput(holidayDate));
      setSelectedEmployee(null);
      setHolidayDate('');
    } catch {
      /* error shown in layout */
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl text-gray-900 mb-1">Employee Dashboard</h2>
          <p className="text-sm text-gray-600">
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => navigate('/add')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
            const salaryData = calculateSalary(employee, currentMonth, currentYear);
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
                      <span className="text-sm text-red-600">{salaryData.absentDays}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Days On Time:</span>
                      <span className="text-sm text-green-600">{salaryData.daysOnTime}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Current Salary:</span>
                      <span className="text-base text-gray-900">₹{salaryData.finalSalary.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {selectedEmployee === employee.id ? (
                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">Choose any date — past or future months count for that month&apos;s attendance.</p>
                    <input
                      type="date"
                      value={holidayDate}
                      onChange={(e) => setHolidayDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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
                        }}
                        className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedEmployee(employee.id)}
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
