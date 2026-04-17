-- Add encryption support to upload_sessions table
ALTER TABLE public.upload_sessions 
ADD COLUMN encrypted_file TEXT,
ADD COLUMN iv TEXT,
ADD COLUMN sender_public_key TEXT;

-- Add comments to document the new fields
COMMENT ON COLUMN public.upload_sessions.encrypted_file IS 'Base64 encoded encrypted file data (AES-GCM)';
COMMENT ON COLUMN public.upload_sessions.iv IS 'Base64 encoded initialization vector for AES-GCM';
COMMENT ON COLUMN public.upload_sessions.sender_public_key IS 'Base64 encoded sender public key for ECDH key exchange';
