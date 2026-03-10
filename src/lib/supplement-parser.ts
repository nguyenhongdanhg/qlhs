import XLSX from 'xlsx-js-style';
import { StudentImportRow } from '@/lib/excel-utils';
import { parseDateString, parseGender } from '@/lib/excel-utils';

// Map Vietnamese header names to StudentImportRow keys
const HEADER_MAP: Record<string, keyof StudentImportRow> = {
  'họ và tên': 'full_name',
  'ho va ten': 'full_name',
  'họ tên': 'full_name',
  'ho ten': 'full_name',
  'tên': 'full_name',
  'lớp': 'class_name',
  'lop': 'class_name',
  'cccd': 'cccd',
  'số cccd': 'cccd',
  'cmnd': 'cccd',
  'dân tộc': 'ethnicity',
  'dan toc': 'ethnicity',
  'điện thoại': 'phone',
  'sđt học sinh': 'phone',
  'sdt hoc sinh': 'phone',
  'sđt': 'phone',
  'sdt': 'phone',
  'số điện thoại': 'phone',
  'địa chỉ': 'address',
  'dia chi': 'address',
  'phòng ktx': 'room_number',
  'phong ktx': 'room_number',
  'phòng': 'room_number',
  'mâm ăn': 'meal_group',
  'mam an': 'meal_group',
  'nhóm ăn': 'meal_group',
  'ngày sinh': 'date_of_birth',
  'ngay sinh': 'date_of_birth',
  'giới tính': 'gender',
  'gioi tinh': 'gender',
  'link ảnh': 'avatar_url',
  'ảnh': 'avatar_url',
  'avatar': 'avatar_url',
  'sđt phụ huynh': 'phone', // fallback
};

export function parseSupplementFile(file: File): Promise<StudentImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          resolve([]);
          return;
        }

        // Parse headers - find column index for each field
        const headerRow = jsonData[0].map((h: any) => String(h || '').trim().toLowerCase());
        const colMap: Record<string, number> = {};

        headerRow.forEach((header: string, idx: number) => {
          const normalized = header
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
          
          // Try exact match first, then normalized
          for (const [key, field] of Object.entries(HEADER_MAP)) {
            const normalizedKey = key
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase();
            
            if (header === key || normalized === normalizedKey || header.includes(key) || normalized.includes(normalizedKey)) {
              if (!colMap[field as string]) {
                colMap[field as string] = idx;
              }
              break;
            }
          }
        });

        const students: StudentImportRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const getValue = (field: string) => {
            const idx = colMap[field];
            if (idx === undefined) return '';
            return String(row[idx] || '').trim();
          };

          const full_name = getValue('full_name');
          if (!full_name) continue;

          const genderStr = getValue('gender');
          const dateStr = getValue('date_of_birth');

          students.push({
            stt: i,
            full_name,
            date_of_birth: dateStr ? parseDateString(dateStr) : '',
            gender: genderStr ? parseGender(genderStr) : null,
            class_name: getValue('class_name'),
            cccd: getValue('cccd'),
            phone: getValue('phone'),
            address: getValue('address'),
            ethnicity: getValue('ethnicity'),
            room_number: getValue('room_number'),
            meal_group: getValue('meal_group'),
            avatar_url: getValue('avatar_url'),
            isValid: true,
            errors: [],
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
