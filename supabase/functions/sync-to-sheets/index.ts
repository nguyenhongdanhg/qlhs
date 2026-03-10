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
  data_type: 'emulation' | 'meal_attendance' | 'evening_study' | 'boarding';
  week_number?: number;
  date?: string;
  sheet_name?: string;
}

// Generate JWT for Google API authentication
async function createJWT(credentials: ServiceAccountCredentials): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: credentials.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key and sign
  const pemContents = credentials.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${signatureB64}`;
}

// Get access token from Google
async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const jwt = await createJWT(credentials);
  
  const response = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Get spreadsheet info to check existing sheets
async function getSpreadsheetInfo(accessToken: string, spreadsheetId: string): Promise<string[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get spreadsheet info: ${error}`);
  }

  const data = await response.json();
  return data.sheets?.map((s: { properties: { title: string } }) => s.properties.title) || [];
}

// Create a new sheet tab
async function createSheet(accessToken: string, spreadsheetId: string, sheetName: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{
        addSheet: {
          properties: { title: sheetName }
        }
      }]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    // Ignore error if sheet already exists
    if (!error.includes('already exists')) {
      throw new Error(`Failed to create sheet: ${error}`);
    }
  }
}

// Ensure sheet exists, create if not
async function ensureSheetExists(accessToken: string, spreadsheetId: string, sheetName: string): Promise<void> {
  const existingSheets = await getSpreadsheetInfo(accessToken, spreadsheetId);
  
  if (!existingSheets.includes(sheetName)) {
    console.log(`Creating sheet: ${sheetName}`);
    await createSheet(accessToken, spreadsheetId, sheetName);
  }
}

// Append data to Google Sheets
async function appendToSheet(
  accessToken: string, 
  spreadsheetId: string, 
  sheetName: string, 
  values: string[][]
): Promise<void> {
  await ensureSheetExists(accessToken, spreadsheetId, sheetName);
  
  const range = `'${sheetName}'!A:Z`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to append to sheet: ${error}`);
  }
}

// Clear and update sheet
async function updateSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  values: string[][]
): Promise<void> {
  // Ensure sheet exists first
  await ensureSheetExists(accessToken, spreadsheetId, sheetName);
  
  // Use quoted sheet name for special characters
  const range = `'${sheetName}'!A:Z`;
  
  // Clear existing data
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;
  await fetch(clearUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  // Update with new data
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const response = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update sheet: ${error}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SyncRequest = await req.json();
    const { school_id, data_type, week_number, date, sheet_name } = body;

    if (!school_id || !data_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: school_id and data_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read Google config from school's sheets_sync_config
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: syncConfig } = await adminClient
      .from('sheets_sync_config')
      .select('google_service_account_key')
      .eq('school_id', school_id)
      .maybeSingle();

    const serviceAccountKey = syncConfig?.google_service_account_key || Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    const spreadsheetId = Deno.env.get('GOOGLE_SHEET_ID');

    if (!serviceAccountKey || !spreadsheetId) {
      return new Response(
        JSON.stringify({ error: 'Chưa cấu hình Google Service Account Key. Vào Cài đặt → Google Sheets để thiết lập.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials: ServiceAccountCredentials = JSON.parse(serviceAccountKey);

    // Verify user
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SyncRequest = await req.json();
    const { school_id, data_type, week_number, date, sheet_name } = body;

    if (!school_id || !data_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: school_id and data_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token for Google API
    const accessToken = await getAccessToken(credentials);
    let sheetData: string[][] = [];
    const targetSheet = sheet_name || data_type;

    // Fetch and format data based on type
    if (data_type === 'emulation') {
      // Get school info
      const { data: school } = await supabase
        .from('schools')
        .select('name')
        .eq('id', school_id)
        .single();

      // Get emulation scores with class info
      let query = supabase
        .from('emulation_scores')
        .select(`
          *,
          classes:class_id (name, grade)
        `)
        .eq('school_id', school_id)
        .order('week_number', { ascending: true });

      if (week_number) {
        query = query.eq('week_number', week_number);
      }

      const { data: scores, error } = await query;
      if (error) throw error;

      // Format data for sheets
      sheetData = [
        [`BÁO CÁO THI ĐUA - ${school?.name || 'Trường học'}`],
        [`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`],
        [],
        ['Tuần', 'Lớp', 'Khối', 'Điểm học tập', 'Điểm nề nếp', 'Điểm nội trú', 'Tổng điểm', 'Ghi chú']
      ];

      scores?.forEach((score: Record<string, unknown>) => {
        const cls = score.classes as { name: string; grade: number } | null;
        const academicScore = (score.academic_score as number) || 0;
        const disciplineScore = (score.discipline_score as number) || 0;
        const boardingScore = (score.boarding_score as number) || 0;
        const total = academicScore + disciplineScore + boardingScore;
        
        sheetData.push([
          `Tuần ${score.week_number}`,
          cls?.name || '',
          cls?.grade?.toString() || '',
          academicScore.toString(),
          disciplineScore.toString(),
          boardingScore.toString(),
          total.toString(),
          (score.notes as string) || ''
        ]);
      });

    } else if (data_type === 'meal_attendance') {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const { data: records, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          students:student_id (full_name, student_code),
          classes:class_id (name)
        `)
        .eq('school_id', school_id)
        .eq('attendance_date', targetDate)
        .in('attendance_type', ['breakfast', 'lunch', 'dinner']);

      if (error) throw error;

      sheetData = [
        [`BÁO CÁO ĐIỂM DANH BỮA ĂN - ${targetDate}`],
        [],
        ['Mã HS', 'Họ tên', 'Lớp', 'Bữa ăn', 'Trạng thái', 'Lý do', 'Ghi chú']
      ];

      const mealTypeMap: Record<string, string> = {
        breakfast: 'Sáng',
        lunch: 'Trưa',
        dinner: 'Tối'
      };

      const statusMap: Record<string, string> = {
        present: 'Có mặt',
        absent: 'Vắng',
        excused: 'Có phép'
      };

      records?.forEach((record: Record<string, unknown>) => {
        const student = record.students as { full_name: string; student_code: string } | null;
        const cls = record.classes as { name: string } | null;
        
        sheetData.push([
          student?.student_code || '',
          student?.full_name || '',
          cls?.name || '',
          mealTypeMap[record.attendance_type as string] || record.attendance_type as string,
          statusMap[record.status as string] || record.status as string,
          (record.excused_reason as string) || '',
          (record.notes as string) || ''
        ]);
      });

    } else if (data_type === 'evening_study' || data_type === 'boarding') {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const { data: records, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          students:student_id (full_name, student_code),
          classes:class_id (name)
        `)
        .eq('school_id', school_id)
        .eq('attendance_date', targetDate)
        .eq('attendance_type', data_type);

      if (error) throw error;

      const titleMap: Record<string, string> = {
        evening_study: 'TỰ HỌC TỐI',
        boarding: 'NỘI TRÚ'
      };

      sheetData = [
        [`BÁO CÁO ĐIỂM DANH ${titleMap[data_type]} - ${targetDate}`],
        [],
        ['Mã HS', 'Họ tên', 'Lớp', 'Trạng thái', 'Lý do', 'Ghi chú']
      ];

      const statusMap: Record<string, string> = {
        present: 'Có mặt',
        absent: 'Vắng',
        excused: 'Có phép'
      };

      records?.forEach((record: Record<string, unknown>) => {
        const student = record.students as { full_name: string; student_code: string } | null;
        const cls = record.classes as { name: string } | null;
        
        sheetData.push([
          student?.student_code || '',
          student?.full_name || '',
          cls?.name || '',
          statusMap[record.status as string] || record.status as string,
          (record.excused_reason as string) || '',
          (record.notes as string) || ''
        ]);
      });
    }

    // Update Google Sheet
    await updateSheet(accessToken, spreadsheetId, targetSheet, sheetData);

    console.log(`Synced ${data_type} data to sheet: ${targetSheet}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Đã đồng bộ dữ liệu ${data_type} lên Google Sheets`,
        rows: sheetData.length,
        sheet: targetSheet
      }),
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
