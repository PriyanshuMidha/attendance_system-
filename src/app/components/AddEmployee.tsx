import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useEmployees, holidayFromDateInput } from '../context/EmployeeContext';
import { ArrowLeft, Upload, Calendar } from 'lucide-react';

export const AddEmployee = () => {
  const navigate = useNavigate();
  const { addEmployee } = useEmployees();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    salary: '',
    dateOfJoining: '',
  });

  const [aadharPhoto, setAadharPhoto] = useState<string | undefined>();
  const [initialHoliday, setInitialHoliday] = useState('');

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAadharPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.salary) {
      alert('Please fill in name and salary');
      return;
    }

    const holidays = initialHoliday ? [holidayFromDateInput(initialHoliday)] : [];

    try {
      await addEmployee({
        name: formData.name,
        phone: formData.phone.trim(),
        salary: parseFloat(formData.salary),
        aadharPhoto,
        dateOfJoining: formData.dateOfJoining || undefined,
        holidays,
      });
      navigate('/');
    } catch {
      /* error shown in layout */
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Dashboard
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl text-gray-900 mb-6">Add New Employee</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm text-gray-700 mb-2">
              Employee Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter employee name"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Mobile number (optional)</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter mobile number"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">
              Monthly Salary (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter monthly salary"
              required
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">
              Date of Joining
            </label>
            <input
              type="date"
              value={formData.dateOfJoining}
              onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Aadhar card photo (optional)</label>
            <p className="text-xs text-gray-500 mb-2">
              Image is stored in your MongoDB database (as base64). Do not use production systems for
              highly sensitive ID images without extra security review.
            </p>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="aadhar-upload"
              />
              <label
                htmlFor="aadhar-upload"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-gray-600">
                  {aadharPhoto ? 'Change Photo' : 'Upload Aadhar Card'}
                </span>
              </label>
            </div>
            {aadharPhoto && (
              <div className="mt-3">
                <img
                  src={aadharPhoto}
                  alt="Aadhar preview"
                  className="w-full max-w-xs rounded-lg border border-gray-300"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">
              Add Initial Holiday (Optional)
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={initialHoliday}
                onChange={(e) => setInitialHoliday(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Employee
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
