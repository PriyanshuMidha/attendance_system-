import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useEmployees, holidayFromDateInput, type EmployeeUpdate } from '../context/EmployeeContext';
import {
  ArrowLeft,
  Calendar,
  Trash2,
  Phone,
  CreditCard,
  Plus,
  Pencil,
  Upload,
  UserX,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function formatHolidayLabel(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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

export const EmployeeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getEmployee, addHoliday, removeHoliday, calculateSalary, updateEmployee, deleteEmployee } =
    useEmployees();

  const [newHoliday, setNewHoliday] = useState('');
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [holidayMonth, setHolidayMonth] = useState(() => new Date().getMonth() + 1);
  const [holidayYear, setHolidayYear] = useState(() => new Date().getFullYear());
  const [editingLeaveDate, setEditingLeaveDate] = useState<string | null>(null);
  const [editLeaveDateInput, setEditLeaveDateInput] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSalary, setEditSalary] = useState('');
  const [editDateOfJoining, setEditDateOfJoining] = useState('');
  const [editAadharPhoto, setEditAadharPhoto] = useState<string | undefined>(undefined);
  const [removeAadhar, setRemoveAadhar] = useState(false);

  const employee = getEmployee(id!);

  useEffect(() => {
    if (!employee || isEditing) return;
    setEditName(employee.name);
    setEditPhone(employee.phone ?? '');
    setEditSalary(String(employee.salary));
    setEditDateOfJoining(employee.dateOfJoining ?? '');
    setEditAadharPhoto(undefined);
    setRemoveAadhar(false);
  }, [employee, isEditing]);

  if (!employee) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl text-gray-900 mb-4">Employee not found</h2>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const startEditing = () => {
    setEditName(employee.name);
    setEditPhone(employee.phone ?? '');
    setEditSalary(String(employee.salary));
    setEditDateOfJoining(employee.dateOfJoining ?? '');
    setEditAadharPhoto(undefined);
    setRemoveAadhar(false);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditAadharPhoto(undefined);
    setRemoveAadhar(false);
  };

  const handleEditImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAadharPhoto(reader.result as string);
        setRemoveAadhar(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEmployee = async (e: FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editSalary) {
      alert('Please fill in name and salary');
      return;
    }
    const salaryNum = parseFloat(editSalary);
    if (Number.isNaN(salaryNum) || salaryNum < 0) {
      alert('Please enter a valid salary');
      return;
    }

    const updates: EmployeeUpdate = {
      name: editName.trim(),
      phone: editPhone.trim() || '',
      salary: salaryNum,
      dateOfJoining: editDateOfJoining || undefined,
    };

    if (removeAadhar) {
      updates.aadharPhoto = null;
    } else if (editAadharPhoto !== undefined) {
      updates.aadharPhoto = editAadharPhoto;
    }

    try {
      await updateEmployee(employee.id, updates);
      setIsEditing(false);
      setEditAadharPhoto(undefined);
      setRemoveAadhar(false);
    } catch {
      /* error shown in layout */
    }
  };

  const handleDeleteEmployee = async () => {
    if (
      !confirm(
        `Remove ${employee.name} from the active list? They will be hidden (soft deleted) and can be recovered later only from the database.`
      )
    ) {
      return;
    }
    try {
      await deleteEmployee(employee.id);
      navigate('/');
    } catch {
      /* error shown in layout */
    }
  };

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const currentMonthSalary = calculateSalary(employee, currentMonth, currentYear);

  const monthlyAnalysis = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthHolidays = employee.holidays.filter(
      (h) => h.month === month && h.year === currentYear
    ).length;
    return {
      month: new Date(currentYear, i).toLocaleString('en-US', { month: 'short' }),
      holidays: monthHolidays,
    };
  });

  const yearlyData = [2024, 2025, 2026, 2027].map((year) => {
    const yearHolidays = employee.holidays.filter((h) => h.year === year).length;
    return {
      year: year.toString(),
      holidays: yearHolidays,
    };
  });

  const handleAddHoliday = async () => {
    if (!newHoliday) {
      alert('Please select a date');
      return;
    }

    try {
      await addHoliday(employee.id, holidayFromDateInput(newHoliday));
      setNewHoliday('');
      setShowAddHoliday(false);
    } catch {
      /* error shown in layout */
    }
  };

  const handleRemoveHoliday = async (date: string) => {
    if (!confirm('Are you sure you want to remove this holiday?')) {
      return;
    }
    try {
      await removeHoliday(employee.id, date);
    } catch {
      /* error shown in layout */
    }
  };

  const yearNow = new Date().getFullYear();
  const holidayYearOptions = Array.from({ length: 14 }, (_, i) => yearNow + 1 - i);

  const holidaysForView = employee.holidays
    .filter((h) => h.month === holidayMonth && h.year === holidayYear)
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleStartEditLeave = (isoDate: string) => {
    setEditingLeaveDate(isoDate);
    setEditLeaveDateInput(isoDate);
  };

  const handleSaveLeaveEdit = async () => {
    if (!editingLeaveDate || !editLeaveDateInput) return;
    const next = holidayFromDateInput(editLeaveDateInput);
    if (
      next.date !== editingLeaveDate &&
      employee.holidays.some((h) => h.date === next.date)
    ) {
      alert('That date already has a leave recorded.');
      return;
    }
    try {
      if (editLeaveDateInput !== editingLeaveDate) {
        await removeHoliday(employee.id, editingLeaveDate);
        await addHoliday(employee.id, next);
      }
      setEditingLeaveDate(null);
      setEditLeaveDateInput('');
    } catch {
      /* error shown in layout */
    }
  };

  const handleCancelLeaveEdit = () => {
    setEditingLeaveDate(null);
    setEditLeaveDateInput('');
  };

  const displayAadhar =
    isEditing && removeAadhar
      ? undefined
      : isEditing && editAadharPhoto !== undefined
        ? editAadharPhoto
        : employee.aadharPhoto;

  return (
    <div>
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Dashboard
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            {!isEditing ? (
              <>
                <div>
                  <h2 className="text-2xl text-gray-900 mb-2">{employee.name}</h2>
                  <div className="flex flex-wrap items-center gap-4 text-gray-600">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 shrink-0" />
                      {employee.phone?.trim() ? (
                        <span>{employee.phone}</span>
                      ) : (
                        <span className="text-gray-400">No phone on file</span>
                      )}
                    </div>
                    {employee.dateOfJoining && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>Joined: {new Date(employee.dateOfJoining).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={startEditing}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteEmployee}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 text-sm rounded-lg hover:bg-red-50"
                  >
                    <UserX className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSaveEmployee} className="w-full space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">Edit employee</h2>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                    >
                      Save changes
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Phone (optional)</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave blank if not available"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Monthly salary (₹)</label>
                  <input
                    type="number"
                    value={editSalary}
                    onChange={(e) => setEditSalary(e.target.value)}
                    min={0}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Date of joining</label>
                  <input
                    type="date"
                    value={editDateOfJoining}
                    onChange={(e) => setEditDateOfJoining(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Aadhar card photo (optional)</label>
                  <p className="text-xs text-gray-500 mb-2">Stored in MongoDB as image data with this employee record.</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditImage}
                    className="hidden"
                    id="edit-aadhar-upload"
                  />
                  <label
                    htmlFor="edit-aadhar-upload"
                    className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 text-sm text-gray-600"
                  >
                    <Upload className="w-4 h-4" />
                    Replace photo
                  </label>
                  {(employee.aadharPhoto || editAadharPhoto) && (
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveAadhar(true);
                        setEditAadharPhoto(undefined);
                      }}
                      className="ml-3 text-sm text-red-600 hover:underline"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {displayAadhar && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-5 h-5 text-gray-400" />
                <h3 className="text-sm text-gray-700">Aadhar Card</h3>
              </div>
              <img
                src={displayAadhar}
                alt="Aadhar card"
                className="rounded-lg border border-gray-300 max-w-md"
              />
            </div>
          )}

          {!isEditing && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600 mb-1">Base Salary</p>
                <p className="text-xl text-gray-900">₹{currentMonthSalary.baseSalary.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Final Salary</p>
                <p className="text-xl text-green-600">₹{currentMonthSalary.finalSalary.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Absent Days</p>
                <p className="text-xl text-red-600">{currentMonthSalary.absentDays}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Days On Time</p>
                <p className="text-xl text-green-600">{currentMonthSalary.daysOnTime}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Daily Rate</p>
                <p className="text-lg text-gray-900">₹{currentMonthSalary.dailyRate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Deduction</p>
                <p className="text-lg text-red-600">-₹{currentMonthSalary.deduction.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg text-gray-900">Leaves / absences</h3>
            <button
              type="button"
              onClick={() => setShowAddHoliday(!showAddHoliday)}
              className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
              title="Add leave"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Choose any month to view or edit past leaves. Add leave uses the calendar date (any month/year).
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Month</label>
              <select
                value={holidayMonth}
                onChange={(e) => {
                  setHolidayMonth(Number(e.target.value));
                  setEditingLeaveDate(null);
                  setEditLeaveDateInput('');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                value={holidayYear}
                onChange={(e) => {
                  setHolidayYear(Number(e.target.value));
                  setEditingLeaveDate(null);
                  setEditLeaveDateInput('');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {holidayYearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showAddHoliday && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
              <p className="text-xs text-gray-600">Pick the absence date (any month/year)</p>
              <input
                type="date"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddHoliday}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  Add leave
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddHoliday(false);
                    setNewHoliday('');
                  }}
                  className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {holidaysForView.map((holiday) => (
              <div key={holiday.date} className="p-3 bg-gray-50 rounded-lg space-y-2">
                {editingLeaveDate === holiday.date ? (
                  <>
                    <input
                      type="date"
                      value={editLeaveDateInput}
                      onChange={(e) => setEditLeaveDateInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveLeaveEdit()}
                        className="flex-1 px-2 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                      >
                        Save date
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelLeaveEdit}
                        className="flex-1 px-2 py-1.5 bg-gray-200 text-gray-800 text-xs rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-900">{formatHolidayLabel(holiday.date)}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEditLeave(holiday.date)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Change date"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveHoliday(holiday.date)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {holidaysForView.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No leaves recorded for {MONTH_OPTIONS.find((m) => m.value === holidayMonth)?.label}{' '}
                {holidayYear}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg text-gray-900 mb-4">Monthly Holiday Analysis ({currentYear})</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyAnalysis}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="holidays" fill="#ef4444" name="Holidays" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg text-gray-900 mb-4">Yearly Holiday Graph</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="holidays" fill="#3b82f6" name="Total Holidays" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
