import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

interface SyncRequest {
  school_id: string;
  year: number;
  month: number;
}

// ============ Google Auth ============
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

// ============ Drive helpers ============
async function findOrCreateSubfolder(
  accessToken: string,
  parentFolderId: string,
  folderName: string
): Promise<string> {
  const safeName = folderName.replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and name='${safeName}' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  if (!searchRes.ok) throw new Error(`Failed to search folder: ${await searchRes.text()}`);
  const searchData = await searchRes.json();
  if (searchData.files?.length > 0) return searchData.files[0].id;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  });
  if (!createRes.ok) throw new Error(`Failed to create subfolder: ${await createRes.text()}`);
  return (await createRes.json()).id;
}

async function createSpreadsheetInFolder(
  accessToken: string, title: string, folderId: string
): Promise<string> {
  const response = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId]
    }),
  });
  if (!response.ok) throw new Error(`Failed to create spreadsheet in folder: ${await response.text()}`);
  return (await response.json()).id;
}

// ============ Sheets helpers ============
async function addSheetsAndGetIds(
  accessToken: string, spreadsheetId: string, sheetNames: string[]
): Promise<Map<string, number>> {
  const getResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  if (!getResponse.ok) throw new Error(`Failed to get spreadsheet info: ${await getResponse.text()}`);
  const spreadsheet = await getResponse.json();
  const existing = spreadsheet.sheets || [];

  const requests: any[] = [];
  const sheet1 = existing.find((s: any) => s.properties.title === 'Sheet1');
  if (sheet1 && sheetNames.length > 0) {
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: sheet1.properties.sheetId, title: sheetNames[0] },
        fields: 'title'
      }
    });
  }
  for (let i = 1; i < sheetNames.length; i++) {
    requests.push({ addSheet: { properties: { title: sheetNames[i], index: i } } });
  }
  if (requests.length > 0) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      }
    );
    if (!res.ok) throw new Error(`Failed to add sheets: ${await res.text()}`);
  }
  // Fetch again to get final ids
  const refetch = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  const data = await refetch.json();
  const map = new Map<string, number>();
  for (const s of data.sheets) map.set(s.properties.title, s.properties.sheetId);
  return map;
}

async function updateSheetValues(
  accessToken: string, spreadsheetId: string, sheetName: string, values: (string | number)[][]
): Promise<void> {
  const range = `'${sheetName}'!A1`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  );
  if (!response.ok) throw new Error(`Failed to update sheet ${sheetName}: ${await response.text()}`);
}

async function batchFormat(accessToken: string, spreadsheetId: string, requests: any[]) {
  if (requests.length === 0) return;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    }
  );
  if (!res.ok) throw new Error(`Failed to format: ${await res.text()}`);
}

// ============ Formatting helpers ============
const COLOR_HEADER_BG = { red: 0.082, green: 0.396, blue: 0.753 }; // #1565C0
const COLOR_WHITE = { red: 1, green: 1, blue: 1 };
const COLOR_TITLE_BG = { red: 0.902, green: 0.941, blue: 0.996 }; // very light blue
const COLOR_TOTALS_BG = { red: 1, green: 0.953, blue: 0.878 }; // #FFF3E0 light orange
const COLOR_BANDING = { red: 0.910, green: 0.957, blue: 0.992 }; // #E8F4FD
const COLOR_BORDER = { red: 0.741, green: 0.741, blue: 0.741 };
const COLOR_SECTION_BG = { red: 0.878, green: 0.925, blue: 0.988 };

function borderAll() {
  const b = { style: 'SOLID', color: COLOR_BORDER };
  return { top: b, bottom: b, left: b, right: b };
}

interface SectionFormat {
  sectionHeaderRow?: number;   // section title row (e.g. "BÁO CÁO BỮA ĂN")
  headerRow: number;           // column headers row
  dataStartRow: number;        // first data row (0-indexed)
  dataEndRow: number;          // last data row (0-indexed, inclusive)
  totalsRow?: number;
  numCols: number;
}

function buildSheetFormatRequests(
  sheetId: number, totalCols: number, titleRow: number, sections: SectionFormat[],
  freezeRows: number
): any[] {
  const reqs: any[] = [];

  // Base font: Arial 10, wrap
  reqs.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 500, startColumnIndex: 0, endColumnIndex: totalCols },
      cell: { userEnteredFormat: { textFormat: { fontFamily: 'Arial', fontSize: 10 }, verticalAlignment: 'MIDDLE' } },
      fields: 'userEnteredFormat.textFormat.fontFamily,userEnteredFormat.textFormat.fontSize,userEnteredFormat.verticalAlignment',
    },
  });

  // Title row: merge, bold, size 14, centered, light bg
  reqs.push({
    mergeCells: {
      range: { sheetId, startRowIndex: titleRow, endRowIndex: titleRow + 1, startColumnIndex: 0, endColumnIndex: totalCols },
      mergeType: 'MERGE_ALL',
    },
  });
  reqs.push({
    repeatCell: {
      range: { sheetId, startRowIndex: titleRow, endRowIndex: titleRow + 1, startColumnIndex: 0, endColumnIndex: totalCols },
      cell: {
        userEnteredFormat: {
          backgroundColor: COLOR_TITLE_BG,
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          textFormat: { fontFamily: 'Arial', fontSize: 14, bold: true, foregroundColor: COLOR_HEADER_BG },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
    },
  });
  // Set title row height
  reqs.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: titleRow, endIndex: titleRow + 1 },
      properties: { pixelSize: 34 }, fields: 'pixelSize',
    },
  });

  for (const sec of sections) {
    // Section title (e.g. "BÁO CÁO BỮA ĂN")
    if (sec.sectionHeaderRow !== undefined) {
      reqs.push({
        mergeCells: {
          range: { sheetId, startRowIndex: sec.sectionHeaderRow, endRowIndex: sec.sectionHeaderRow + 1, startColumnIndex: 0, endColumnIndex: sec.numCols },
          mergeType: 'MERGE_ALL',
        },
      });
      reqs.push({
        repeatCell: {
          range: { sheetId, startRowIndex: sec.sectionHeaderRow, endRowIndex: sec.sectionHeaderRow + 1, startColumnIndex: 0, endColumnIndex: sec.numCols },
          cell: {
            userEnteredFormat: {
              backgroundColor: COLOR_SECTION_BG,
              horizontalAlignment: 'CENTER',
              textFormat: { fontFamily: 'Arial', fontSize: 11, bold: true, foregroundColor: COLOR_HEADER_BG },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)',
        },
      });
    }

    // Column header row
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: sec.headerRow, endRowIndex: sec.headerRow + 1, startColumnIndex: 0, endColumnIndex: sec.numCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLOR_HEADER_BG,
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
            textFormat: { fontFamily: 'Arial', fontSize: 10, bold: true, foregroundColor: COLOR_WHITE },
            borders: borderAll(),
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat,borders)',
      },
    });
    reqs.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: sec.headerRow, endIndex: sec.headerRow + 1 },
        properties: { pixelSize: 32 }, fields: 'pixelSize',
      },
    });

    // Data rows: borders, center align
    if (sec.dataEndRow >= sec.dataStartRow) {
      reqs.push({
        repeatCell: {
          range: { sheetId, startRowIndex: sec.dataStartRow, endRowIndex: sec.dataEndRow + 1, startColumnIndex: 0, endColumnIndex: sec.numCols },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
              textFormat: { fontFamily: 'Arial', fontSize: 10 },
              borders: borderAll(),
            },
          },
          fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat,borders)',
        },
      });
      // Banding
      reqs.push({
        addBanding: {
          bandedRange: {
            range: { sheetId, startRowIndex: sec.dataStartRow, endRowIndex: sec.dataEndRow + 1, startColumnIndex: 0, endColumnIndex: sec.numCols },
            rowProperties: {
              headerColor: null,
              firstBandColor: COLOR_WHITE,
              secondBandColor: COLOR_BANDING,
            },
          },
        },
      });
    }

    // Totals row
    if (sec.totalsRow !== undefined) {
      reqs.push({
        repeatCell: {
          range: { sheetId, startRowIndex: sec.totalsRow, endRowIndex: sec.totalsRow + 1, startColumnIndex: 0, endColumnIndex: sec.numCols },
          cell: {
            userEnteredFormat: {
              backgroundColor: COLOR_TOTALS_BG,
              horizontalAlignment: 'CENTER',
              textFormat: { fontFamily: 'Arial', fontSize: 10, bold: true },
              borders: borderAll(),
            },
          },
          fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,textFormat,borders)',
        },
      });
    }
  }

  // Freeze rows
  if (freezeRows > 0) {
    reqs.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: freezeRows } },
        fields: 'gridProperties.frozenRowCount',
      },
    });
  }

  // Auto-resize all columns
  reqs.push({
    autoResizeDimensions: {
      dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: totalCols },
    },
  });

  return reqs;
}

// ============ Date helpers ============
function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const endDate = new Date(year, month, 0);
  for (let d = new Date(year, month - 1, 1); d <= endDate; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}
function formatDate(date: Date): string {
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}
function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============ Handler ============
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body: SyncRequest = await req.json();
    const { school_id, year, month } = body;
    if (!school_id || !year || !month) {
      return new Response(JSON.stringify({ error: 'Missing required fields: school_id, year, month' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: syncConfig } = await adminClient
      .from('sheets_sync_config')
      .select('google_service_account_key, google_drive_folder_id')
      .eq('school_id', school_id).maybeSingle();

    const serviceAccountKey = syncConfig?.google_service_account_key || Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    const rootFolderId = syncConfig?.google_drive_folder_id || Deno.env.get('GOOGLE_DRIVE_FOLDER_ID');
    if (!serviceAccountKey) {
      return new Response(JSON.stringify({ error: 'Chưa cấu hình Google Service Account Key. Vào Cài đặt → Google Sheets để thiết lập.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!rootFolderId) {
      return new Response(JSON.stringify({ error: 'Chưa cấu hình Google Drive Folder ID. Vào Cài đặt → Google Sheets để thiết lập.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const credentials: ServiceAccountCredentials = JSON.parse(serviceAccountKey);

    const { data: school, error: schoolError } = await supabase
      .from('schools').select('name').eq('id', school_id).single();
    if (schoolError || !school) throw new Error('School not found');

    const { data: classes, error: classesError } = await supabase
      .from('classes').select('id, name, grade')
      .eq('school_id', school_id).eq('is_active', true)
      .order('grade', { ascending: true }).order('name', { ascending: true });
    if (classesError) throw classesError;

    const { data: students, error: studentsError } = await supabase
      .from('students').select('id, full_name, class_id, room_number, meal_group')
      .eq('school_id', school_id).eq('is_active', true);
    if (studentsError) throw studentsError;

    const days = getDaysInMonth(year, month);
    const startDate = formatDateISO(days[0]);
    const endDate = formatDateISO(days[days.length - 1]);

    const { data: mealRecords, error: mealError } = await supabase
      .from('attendance_records').select('*')
      .eq('school_id', school_id)
      .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
      .gte('attendance_date', startDate).lte('attendance_date', endDate)
      .limit(100000);
    if (mealError) throw mealError;

    const { data: otherRecords, error: otherError } = await supabase
      .from('attendance_records').select('*')
      .eq('school_id', school_id)
      .in('attendance_type', ['boarding', 'evening_study'])
      .gte('attendance_date', startDate).lte('attendance_date', endDate)
      .limit(100000);
    if (otherError) throw otherError;

    const mealLatest = new Map<string, any>();
    (mealRecords || []).forEach((r: any) => {
      const key = `${r.student_id}-${r.attendance_date}-${r.attendance_type}`;
      const ex = mealLatest.get(key);
      if (!ex || new Date(r.created_at) > new Date(ex.created_at)) mealLatest.set(key, r);
    });
    const otherLatest = new Map<string, any>();
    (otherRecords || []).forEach((r: any) => {
      const key = `${r.student_id}-${r.attendance_date}-${r.attendance_type}`;
      const ex = otherLatest.get(key);
      if (!ex || new Date(r.created_at) > new Date(ex.created_at)) otherLatest.set(key, r);
    });

    const classStudents = new Map<string, { classInfo: any; students: any[] }>();
    classes?.forEach(c => classStudents.set(c.id, { classInfo: c, students: [] }));
    students?.forEach(s => {
      if (s.class_id && classStudents.has(s.class_id)) {
        classStudents.get(s.class_id)!.students.push(s);
      }
    });
    const sortedClasses = Array.from(classStudents.entries())
      .filter(([_, d]) => d.students.length > 0)
      .sort((a, b) => {
        const g = a[1].classInfo.grade - b[1].classInfo.grade;
        return g !== 0 ? g : a[1].classInfo.name.localeCompare(b[1].classInfo.name, 'vi');
      });

    const accessToken = await getAccessToken(credentials);

    // === Split by school: create/reuse a subfolder named after the school ===
    const schoolFolderId = await findOrCreateSubfolder(accessToken, rootFolderId, school.name);
    console.log(`School folder: ${school.name} => ${schoolFolderId}`);

    const sheetNames = ['Toàn trường', ...sortedClasses.map(([_, d]) => d.classInfo.name)];
    const spreadsheetTitle = `${school.name} - Báo cáo Tháng ${month}/${year}`;
    const spreadsheetId = await createSpreadsheetInFolder(accessToken, spreadsheetTitle, schoolFolderId);
    console.log(`Created spreadsheet: ${spreadsheetId}`);

    const sheetIds = await addSheetsAndGetIds(accessToken, spreadsheetId, sheetNames);

    const formatRequests: any[] = [];

    // ========== SHEET 1: Toàn trường ==========
    {
      const rows: (string | number)[][] = [];
      // 0: title, 1: subtitle school, 2: date, 3: empty, 4: header
      rows.push([`THỐNG KÊ BỮA ĂN TOÀN TRƯỜNG - THÁNG ${String(month).padStart(2, '0')}/${year}`]);
      rows.push([`Trường: ${school.name}`]);
      rows.push([`Ngày xuất: ${new Date().toLocaleString('vi-VN')}`]);
      rows.push([]);
      const header: (string | number)[] = ['Ngày'];
      sortedClasses.forEach(([_, d]) => header.push(`${d.classInfo.name} S`, `${d.classInfo.name} T`, `${d.classInfo.name} C`));
      header.push('Tổng S', 'Tổng T', 'Tổng C', 'Gạo (kg)');
      rows.push(header);

      const headerRowIdx = 4;
      const dataStart = 5;
      let gB = 0, gL = 0, gD = 0;

      days.forEach(day => {
        const dateStr = formatDateISO(day);
        const row: (string | number)[] = [formatDate(day)];
        let dB = 0, dL = 0, dD = 0;
        sortedClasses.forEach(([_, d]) => {
          let cB = 0, cL = 0, cDn = 0;
          d.students.forEach(st => {
            if (mealLatest.get(`${st.id}-${dateStr}-breakfast`)?.status === 'present') cB++;
            if (mealLatest.get(`${st.id}-${dateStr}-lunch`)?.status === 'present') cL++;
            if (mealLatest.get(`${st.id}-${dateStr}-dinner`)?.status === 'present') cDn++;
          });
          row.push(cB, cL, cDn); dB += cB; dL += cL; dD += cDn;
        });
        const dayRice = (dL + dD) * 0.2;
        row.push(dB, dL, dD, Number(dayRice.toFixed(1)));
        gB += dB; gL += dL; gD += dD;
        rows.push(row);
      });
      const dataEnd = rows.length - 1;

      // totals
      const totalsRow: (string | number)[] = ['TỔNG CỘNG'];
      sortedClasses.forEach(([_, d]) => {
        let cB = 0, cL = 0, cDn = 0;
        days.forEach(day => {
          const dateStr = formatDateISO(day);
          d.students.forEach(st => {
            if (mealLatest.get(`${st.id}-${dateStr}-breakfast`)?.status === 'present') cB++;
            if (mealLatest.get(`${st.id}-${dateStr}-lunch`)?.status === 'present') cL++;
            if (mealLatest.get(`${st.id}-${dateStr}-dinner`)?.status === 'present') cDn++;
          });
        });
        totalsRow.push(cB, cL, cDn);
      });
      totalsRow.push(gB, gL, gD, Number(((gL + gD) * 0.2).toFixed(1)));
      rows.push(totalsRow);
      const totalsRowIdx = rows.length - 1;

      await updateSheetValues(accessToken, spreadsheetId, 'Toàn trường', rows);

      const sheetId = sheetIds.get('Toàn trường')!;
      const numCols = header.length;
      formatRequests.push(...buildSheetFormatRequests(
        sheetId, numCols, 0,
        [{ headerRow: headerRowIdx, dataStartRow: dataStart, dataEndRow: dataEnd, totalsRow: totalsRowIdx, numCols }],
        5
      ));
    }

    // ========== Per-class sheets ==========
    for (const [_classId, data] of sortedClasses) {
      const className = data.classInfo.name;
      const rows: (string | number)[][] = [];

      rows.push([`THỐNG KÊ LỚP ${className} - THÁNG ${String(month).padStart(2, '0')}/${year}`]);
      rows.push([`Sĩ số: ${data.students.length} học sinh`]);
      rows.push([]);

      // Section 1: Meal
      rows.push(['BÁO CÁO BỮA ĂN']);
      const sec1HeaderRow = rows.length;
      const mealHeader: (string | number)[] = ['STT', 'Họ tên', 'Phòng', 'Mâm'];
      days.forEach(day => mealHeader.push(formatDate(day).split('/')[0]));
      mealHeader.push('Sáng', 'Trưa', 'Tối', 'Gạo (kg)');
      rows.push(mealHeader);

      const sec1DataStart = rows.length;
      data.students.sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
      data.students.forEach((student, idx) => {
        const row: (string | number)[] = [idx + 1, student.full_name, student.room_number || '', student.meal_group || ''];
        let tB = 0, tL = 0, tD = 0;
        days.forEach(day => {
          const dateStr = formatDateISO(day);
          const b = mealLatest.get(`${student.id}-${dateStr}-breakfast`);
          const l = mealLatest.get(`${student.id}-${dateStr}-lunch`);
          const d = mealLatest.get(`${student.id}-${dateStr}-dinner`);
          if (!b && !l && !d) { row.push('-'); return; }
          const bC = !b ? '-' : (b.status === 'present' ? 'x' : 'o');
          const lC = !l ? '-' : (l.status === 'present' ? 'x' : 'o');
          const dC = !d ? '-' : (d.status === 'present' ? 'x' : 'o');
          if (b?.status === 'present') tB++;
          if (l?.status === 'present') tL++;
          if (d?.status === 'present') tD++;
          row.push(`${bC}${lC}${dC}`);
        });
        row.push(tB, tL, tD, Number(((tL + tD) * 0.2).toFixed(1)));
        rows.push(row);
      });
      const sec1DataEnd = rows.length - 1;

      const mealTotals: (string | number)[] = ['', 'TỔNG', '', ''];
      let ctB = 0, ctL = 0, ctD = 0;
      days.forEach(day => {
        const dateStr = formatDateISO(day);
        let dB = 0, dL = 0, dD = 0;
        data.students.forEach(st => {
          if (mealLatest.get(`${st.id}-${dateStr}-breakfast`)?.status === 'present') dB++;
          if (mealLatest.get(`${st.id}-${dateStr}-lunch`)?.status === 'present') dL++;
          if (mealLatest.get(`${st.id}-${dateStr}-dinner`)?.status === 'present') dD++;
        });
        ctB += dB; ctL += dL; ctD += dD;
        mealTotals.push(`${dB}/${dL}/${dD}`);
      });
      mealTotals.push(ctB, ctL, ctD, Number(((ctL + ctD) * 0.2).toFixed(1)));
      rows.push(mealTotals);
      const sec1TotalsRow = rows.length - 1;

      rows.push([]);
      rows.push(['Ghi chú: x = ăn, o = vắng, - = chưa báo cáo. Mỗi ô: Sáng/Trưa/Tối']);

      // Section 2: Boarding / Evening study
      rows.push([]);
      rows.push(['BÁO CÁO NỘI TRÚ / TỰ HỌC TỐI']);
      const sec2SectionRow = rows.length - 1;
      const sec2HeaderRow = rows.length;
      const otherHeader: (string | number)[] = ['STT', 'Họ tên'];
      days.forEach(day => otherHeader.push(formatDate(day).split('/')[0]));
      otherHeader.push('Nội trú', 'Tự học');
      rows.push(otherHeader);

      const sec2DataStart = rows.length;
      data.students.forEach((student, idx) => {
        const row: (string | number)[] = [idx + 1, student.full_name];
        let tBrd = 0, tEve = 0;
        days.forEach(day => {
          const dateStr = formatDateISO(day);
          const b = otherLatest.get(`${student.id}-${dateStr}-boarding`);
          const e = otherLatest.get(`${student.id}-${dateStr}-evening_study`);
          if (!b && !e) { row.push('-'); return; }
          const bC = !b ? '-' : (b.status === 'present' ? 'x' : 'o');
          const eC = !e ? '-' : (e.status === 'present' ? 'x' : 'o');
          if (b?.status === 'present') tBrd++;
          if (e?.status === 'present') tEve++;
          row.push(`${bC}/${eC}`);
        });
        row.push(tBrd, tEve);
        rows.push(row);
      });
      const sec2DataEnd = rows.length - 1;

      const otherTotals: (string | number)[] = ['', 'TỔNG'];
      let ctBrd = 0, ctEve = 0;
      days.forEach(day => {
        const dateStr = formatDateISO(day);
        let dB = 0, dE = 0;
        data.students.forEach(st => {
          if (otherLatest.get(`${st.id}-${dateStr}-boarding`)?.status === 'present') dB++;
          if (otherLatest.get(`${st.id}-${dateStr}-evening_study`)?.status === 'present') dE++;
        });
        ctBrd += dB; ctEve += dE;
        otherTotals.push(`${dB}/${dE}`);
      });
      otherTotals.push(ctBrd, ctEve);
      rows.push(otherTotals);
      const sec2TotalsRow = rows.length - 1;

      rows.push([]);
      rows.push(['Ghi chú: x = có mặt, o = vắng, - = chưa báo cáo. Mỗi ô: Nội trú/Tự học']);

      await updateSheetValues(accessToken, spreadsheetId, className, rows);

      const sheetId = sheetIds.get(className)!;
      const totalCols = Math.max(mealHeader.length, otherHeader.length);
      formatRequests.push(...buildSheetFormatRequests(
        sheetId, totalCols, 0,
        [
          { sectionHeaderRow: 3, headerRow: sec1HeaderRow, dataStartRow: sec1DataStart, dataEndRow: sec1DataEnd, totalsRow: sec1TotalsRow, numCols: mealHeader.length },
          { sectionHeaderRow: sec2SectionRow, headerRow: sec2HeaderRow, dataStartRow: sec2DataStart, dataEndRow: sec2DataEnd, totalsRow: sec2TotalsRow, numCols: otherHeader.length },
        ],
        sec1HeaderRow + 1
      ));
      console.log(`Updated: ${className}`);
    }

    // Apply all formatting in one batch (chunked to avoid huge payloads)
    const CHUNK = 200;
    for (let i = 0; i < formatRequests.length; i += CHUNK) {
      await batchFormat(accessToken, spreadsheetId, formatRequests.slice(i, i + CHUNK));
    }

    await supabase
      .from('sheets_sync_config')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: `Đã tạo báo cáo Tháng ${month}/${year} (${sortedClasses.length + 1} sheet) trong thư mục "${school.name}"`
      })
      .eq('school_id', school_id);

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    return new Response(
      JSON.stringify({
        success: true,
        spreadsheetId, spreadsheetUrl,
        message: `Đã tạo báo cáo Tháng ${month}/${year} (${sortedClasses.length + 1} sheet) trong thư mục "${school.name}"`,
        sheetsCreated: sortedClasses.length + 1,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
