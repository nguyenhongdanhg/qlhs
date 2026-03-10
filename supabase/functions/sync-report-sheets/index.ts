import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

type ReportType = 'meal_attendance' | 'evening_study' | 'boarding' | 'emulation' | 'duty' | 'kitchen' | 'health';

interface SyncRequest {
  school_id: string;
  report_type: ReportType | 'all';
  year: number;
  month: number;
}

// ===== Google API Helpers =====
async function createJWT(credentials: ServiceAccountCredentials, scopes: string[]): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: scopes.join(' '),
    aud: credentials.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pemContents = credentials.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(unsignedToken));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${unsignedToken}.${signatureB64}`;
}

async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file'
  ];
  const jwt = await createJWT(credentials, scopes);
  const response = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!response.ok) throw new Error(`Failed to get access token: ${await response.text()}`);
  const data = await response.json();
  return data.access_token;
}

// Find or create folder "Nội trú bán trú" inside the parent folder
async function findOrCreateFolder(accessToken: string, parentFolderId: string, folderName: string): Promise<string> {
  // Search for existing folder
  const query = `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`;
  
  const searchResp = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
  if (searchResp.ok) {
    const searchData = await searchResp.json();
    if (searchData.files?.length > 0) {
      return searchData.files[0].id;
    }
  }

  // Create folder
  const createResp = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  });

  if (!createResp.ok) throw new Error(`Failed to create folder: ${await createResp.text()}`);
  const folderData = await createResp.json();
  return folderData.id;
}

// Create a spreadsheet in folder
async function createSpreadsheet(accessToken: string, title: string, folderId: string): Promise<string> {
  const resp = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId],
    }),
  });
  if (!resp.ok) throw new Error(`Failed to create spreadsheet: ${await resp.text()}`);
  const data = await resp.json();
  return data.id;
}

// Add/rename sheets in spreadsheet
async function setupSheets(accessToken: string, spreadsheetId: string, sheetNames: string[]): Promise<void> {
  const getResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  if (!getResp.ok) throw new Error(`Failed to get spreadsheet: ${await getResp.text()}`);
  
  const spreadsheet = await getResp.json();
  const existingSheets = spreadsheet.sheets?.map((s: any) => s.properties.title) || [];
  const requests: any[] = [];

  // Rename Sheet1 to first name
  if (existingSheets.includes('Sheet1') && sheetNames.length > 0) {
    const sheetId = spreadsheet.sheets.find((s: any) => s.properties.title === 'Sheet1')?.properties.sheetId;
    if (sheetId !== undefined) {
      requests.push({ updateSheetProperties: { properties: { sheetId, title: sheetNames[0] }, fields: 'title' } });
    }
  }

  // Add remaining sheets
  for (let i = (existingSheets.includes('Sheet1') ? 1 : 0); i < sheetNames.length; i++) {
    if (!existingSheets.includes(sheetNames[i])) {
      requests.push({ addSheet: { properties: { title: sheetNames[i], index: i } } });
    }
  }

  if (requests.length > 0) {
    const batchResp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      }
    );
    if (!batchResp.ok) {
      const err = await batchResp.text();
      if (!err.includes('already exists')) throw new Error(`Failed to setup sheets: ${err}`);
    }
  }
}

// Update sheet data (clear + write)
async function updateSheet(accessToken: string, spreadsheetId: string, sheetName: string, values: (string | number)[][]): Promise<void> {
  const range = `'${sheetName}'!A:ZZ`;
  
  // Ensure sheet exists
  try {
    const getResp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const data = await getResp.json();
    const existing = data.sheets?.map((s: any) => s.properties.title) || [];
    if (!existing.includes(sheetName)) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
      });
    }
  } catch { /* ignore */ }

  // Clear
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
    { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  // Write
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  );
  if (!resp.ok) throw new Error(`Failed to update sheet ${sheetName}: ${await resp.text()}`);
}

// ===== Helper functions =====
function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function fmtISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const REPORT_LABELS: Record<ReportType, string> = {
  meal_attendance: 'Báo cơm',
  evening_study: 'Tự học tối',
  boarding: 'Nội trú',
  emulation: 'Thi đua',
  duty: 'Lịch trực',
  kitchen: 'Kho bếp',
  health: 'Y tế',
};

// ===== Data builders per report type =====

async function buildMealData(supabase: any, schoolId: string, schoolName: string, year: number, month: number) {
  const days = getDaysInMonth(year, month);
  const startDate = fmtISO(days[0]);
  const endDate = fmtISO(days[days.length - 1]);

  const { data: classes } = await supabase.from('classes').select('id, name, grade')
    .eq('school_id', schoolId).eq('is_active', true).order('grade').order('name');
  const { data: students } = await supabase.from('students').select('id, full_name, class_id, room_number, meal_group')
    .eq('school_id', schoolId).eq('is_active', true);
  const { data: records } = await supabase.from('attendance_records').select('*')
    .eq('school_id', schoolId).in('attendance_type', ['breakfast', 'lunch', 'dinner'])
    .gte('attendance_date', startDate).lte('attendance_date', endDate).limit(100000);

  // Build latest map
  const latest = new Map<string, any>();
  (records || []).forEach((r: any) => {
    const key = `${r.student_id}-${r.attendance_date}-${r.attendance_type}`;
    const ex = latest.get(key);
    if (!ex || new Date(r.created_at) > new Date(ex.created_at)) latest.set(key, r);
  });

  // Group by class
  const classMap = new Map<string, { info: any; students: any[] }>();
  (classes || []).forEach((c: any) => classMap.set(c.id, { info: c, students: [] }));
  (students || []).forEach((s: any) => { if (s.class_id && classMap.has(s.class_id)) classMap.get(s.class_id)!.students.push(s); });

  const sorted = Array.from(classMap.entries()).filter(([_, d]) => d.students.length > 0)
    .sort((a, b) => a[1].info.grade - b[1].info.grade || a[1].info.name.localeCompare(b[1].info.name, 'vi'));

  const sheets: { name: string; data: (string | number)[][] }[] = [];

  // Summary sheet
  const summary: (string | number)[][] = [
    [`THỐNG KÊ BỮA ĂN TOÀN TRƯỜNG - Tháng ${month}/${year}`],
    [`Trường: ${schoolName}`],
    [`Cập nhật: ${new Date().toLocaleString('vi-VN')}`],
    [],
  ];
  const hdr: (string | number)[] = ['Ngày'];
  sorted.forEach(([_, d]) => { hdr.push(`${d.info.name} S`, `${d.info.name} T`, `${d.info.name} C`); });
  hdr.push('Tổng S', 'Tổng T', 'Tổng C', 'Gạo (kg)');
  summary.push(hdr);

  days.forEach(day => {
    const ds = fmtISO(day);
    const row: (string | number)[] = [fmtDate(day)];
    let dB = 0, dL = 0, dD = 0;
    sorted.forEach(([_, d]) => {
      let cB = 0, cL = 0, cD = 0;
      d.students.forEach(s => {
        if (latest.get(`${s.id}-${ds}-breakfast`)?.status === 'present') cB++;
        if (latest.get(`${s.id}-${ds}-lunch`)?.status === 'present') cL++;
        if (latest.get(`${s.id}-${ds}-dinner`)?.status === 'present') cD++;
      });
      row.push(cB, cL, cD);
      dB += cB; dL += cL; dD += cD;
    });
    row.push(dB, dL, dD, +((dL + dD) * 0.2).toFixed(1));
    summary.push(row);
  });
  sheets.push({ name: 'Toàn trường', data: summary });

  // Per-class sheets
  for (const [_, d] of sorted) {
    const cd: (string | number)[][] = [
      [`LỚP ${d.info.name} - Tháng ${month}/${year}`],
      [`Sĩ số: ${d.students.length}`], [],
    ];
    const ch: (string | number)[] = ['STT', 'Họ tên', 'Phòng', 'Mâm'];
    days.forEach(day => ch.push(fmtDate(day).split('/')[0]));
    ch.push('Sáng', 'Trưa', 'Tối', 'Gạo');
    cd.push(ch);

    d.students.sort((a: any, b: any) => a.full_name.localeCompare(b.full_name, 'vi'));
    d.students.forEach((s: any, i: number) => {
      const row: (string | number)[] = [i + 1, s.full_name, s.room_number || '', s.meal_group || ''];
      let tB = 0, tL = 0, tD = 0;
      days.forEach(day => {
        const ds = fmtISO(day);
        const b = latest.get(`${s.id}-${ds}-breakfast`);
        const l = latest.get(`${s.id}-${ds}-lunch`);
        const dd = latest.get(`${s.id}-${ds}-dinner`);
        if (!b && !l && !dd) { row.push('-'); return; }
        const bc = !b ? '-' : b.status === 'present' ? 'x' : 'o';
        const lc = !l ? '-' : l.status === 'present' ? 'x' : 'o';
        const dc = !dd ? '-' : dd.status === 'present' ? 'x' : 'o';
        if (b?.status === 'present') tB++;
        if (l?.status === 'present') tL++;
        if (dd?.status === 'present') tD++;
        row.push(`${bc}${lc}${dc}`);
      });
      row.push(tB, tL, tD, +((tL + tD) * 0.2).toFixed(1));
      cd.push(row);
    });
    sheets.push({ name: d.info.name, data: cd });
  }

  return sheets;
}

async function buildAttendanceData(supabase: any, schoolId: string, schoolName: string, year: number, month: number, type: 'evening_study' | 'boarding') {
  const label = type === 'evening_study' ? 'TỰ HỌC TỐI' : 'NỘI TRÚ';
  const days = getDaysInMonth(year, month);
  const startDate = fmtISO(days[0]);
  const endDate = fmtISO(days[days.length - 1]);

  const { data: classes } = await supabase.from('classes').select('id, name, grade')
    .eq('school_id', schoolId).eq('is_active', true).order('grade').order('name');
  const { data: students } = await supabase.from('students').select('id, full_name, class_id')
    .eq('school_id', schoolId).eq('is_active', true).eq('is_boarding', true);
  const { data: records } = await supabase.from('attendance_records').select('*')
    .eq('school_id', schoolId).eq('attendance_type', type)
    .gte('attendance_date', startDate).lte('attendance_date', endDate).limit(100000);

  const latest = new Map<string, any>();
  (records || []).forEach((r: any) => {
    const key = `${r.student_id}-${r.attendance_date}`;
    const ex = latest.get(key);
    if (!ex || new Date(r.created_at) > new Date(ex.created_at)) latest.set(key, r);
  });

  const classMap = new Map<string, { info: any; students: any[] }>();
  (classes || []).forEach((c: any) => classMap.set(c.id, { info: c, students: [] }));
  (students || []).forEach((s: any) => { if (s.class_id && classMap.has(s.class_id)) classMap.get(s.class_id)!.students.push(s); });

  const sorted = Array.from(classMap.entries()).filter(([_, d]) => d.students.length > 0)
    .sort((a, b) => a[1].info.grade - b[1].info.grade || a[1].info.name.localeCompare(b[1].info.name, 'vi'));

  const sheets: { name: string; data: (string | number)[][] }[] = [];

  // Summary
  const summary: (string | number)[][] = [
    [`ĐIỂM DANH ${label} - Tháng ${month}/${year}`],
    [`Trường: ${schoolName}`],
    [`Cập nhật: ${new Date().toLocaleString('vi-VN')}`],
    [],
  ];
  const hdr: (string | number)[] = ['Ngày'];
  sorted.forEach(([_, d]) => hdr.push(d.info.name));
  hdr.push('Tổng có mặt', 'Tổng vắng');
  summary.push(hdr);

  days.forEach(day => {
    const ds = fmtISO(day);
    const row: (string | number)[] = [fmtDate(day)];
    let totalPresent = 0, totalAbsent = 0;
    sorted.forEach(([_, d]) => {
      let present = 0;
      d.students.forEach(s => {
        const r = latest.get(`${s.id}-${ds}`);
        if (r?.status === 'present') present++;
      });
      row.push(present);
      totalPresent += present;
      totalAbsent += d.students.length - present;
    });
    row.push(totalPresent, totalAbsent);
    summary.push(row);
  });
  sheets.push({ name: 'Toàn trường', data: summary });

  // Per-class
  for (const [_, d] of sorted) {
    const cd: (string | number)[][] = [
      [`${label} - LỚP ${d.info.name} - Tháng ${month}/${year}`],
      [`Sĩ số nội trú: ${d.students.length}`], [],
    ];
    const ch: (string | number)[] = ['STT', 'Họ tên'];
    days.forEach(day => ch.push(fmtDate(day).split('/')[0]));
    ch.push('Có mặt', 'Vắng');
    cd.push(ch);

    d.students.sort((a: any, b: any) => a.full_name.localeCompare(b.full_name, 'vi'));
    d.students.forEach((s: any, i: number) => {
      const row: (string | number)[] = [i + 1, s.full_name];
      let present = 0, absent = 0;
      days.forEach(day => {
        const r = latest.get(`${s.id}-${fmtISO(day)}`);
        if (!r) { row.push('-'); return; }
        if (r.status === 'present') { row.push('x'); present++; }
        else { row.push('o'); absent++; }
      });
      row.push(present, absent);
      cd.push(row);
    });
    sheets.push({ name: d.info.name, data: cd });
  }

  return sheets;
}

async function buildEmulationData(supabase: any, schoolId: string, schoolName: string, year: number, month: number) {
  const { data: classes } = await supabase.from('classes').select('id, name, grade')
    .eq('school_id', schoolId).eq('is_active', true).order('grade').order('name');
  
  // Get week settings that overlap with the month
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  
  const { data: weeks } = await supabase.from('week_settings').select('*')
    .eq('school_id', schoolId).lte('start_date', monthEnd).gte('end_date', monthStart)
    .order('week_number');

  const { data: scores } = await supabase.from('emulation_scores').select('*')
    .eq('school_id', schoolId);

  const sheets: { name: string; data: (string | number)[][] }[] = [];

  // Summary sheet with all weeks
  const summary: (string | number)[][] = [
    [`THI ĐUA - Tháng ${month}/${year}`],
    [`Trường: ${schoolName}`],
    [`Cập nhật: ${new Date().toLocaleString('vi-VN')}`],
    [],
    ['STT', 'Lớp', 'Khối'],
  ];

  // Add week columns
  (weeks || []).forEach((w: any) => {
    summary[4].push(`Tuần ${w.week_number}`);
  });
  summary[4].push('TB', 'Xếp hạng');

  (classes || []).forEach((cls: any, i: number) => {
    const row: (string | number)[] = [i + 1, cls.name, cls.grade];
    let totalScore = 0, weekCount = 0;
    (weeks || []).forEach((w: any) => {
      const score = (scores || []).find((s: any) => s.class_id === cls.id && s.week_number === w.week_number);
      if (score) {
        const total = (score.academic_score || 0) + (score.discipline_score || 0) + (score.boarding_score || 0);
        row.push(total);
        totalScore += total;
        weekCount++;
      } else {
        row.push('');
      }
    });
    row.push(weekCount > 0 ? +(totalScore / weekCount).toFixed(1) : '', '');
    summary.push(row);
  });

  sheets.push({ name: 'Tổng hợp', data: summary });

  // Detail per week
  (weeks || []).forEach((w: any) => {
    const wd: (string | number)[][] = [
      [`TUẦN ${w.week_number} (${w.start_date} - ${w.end_date})`],
      [],
      ['STT', 'Lớp', 'Học tập', 'Nề nếp', 'Nội trú', 'Tổng', 'Ghi chú'],
    ];
    (classes || []).forEach((cls: any, i: number) => {
      const score = (scores || []).find((s: any) => s.class_id === cls.id && s.week_number === w.week_number);
      const a = score?.academic_score || 0;
      const d = score?.discipline_score || 0;
      const b = score?.boarding_score || 0;
      wd.push([i + 1, cls.name, a, d, b, a + d + b, score?.notes || '']);
    });
    sheets.push({ name: `Tuần ${w.week_number}`, data: wd });
  });

  return sheets;
}

async function buildDutyData(supabase: any, schoolId: string, schoolName: string, year: number, month: number) {
  const days = getDaysInMonth(year, month);
  const startDate = fmtISO(days[0]);
  const endDate = fmtISO(days[days.length - 1]);

  const { data: dutyMembers } = await supabase.from('duty_members').select('user_id, profiles:user_id(id, full_name, gender)')
    .eq('school_id', schoolId);
  const { data: schedules } = await supabase.from('duty_schedules').select('*')
    .eq('school_id', schoolId).gte('duty_date', startDate).lte('duty_date', endDate);

  const members = (dutyMembers || []).map((dm: any) => dm.profiles).filter(Boolean)
    .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name, 'vi'));

  const sheets: { name: string; data: (string | number)[][] }[] = [];

  // Assignment sheet
  const assign: (string | number)[][] = [
    [`BẢNG PHÂN CÔNG TRỰC - Tháng ${month}/${year}`],
    [`Trường: ${schoolName}`],
    [],
  ];
  const hdr: (string | number)[] = ['STT', 'Họ tên', 'GT'];
  days.forEach(d => hdr.push(`${fmtDate(d).split('/')[0]}/${dayLabels[d.getDay()]}`));
  hdr.push('Tổng');
  assign.push(hdr);

  members.forEach((m: any, i: number) => {
    const row: (string | number)[] = [i + 1, m.full_name, m.gender === 'male' ? 'Nam' : m.gender === 'female' ? 'Nữ' : ''];
    let total = 0;
    days.forEach(d => {
      const ds = fmtISO(d);
      const assigned = (schedules || []).some((s: any) => s.user_id === m.id && s.duty_date === ds);
      row.push(assigned ? '✓' : '');
      if (assigned) total++;
    });
    row.push(total);
    assign.push(row);
  });

  // Totals row
  const totRow: (string | number)[] = ['', 'Tổng/ngày', ''];
  let grand = 0;
  days.forEach(d => {
    const ds = fmtISO(d);
    const count = (schedules || []).filter((s: any) => s.duty_date === ds).length;
    totRow.push(count || '');
    grand += count;
  });
  totRow.push(grand);
  assign.push(totRow);
  sheets.push({ name: 'Phân công', data: assign });

  // Statistics sheet
  const stats: (string | number)[][] = [
    [`THỐNG KÊ LỊCH TRỰC - Tháng ${month}/${year}`],
    [],
    ['STT', 'Họ tên', 'GT', 'Tổng', 'Ngày thường', 'T7', 'CN', 'Cuối tuần'],
  ];

  const memberStats = members.map((m: any) => {
    const ms = (schedules || []).filter((s: any) => s.user_id === m.id);
    let wd = 0, sat = 0, sun = 0;
    ms.forEach((s: any) => {
      const dow = new Date(s.duty_date).getDay();
      if (dow === 6) sat++;
      else if (dow === 0) sun++;
      else wd++;
    });
    return { ...m, total: ms.length, wd, sat, sun, weekend: sat + sun };
  }).sort((a: any, b: any) => b.total - a.total);

  memberStats.forEach((m: any, i: number) => {
    stats.push([i + 1, m.full_name, m.gender === 'male' ? 'Nam' : m.gender === 'female' ? 'Nữ' : '', m.total, m.wd, m.sat, m.sun, m.weekend]);
  });

  const tAll = memberStats.reduce((s: number, m: any) => s + m.total, 0);
  const tWd = memberStats.reduce((s: number, m: any) => s + m.wd, 0);
  const tSat = memberStats.reduce((s: number, m: any) => s + m.sat, 0);
  const tSun = memberStats.reduce((s: number, m: any) => s + m.sun, 0);
  const tWe = memberStats.reduce((s: number, m: any) => s + m.weekend, 0);
  stats.push(['', 'TỔNG CỘNG', `${memberStats.length} người`, tAll, tWd, tSat, tSun, tWe]);
  sheets.push({ name: 'Thống kê', data: stats });

  return sheets;
}

async function buildKitchenData(supabase: any, schoolId: string, schoolName: string, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  const { data: transactions } = await supabase.from('kitchen_transactions').select('*')
    .eq('school_id', schoolId).gte('transaction_date', startDate).lte('transaction_date', endDate)
    .order('transaction_date');

  const sheets: { name: string; data: (string | number)[][] }[] = [];

  // Import sheet
  const imports = (transactions || []).filter((t: any) => t.transaction_type === 'import');
  const importData: (string | number)[][] = [
    [`NHẬP KHO BẾP - Tháng ${month}/${year}`],
    [`Trường: ${schoolName}`],
    [],
    ['STT', 'Ngày', 'Tên hàng', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền', 'NCC', 'Ghi chú'],
  ];
  let importTotal = 0;
  imports.forEach((t: any, i: number) => {
    const total = t.quantity * t.unit_price;
    importTotal += total;
    importData.push([i + 1, t.transaction_date, t.item_name, t.unit, t.quantity, t.unit_price, total, t.supplier || '', t.notes || '']);
  });
  importData.push(['', '', '', '', '', '', importTotal, '', '']);
  sheets.push({ name: 'Nhập kho', data: importData });

  // Export sheet
  const exports = (transactions || []).filter((t: any) => t.transaction_type === 'export');
  const exportData: (string | number)[][] = [
    [`XUẤT KHO BẾP - Tháng ${month}/${year}`],
    [`Trường: ${schoolName}`],
    [],
    ['STT', 'Ngày', 'Tên hàng', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền', 'Ghi chú'],
  ];
  let exportTotal = 0;
  exports.forEach((t: any, i: number) => {
    const total = t.quantity * t.unit_price;
    exportTotal += total;
    exportData.push([i + 1, t.transaction_date, t.item_name, t.unit, t.quantity, t.unit_price, total, t.notes || '']);
  });
  exportData.push(['', '', '', '', '', '', exportTotal, '']);
  sheets.push({ name: 'Xuất kho', data: exportData });

  return sheets;
}

async function buildHealthData(supabase: any, schoolId: string, schoolName: string, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  const { data: records } = await supabase.from('health_records').select(`
    *, students:student_id(full_name, class_id, classes:class_id(name))
  `).eq('school_id', schoolId)
    .gte('record_date', startDate).lte('record_date', endDate)
    .is('deleted_at', null)
    .order('record_date');

  const treatmentMap: Record<string, string> = {
    medicine: 'Cấp thuốc',
    first_aid: 'Sơ cứu',
    hospital: 'Chuyển viện',
  };

  const data: (string | number)[][] = [
    [`BÁO CÁO Y TẾ - Tháng ${month}/${year}`],
    [`Trường: ${schoolName}`],
    [`Cập nhật: ${new Date().toLocaleString('vi-VN')}`],
    [],
    ['STT', 'Ngày', 'Họ tên', 'Lớp', 'Chuẩn đoán', 'Xử lý', 'Ghi chú'],
  ];

  (records || []).forEach((r: any, i: number) => {
    const student = r.students;
    const className = student?.classes?.name || '';
    data.push([
      i + 1, r.record_date, student?.full_name || '', className,
      r.diagnosis, treatmentMap[r.treatment_type] || r.treatment_type,
      r.notes || '',
    ]);
  });

  data.push([]);
  data.push([`Tổng: ${(records || []).length} ca`]);

  return [{ name: `Tháng ${month}`, data }];
}

// ===== Main Handler =====
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body: SyncRequest = await req.json();
    const { school_id, report_type, year, month } = body;

    if (!school_id || !report_type || !year || !month) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Read Google Drive config from school's sheets_sync_config (using service role to bypass RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: syncConfig } = await adminClient
      .from('sheets_sync_config')
      .select('google_service_account_key, google_drive_folder_id')
      .eq('school_id', school_id)
      .maybeSingle();

    // Fallback to env vars if not in DB
    const serviceAccountKey = syncConfig?.google_service_account_key || Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    const parentFolderId = syncConfig?.google_drive_folder_id || Deno.env.get('GOOGLE_DRIVE_FOLDER_ID');

    if (!serviceAccountKey) {
      return new Response(JSON.stringify({ error: 'Chưa cấu hình Google Service Account Key. Vào Cài đặt → Google Sheets để thiết lập.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!parentFolderId) {
      return new Response(JSON.stringify({ error: 'Chưa cấu hình Google Drive Folder ID. Vào Cài đặt → Google Sheets để thiết lập.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const credentials: ServiceAccountCredentials = JSON.parse(serviceAccountKey);

    const { data: school } = await supabase.from('schools').select('name').eq('id', school_id).single();
    if (!school) throw new Error('School not found');

    const accessToken = await getAccessToken(credentials);

    // Find or create "Nội trú bán trú" folder
    const reportFolderId = await findOrCreateFolder(accessToken, parentFolderId, 'Nội trú bán trú');

    const typesToSync: ReportType[] = report_type === 'all'
      ? ['meal_attendance', 'evening_study', 'boarding', 'emulation', 'duty', 'kitchen', 'health']
      : [report_type];

    const results: { type: string; spreadsheetUrl: string }[] = [];

    for (const rt of typesToSync) {
      console.log(`Syncing ${rt}...`);

      // Build sheets data
      let sheetsData: { name: string; data: (string | number)[][] }[] = [];
      switch (rt) {
        case 'meal_attendance':
          sheetsData = await buildMealData(supabase, school_id, school.name, year, month);
          break;
        case 'evening_study':
        case 'boarding':
          sheetsData = await buildAttendanceData(supabase, school_id, school.name, year, month, rt);
          break;
        case 'emulation':
          sheetsData = await buildEmulationData(supabase, school_id, school.name, year, month);
          break;
        case 'duty':
          sheetsData = await buildDutyData(supabase, school_id, school.name, year, month);
          break;
        case 'kitchen':
          sheetsData = await buildKitchenData(supabase, school_id, school.name, year, month);
          break;
        case 'health':
          sheetsData = await buildHealthData(supabase, school_id, school.name, year, month);
          break;
      }

      if (sheetsData.length === 0) continue;

      // Check existing spreadsheet for this report type
      const { data: existing } = await supabase.from('report_spreadsheets')
        .select('spreadsheet_id').eq('school_id', school_id).eq('report_type', rt).maybeSingle();

      let spreadsheetId: string;
      
      if (existing?.spreadsheet_id) {
        // Verify it still exists
        try {
          const checkResp = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${existing.spreadsheet_id}?fields=spreadsheetId`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          if (checkResp.ok) {
            spreadsheetId = existing.spreadsheet_id;
          } else {
            spreadsheetId = await createSpreadsheet(accessToken, `${school.name} - ${REPORT_LABELS[rt]}`, reportFolderId);
          }
        } catch {
          spreadsheetId = await createSpreadsheet(accessToken, `${school.name} - ${REPORT_LABELS[rt]}`, reportFolderId);
        }
      } else {
        spreadsheetId = await createSpreadsheet(accessToken, `${school.name} - ${REPORT_LABELS[rt]}`, reportFolderId);
      }

      // Setup sheets and write data
      const sheetNames = sheetsData.map(s => s.name);
      await setupSheets(accessToken, spreadsheetId, sheetNames);

      for (const sheet of sheetsData) {
        await updateSheet(accessToken, spreadsheetId, sheet.name, sheet.data);
      }

      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      // Upsert tracking record
      await supabase.from('report_spreadsheets').upsert({
        school_id,
        report_type: rt,
        spreadsheet_id: spreadsheetId,
        spreadsheet_url: spreadsheetUrl,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'school_id,report_type' });

      results.push({ type: rt, spreadsheetUrl });
      console.log(`Done syncing ${rt}: ${spreadsheetUrl}`);
    }

    return new Response(
      JSON.stringify({ success: true, results, message: `Đã đồng bộ ${results.length} loại báo cáo` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
