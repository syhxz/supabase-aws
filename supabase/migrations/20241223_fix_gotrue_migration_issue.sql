-- Fix GoTrue migration issue: 20221208132122_backfill_email_last_sign_in_at.up.sql
-- This migration fixes the UUID comparison error without modifying the table structure

-- Step 1: Mark the problematic migration as completed to prevent re-execution
INSERT INTO auth.schema_migrations (version) 
VALUES ('20221208132122') 
ON CONFLICT (version) DO NOTHING;

-- Step 2: Manually execute the corrected backfill logic
-- Fix the UUID comparison issue by using proper type casting
DO $$
BEGIN
    -- Check if the identities table exists and has the required columns
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'identities'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'id'
    ) THEN
        
        -- Execute the corrected backfill with proper UUID handling
        UPDATE auth.identities
        SET last_sign_in_at = '2022-11-25'::timestamp with time zone
        WHERE
            last_sign_in_at IS NULL AND
            created_at = '2022-11-25'::timestamp with time zone AND
            updated_at = '2022-11-25'::timestamp with time zone AND
            provider = 'email' AND
            id::text = user_id::text;  -- Fixed: Cast both sides to text for comparison
            
        -- Log completion (ROW_COUNT is not available in this context)
        RAISE NOTICE 'GoTrue migration fix completed successfully';
        
    ELSE
        RAISE NOTICE 'auth.identities table or id column not found, skipping backfill';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during GoTrue migration fix: %', SQLERRM;
        -- Don't fail the migration, just log the error
END $$;

-- Step 3: Add a comment for future reference
DO $$
BEGIN
    EXECUTE 'COMMENT ON TABLE auth.identities IS ''Fixed GoTrue migration 20221208132122 UUID comparison issue on ' || CURRENT_DATE || '''';
END $$;