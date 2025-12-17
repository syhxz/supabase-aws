import { type SupabaseClient } from '@supabase/supabase-js'
import { createSupportSupabaseClient } from 'lib/supabase-client-factory'

export const createSupportStorageClient = (): SupabaseClient => {
  return createSupportSupabaseClient()
}
