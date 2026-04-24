// Upload ảnh đơn ra vào KTX: lưu vào Lovable Cloud Storage (chính),
// đồng thời thử backup lên Google Drive nếu có cấu hình Shared Drive.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// --- Google JWT helpers ---
function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(claim),
  )}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Token error: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function ensureFolder(
  token: string,
  name: string,
  parentId: string,
): Promise<string> {
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const searchJson = await searchRes.json();
  if (searchJson.files?.length) return searchJson.files[0].id;

  const createRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    },
  );
  const createJson = await createRes.json();
  if (!createRes.ok) throw new Error(`Create folder error: ${JSON.stringify(createJson)}`);
  return createJson.id;
}

async function uploadToDrive(
  token: string,
  parentId: string,
  fileName: string,
  fileBuf: Uint8Array,
  contentType: string,
): Promise<string | null> {
  const metadata = { name: fileName, parents: [parentId] };
  const boundary = "lovable-boundary-" + crypto.randomUUID();
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + fileBuf.length + tail.length);
  body.set(head, 0);
  body.set(fileBuf, head.length);
  body.set(tail, head.length + fileBuf.length);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const uploaded = await uploadRes.json();
  if (!uploadRes.ok) {
    console.warn("Drive upload failed (non-fatal):", JSON.stringify(uploaded));
    return null;
  }
  // Make file accessible via link
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions?supportsAllDrives=true`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    },
  );
  return uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Chưa đăng nhập");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Không xác thực được người dùng");

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const requestId = form.get("request_id") as string | null;
    const schoolId = form.get("school_id") as string | null;
    const schoolName = (form.get("school_name") as string) || "Truong";
    if (!file) throw new Error("Thiếu file");
    if (!schoolId) throw new Error("Thiếu school_id");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const fileBuf = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${schoolId}/${ts}_${safeName}`;

    // 1) Upload chính: Lovable Cloud Storage
    const { error: upErr } = await adminClient.storage
      .from("exit-attachments")
      .upload(storagePath, fileBuf, { contentType, upsert: false });
    if (upErr) throw new Error(`Storage upload error: ${upErr.message}`);

    const { data: pub } = adminClient.storage
      .from("exit-attachments")
      .getPublicUrl(storagePath);
    const primaryUrl = pub.publicUrl;

    // 2) Backup sang Google Drive (chỉ nếu có Shared Drive ID configured)
    let driveUrl: string | null = null;
    let driveError: string | null = null;
    try {
      let serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY") || "";
      let rootFolderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID") || "";
      const { data: cfg } = await adminClient
        .from("sheets_sync_config")
        .select("google_service_account_key, google_drive_folder_id")
        .eq("school_id", schoolId)
        .maybeSingle();
      if (cfg?.google_service_account_key) serviceAccountKey = cfg.google_service_account_key;
      if (cfg?.google_drive_folder_id) rootFolderId = cfg.google_drive_folder_id;

      if (serviceAccountKey && rootFolderId) {
        const sa = typeof serviceAccountKey === "string" ? JSON.parse(serviceAccountKey) : serviceAccountKey;
        const token = await getAccessToken(sa);
        const exitFolder = await ensureFolder(token, "Đơn KTX", rootFolderId);
        const schoolFolder = await ensureFolder(token, schoolName, exitFolder);
        driveUrl = await uploadToDrive(token, schoolFolder, `${ts}_${file.name}`, fileBuf, contentType);
      }
    } catch (e: any) {
      driveError = e?.message || String(e);
      console.warn("Drive backup skipped:", driveError);
    }

    // Save URL to request if request_id provided
    if (requestId) {
      await adminClient
        .from("dormitory_exit_requests")
        .update({ attachment_url: primaryUrl })
        .eq("id", requestId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: primaryUrl,
        drive_url: driveUrl,
        drive_error: driveError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("upload-exit-attachment error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
