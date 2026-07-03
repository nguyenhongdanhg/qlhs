import XLSX from 'xlsx-js-style';
import { Student, Class } from '@/types';

// Template columns for student import
export const STUDENT_IMPORT_COLUMNS = [
  'STT',
  'Họ và tên',
  'Ngày sinh',
  'Giới tính',
  'Lớp',
  'CCCD',
  'Điện thoại',
  'Địa chỉ',
  'Dân tộc',
  'Phòng KTX',
  'Mâm ăn',
  'Link ảnh',
];

export interface StudentImportRow {
  stt: number;
  full_name: string;
  date_of_birth: string;
  gender: 'male' | 'female' | null;
  class_name: string;
  cccd: string;
  phone: string;
  address: string;
  ethnicity: string;
  room_number: string;
  meal_group: string;
  avatar_url: string;
  isValid: boolean;
  errors: string[];
}

// Generate student import template
export function generateStudentTemplate(): Blob {
  const ws = XLSX.utils.aoa_to_sheet([
    STUDENT_IMPORT_COLUMNS,
    [1, 'Nguyễn Văn A', '15/03/2008', 'Nam', '10A1', '001234567890', '0901234567', 'Hà Nội', 'Kinh', 'P101', 'Mâm 1', 'https://example.com/photo1.jpg'],
    [2, 'Trần Thị B', '20/05/2008', 'Nữ', '10A2', '001234567891', '0901234568', 'Hà Nam', 'Tày', 'P102', 'Mâm 2', ''],
  ]);

  // Set column widths
  ws['!cols'] = [
    { wch: 5 },  // STT
    { wch: 25 }, // Họ và tên
    { wch: 12 }, // Ngày sinh
    { wch: 10 }, // Giới tính
    { wch: 10 }, // Lớp
    { wch: 15 }, // CCCD
    { wch: 12 }, // Điện thoại
    { wch: 30 }, // Địa chỉ
    { wch: 12 }, // Dân tộc
    { wch: 10 }, // Phòng KTX
    { wch: 10 }, // Mâm ăn
    { wch: 40 }, // Link ảnh
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách học sinh');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Parse student import file
export function parseStudentImportFile(file: File): Promise<StudentImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // Skip header row
        const students: StudentImportRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row[1]) continue; // Skip empty rows

          const full_name = String(row[1] || '').trim();
          const date_of_birth = parseDateString(String(row[2] || ''));
          const genderStr = String(row[3] || '').trim();
          const gender = parseGender(genderStr);
          const class_name = String(row[4] || '').trim();
          const phone = String(row[6] || '').trim();

          // Validate
          const errors: string[] = [];
          if (!full_name) errors.push('Thiếu họ và tên');
          if (!class_name) errors.push('Thiếu lớp');
          if (genderStr && !gender) errors.push(`Giới tính "${genderStr}" không hợp lệ (nhập Nam/Nữ)`);
          if (date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) errors.push('Ngày sinh không đúng định dạng (dd/mm/yyyy)');

          students.push({
            stt: row[0] || i,
            full_name,
            date_of_birth,
            gender,
            class_name,
            cccd: String(row[5] || '').trim(),
            phone,
            address: String(row[7] || '').trim(),
            ethnicity: String(row[8] || '').trim(),
            room_number: String(row[9] || '').trim(),
            meal_group: String(row[10] || '').trim(),
            avatar_url: String(row[11] || '').trim(),
            isValid: errors.length === 0,
            errors,
          });
        }

        resolve(students);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// ==================== TEACHER IMPORT ====================

export const TEACHER_IMPORT_COLUMNS = [
  'STT',
  'Họ và tên',
  'Ngày sinh',
  'Giới tính',
  'Dân tộc',
  'SĐT',
  'Email',
  'Quê quán',
  'Địa chỉ',
  'Cấp học',
  'Môn dạy',
  'Chức vụ',
  'Ngày vào ngành',
  'Bậc',
  'Hạng',
  'Cấp',
  'Hệ số',
  'Hưởng từ ngày',
  'Ghi chú',
];

export interface TeacherImportRow {
  stt: number;
  full_name: string;
  birthday: string;
  gender: 'male' | 'female' | 'other' | null;
  ethnicity: string;
  phone: string;
  email: string;
  hometown: string;
  address: string;
  education_level: string;
  subject: string;
  position: string;
  joined_at: string;
  salary_rank: string;
  salary_class: string;
  salary_level: string;
  salary_coefficient: number | null;
  salary_effective_date: string;
  notes: string;
  isValid: boolean;
  errors: string[];
}

export function generateTeacherTemplate(): Blob {
  const ws = XLSX.utils.aoa_to_sheet([
    TEACHER_IMPORT_COLUMNS,
    [1, 'Nguyễn Văn A', '15/03/1985', 'Nam', 'Kinh', '0901234567', 'a@example.com', 'Hà Nội', 'Số 1, Phường X, Hà Nội', 'THCS', 'Toán', 'Giáo viên', '01/09/2010', 'Bậc 3', 'Hạng II', 'Cấp THCS', 3.0, '01/01/2024', ''],
    [2, 'Trần Thị B', '20/05/1990', 'Nữ', 'Tày', '0901234568', '', 'Hà Nam', '', 'THPT', 'Văn', 'Tổ trưởng', '01/09/2015', 'Bậc 2', 'Hạng III', 'Cấp THPT', 2.67, '', 'GVCN 10A1'],
  ]);
  ws['!cols'] = [
    { wch: 5 }, { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 13 }, { wch: 22 }, { wch: 15 }, { wch: 30 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách giáo viên');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function parseGenderExt(s: string): 'male' | 'female' | 'other' | null {
  const l = s.toLowerCase().trim();
  if (!l) return null;
  if (l === 'nam' || l === 'male' || l === 'm') return 'male';
  if (l === 'nữ' || l === 'nu' || l === 'female' || l === 'f') return 'female';
  if (l === 'khác' || l === 'khac' || l === 'other') return 'other';
  return null;
}

export function parseTeacherImportFile(file: File): Promise<TeacherImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        const teachers: TeacherImportRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[1]) continue;
          const full_name = String(row[1] || '').trim();
          const birthday = parseDateString(String(row[2] || ''));
          const genderStr = String(row[3] || '').trim();
          const gender = parseGenderExt(genderStr);
          const phone = String(row[5] || '').trim();
          const coefRaw = row[16];
          const salary_coefficient = coefRaw === '' || coefRaw == null || isNaN(Number(coefRaw)) ? null : Number(coefRaw);

          const errors: string[] = [];
          if (!full_name) errors.push('Thiếu họ và tên');
          if (genderStr && !gender) errors.push(`Giới tính "${genderStr}" không hợp lệ (Nam/Nữ/Khác)`);
          if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) errors.push('Ngày sinh sai định dạng (dd/mm/yyyy)');

          teachers.push({
            stt: row[0] || i,
            full_name,
            birthday,
            gender,
            ethnicity: String(row[4] || '').trim(),
            phone,
            email: String(row[6] || '').trim(),
            hometown: String(row[7] || '').trim(),
            address: String(row[8] || '').trim(),
            education_level: String(row[9] || '').trim(),
            subject: String(row[10] || '').trim(),
            position: String(row[11] || '').trim(),
            joined_at: parseDateString(String(row[12] || '')),
            salary_rank: String(row[13] || '').trim(),
            salary_class: String(row[14] || '').trim(),
            salary_level: String(row[15] || '').trim(),
            salary_coefficient,
            salary_effective_date: parseDateString(String(row[17] || '')),
            notes: String(row[18] || '').trim(),
            isValid: errors.length === 0,
            errors,
          });
        }
        resolve(teachers);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// Export students to Excel
export function exportStudentsToExcel(students: Student[], classes: Class[], fileName: string = 'danh-sach-hoc-sinh'): void {
  const data = students.map((student, index) => ({
    'STT': index + 1,
    'Mã HS': student.student_code,
    'Họ và tên': student.full_name,
    'Ngày sinh': student.date_of_birth ? formatDateForExcel(student.date_of_birth) : '',
    'Giới tính': student.gender === 'male' ? 'Nam' : student.gender === 'female' ? 'Nữ' : '',
    'Lớp': student.class?.name || '',
    'CCCD': student.cccd || '',
    'Điện thoại': student.phone || '',
    'SĐT Phụ huynh': student.parent_phone || '',
    'Địa chỉ': student.address || '',
    'Dân tộc': student.ethnicity || '',
    'Phòng KTX': student.room_number || '',
    'Mâm ăn': student.meal_group || '',
    'Nội trú': student.is_boarding ? 'Có' : 'Không',
    'Ghi chú': student.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách học sinh');

  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

// Export attendance report to Excel
export function exportAttendanceToExcel(
  data: {
    date: string;
    type: string;
    records: { 
      student_name: string; 
      class_name: string;
      status: string;
      excused_reason?: string;
    }[];
    summary: { total: number; present: number; absent: number };
    reporter?: string;
  },
  fileName: string = 'bao-cao-diem-danh'
): void {
  const ws = XLSX.utils.aoa_to_sheet([
    ['BÁO CÁO ĐIỂM DANH'],
    ['Ngày:', data.date, 'Loại:', data.type],
    ['Người báo cáo:', data.reporter || ''],
    [],
    ['Tổng số', 'Có mặt', 'Vắng'],
    [data.summary.total, data.summary.present, data.summary.absent],
    [],
    ['STT', 'Họ và tên', 'Lớp', 'Trạng thái', 'Lý do'],
    ...data.records
      .filter(r => r.status === 'absent')
      .map((r, i) => [i + 1, r.student_name, r.class_name, 'Vắng', r.excused_reason || '']),
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Báo cáo');

  XLSX.writeFile(wb, `${fileName}-${data.date}.xlsx`);
}

// Export meal statistics to Excel with multiple sheets
export function exportMealStatsToExcel(
  data: {
    date: string;
    schoolName: string;
    breakfast: { total: number; absent: number; absentByClass: Record<string, number> };
    lunch: { total: number; absent: number; absentByMeal: Record<string, number>; riceKg: number };
    dinner: { total: number; absent: number; absentByMeal: Record<string, number>; riceKg: number };
  },
  fileName: string = 'thong-ke-bua-an'
): void {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['THỐNG KÊ BỮA ĂN'],
    ['Trường:', data.schoolName],
    ['Ngày:', data.date],
    [],
    ['Bữa', 'Tổng số', 'Vắng', 'Ăn', 'Gạo (kg)'],
    ['Sáng', data.breakfast.total, data.breakfast.absent, data.breakfast.total - data.breakfast.absent, '-'],
    ['Trưa', data.lunch.total, data.lunch.absent, data.lunch.total - data.lunch.absent, data.lunch.riceKg.toFixed(1)],
    ['Tối', data.dinner.total, data.dinner.absent, data.dinner.total - data.dinner.absent, data.dinner.riceKg.toFixed(1)],
    [],
    ['Tổng gạo cần:', `${(data.lunch.riceKg + data.dinner.riceKg).toFixed(1)} kg`],
  ];

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Tổng hợp');

  // Breakfast by class
  const breakfastData = [
    ['VẮNG ĂN SÁNG THEO LỚP'],
    ['Lớp', 'Số vắng'],
    ...Object.entries(data.breakfast.absentByClass).map(([cls, count]) => [cls, count]),
  ];
  const breakfastWs = XLSX.utils.aoa_to_sheet(breakfastData);
  XLSX.utils.book_append_sheet(wb, breakfastWs, 'Sáng theo lớp');

  // Lunch by meal group
  const lunchData = [
    ['VẮNG ĂN TRƯA THEO MÂM'],
    ['Mâm', 'Số vắng'],
    ...Object.entries(data.lunch.absentByMeal).map(([meal, count]) => [meal, count]),
  ];
  const lunchWs = XLSX.utils.aoa_to_sheet(lunchData);
  XLSX.utils.book_append_sheet(wb, lunchWs, 'Trưa theo mâm');

  // Dinner by meal group
  const dinnerData = [
    ['VẮNG ĂN TỐI THEO MÂM'],
    ['Mâm', 'Số vắng'],
    ...Object.entries(data.dinner.absentByMeal).map(([meal, count]) => [meal, count]),
  ];
  const dinnerWs = XLSX.utils.aoa_to_sheet(dinnerData);
  XLSX.utils.book_append_sheet(wb, dinnerWs, 'Tối theo mâm');

  XLSX.writeFile(wb, `${fileName}-${data.date}.xlsx`);
}

// Helper functions
export function parseDateString(dateStr: string): string {
  if (!dateStr) return '';
  
  // Handle dd/mm/yyyy format
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Handle Excel date number
  if (!isNaN(Number(dateStr))) {
    const excelDate = XLSX.SSF.parse_date_code(Number(dateStr));
    if (excelDate) {
      return `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
    }
  }
  
  return dateStr;
}

export function parseGender(genderStr: string): 'male' | 'female' | null {
  const lower = genderStr.toLowerCase().trim();
  if (lower === 'nam' || lower === 'male' || lower === 'm') return 'male';
  if (lower === 'nữ' || lower === 'nu' || lower === 'female' || lower === 'f') return 'female';
  return null;
}

function formatDateForExcel(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// Download blob helper
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
