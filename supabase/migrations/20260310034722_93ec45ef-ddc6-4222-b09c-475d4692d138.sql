ALTER TABLE public.sheets_sync_config 
ADD COLUMN IF NOT EXISTS google_service_account_key text,
ADD COLUMN IF NOT EXISTS google_drive_folder_id text;