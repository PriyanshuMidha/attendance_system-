import { useState } from 'react';
import { useEmployees } from '../context/EmployeeContext';
import { useViewMonth } from '../context/ViewMonthContext';
import { Download, FileText, Calendar, Printer } from 'lucide-react';
import { formatInr } from '../../lib/formatInr';

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvEscape(value: string | number) {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

type ReportRow = {
  id: string;
  name: string;
  phone?: string;
  baseSalary: number;
  absentDays: number;
  daysOnTime: number;
  dailyRate: number;
  deduction: number;
  finalSalary: number;
};

function buildSalaryReportHtml(
  reportData: ReportRow[],
  monthLabel: string,
  year: number,
  totals: { base: number; deduction: number; final: number }
) {
  const cardsHtml = reportData
    .map(
      (emp) => `
    <article class="emp-card">
      <h2 class="emp-name">${escapeHtml(emp.name)}</h2>
      <dl class="emp-rows">
        <div class="row"><dt>Base Salary</dt><dd>₹${formatInr(emp.baseSalary)}</dd></div>
        <div class="row"><dt>Absent Days</dt><dd>${emp.absentDays}</dd></div>
        <div class="row"><dt>Days On Time</dt><dd>${emp.daysOnTime}</dd></div>
        <div class="row"><dt>Daily Rate</dt><dd>₹${formatInr(emp.dailyRate)}</dd></div>
        <div class="row deduction"><dt>Deduction</dt><dd>-₹${formatInr(emp.deduction)}</dd></div>
        <div class="row final"><dt>Final Salary</dt><dd>₹${formatInr(emp.finalSalary)}</dd></div>
      </dl>
    </article>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Salary Report — ${escapeHtml(monthLabel)} ${year}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px 16px 40px;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: #f3f4f6;
      color: #111;
    }
    .report-title {
      text-align: center;
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      margin: 0 0 4px;
    }
    .report-sub {
      text-align: center;
      font-size: 0.9rem;
      color: #374151;
      margin: 0 0 24px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      max-width: 900px;
      margin: 0 auto;
    }
    @media (max-width: 520px) {
      .grid { grid-template-columns: 1fr; }
    }
    .emp-card {
      background: #fff;
      border: 1px solid #000;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      padding: 14px 16px 16px;
    }
    .emp-name {
      margin: 0 0 10px;
      font-size: 1rem;
      font-weight: 700;
    }
    .emp-rows { margin: 0; }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      font-size: 0.875rem;
      margin: 6px 0;
    }
    .row dt { margin: 0; font-weight: 400; color: #111; }
    .row dd { margin: 0; font-weight: 500; text-align: right; }
    .row.deduction dt, .row.deduction dd { color: #dc2626; font-weight: 600; }
    .row.final { margin-top: 10px; padding-top: 8px; border-top: 1px solid #e5e7eb; }
    .row.final dt, .row.final dd {
      color: #0d9488;
      font-weight: 700;
      font-size: 1rem;
    }
    .footer-note {
      text-align: center;
      margin-top: 28px;
      font-size: 0.75rem;
      color: #6b7280;
    }
    .totals {
      max-width: 900px;
      margin: 20px auto 0;
      padding: 12px 16px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      font-size: 0.875rem;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      text-align: center;
    }
    @media print {
      body { background: #fff; padding: 16px; }
      .totals { break-inside: avoid; }
      .emp-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1 class="report-title">SALARY REPORT</h1>
  <p class="report-sub">${escapeHtml(monthLabel)} ${year} · PAGE 1</p>
  <div class="grid">
    ${cardsHtml}
  </div>
  <div class="totals">
    <div><strong>Total base</strong><br/>₹${formatInr(totals.base)}</div>
    <div><strong>Total deduction</strong><br/><span style="color:#dc2626">₹${formatInr(totals.deduction)}</span></div>
    <div><strong>Total final</strong><br/><span style="color:#0d9488">₹${formatInr(totals.final)}</span></div>
  </div>
  <p class="footer-note">Generated ${escapeHtml(new Date().toLocaleString())}</p>
</body>
</html>`;
}

export const Reports = () => {
  const { employees, calculateSalary } = useEmployees();
  const { month: viewMonth, year: viewYear, setViewMonthYear } = useViewMonth();

  const [selectedMonth, setSelectedMonth] = useState(viewMonth);
  const [selectedYear, setSelectedYear] = useState(viewYear);

  const months = [
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

  const years = [2024, 2025, 2026, 2027];

  const monthLabel = months.find((m) => m.value === selectedMonth)?.label ?? '';

  const reportData: ReportRow[] = employees.map((employee) => {
    const salaryData = calculateSalary(employee, selectedMonth, selectedYear);
    return {
      id: employee.id,
      name: employee.name,
      phone: employee.phone,
      ...salaryData,
    };
  });

  const totalBaseSalary = reportData.reduce((sum, emp) => sum + emp.baseSalary, 0);
  const totalDeductions = reportData.reduce((sum, emp) => sum + emp.deduction, 0);
  const totalFinalSalary = reportData.reduce((sum, emp) => sum + emp.finalSalary, 0);

  const downloadCSV = () => {
    const headers = [
      'Employee Name',
      'Phone',
      'Base Salary',
      'Absent Days',
      'Days On Time',
      'Daily Rate',
      'Deduction',
      'Final Salary',
    ];

    const rows = reportData.map((emp) => [
      csvEscape(emp.name),
      csvEscape(emp.phone ?? ''),
      csvEscape(emp.baseSalary),
      csvEscape(emp.absentDays),
      csvEscape(emp.daysOnTime),
      csvEscape(emp.dailyRate),
      csvEscape(emp.deduction),
      csvEscape(emp.finalSalary),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
      '',
      `Total,,${totalBaseSalary},,,${totalDeductions},${totalFinalSalary}`,
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary-report-${monthLabel}-${selectedYear}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getReportHtml = () =>
    buildSalaryReportHtml(
      reportData,
      monthLabel,
      selectedYear,
      { base: totalBaseSalary, deduction: totalDeductions, final: totalFinalSalary }
    );

  const downloadReport = () => {
    const reportHTML = getReportHtml();
    const blob = new Blob([reportHTML], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary-report-${monthLabel}-${selectedYear}.html`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(getReportHtml());
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl text-gray-900 mb-1">Salary Reports</h2>
          <p className="text-sm text-gray-600">Generate and download employee salary reports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <Download className="w-5 h-5 shrink-0" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={downloadReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Download className="w-5 h-5 shrink-0" />
            Download report (HTML)
          </button>
          <button
            type="button"
            onClick={printReport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm"
          >
            <Printer className="w-5 h-5 shrink-0" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-gray-400 shrink-0" />
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const m = parseInt(e.target.value, 10);
                  setSelectedMonth(m);
                  setViewMonthYear(m, selectedYear);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  const y = parseInt(e.target.value, 10);
                  setSelectedYear(y);
                  setViewMonthYear(selectedMonth, y);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Base Salary</p>
              <p className="text-2xl text-gray-900">₹{formatInr(totalBaseSalary)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-50 rounded-lg">
              <FileText className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Deductions</p>
              <p className="text-2xl text-red-600">₹{formatInr(totalDeductions)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Final Salary</p>
              <p className="text-2xl text-teal-600">₹{formatInr(totalFinalSalary)}</p>
            </div>
          </div>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg text-gray-900 mb-2">No employees to report</h3>
          <p className="text-gray-600">Add employees to generate reports</p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-center">
            <h3 className="text-lg font-extrabold tracking-wide text-gray-900">SALARY REPORT</h3>
            <p className="text-sm text-gray-600">
              {monthLabel} {selectedYear} · PAGE 1
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto mb-10">
            {reportData.map((emp) => (
              <div
                key={emp.id}
                className="bg-white border border-black rounded shadow-md px-4 py-3"
              >
                <h4 className="font-bold text-gray-900 mb-2">{emp.name}</h4>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-800">Base Salary</dt>
                    <dd className="font-medium">₹{formatInr(emp.baseSalary)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-800">Absent Days</dt>
                    <dd className="font-medium">{emp.absentDays}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-800">Days On Time</dt>
                    <dd className="font-medium">{emp.daysOnTime}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-800">Daily Rate</dt>
                    <dd className="font-medium">₹{formatInr(emp.dailyRate)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 text-red-600 font-semibold">
                    <dt>Deduction</dt>
                    <dd>-₹{formatInr(emp.deduction)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 pt-2 mt-1 border-t border-gray-200 text-teal-600 font-bold text-base">
                    <dt>Final Salary</dt>
                    <dd>₹{formatInr(emp.finalSalary)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-sm font-medium text-gray-700">Table view (includes phone)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                      Employee Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-right text-xs text-gray-600 uppercase tracking-wider">
                      Base Salary
                    </th>
                    <th className="px-6 py-3 text-center text-xs text-gray-600 uppercase tracking-wider">
                      Absent Days
                    </th>
                    <th className="px-6 py-3 text-center text-xs text-gray-600 uppercase tracking-wider">
                      Days On Time
                    </th>
                    <th className="px-6 py-3 text-right text-xs text-gray-600 uppercase tracking-wider">
                      Daily Rate
                    </th>
                    <th className="px-6 py-3 text-right text-xs text-gray-600 uppercase tracking-wider">
                      Deduction
                    </th>
                    <th className="px-6 py-3 text-right text-xs text-gray-600 uppercase tracking-wider">
                      Final Salary
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{emp.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {emp.phone?.trim() ? emp.phone : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        ₹{formatInr(emp.baseSalary)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-red-600">
                        {emp.absentDays}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-green-600">
                        {emp.daysOnTime}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        ₹{formatInr(emp.dailyRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                        ₹{formatInr(emp.deduction)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-teal-600 font-medium">
                        ₹{formatInr(emp.finalSalary)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td colSpan={2} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      TOTAL
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      ₹{formatInr(totalBaseSalary)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400">-</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-400">-</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-400">-</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                      ₹{formatInr(totalDeductions)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-teal-600 font-medium">
                      ₹{formatInr(totalFinalSalary)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
