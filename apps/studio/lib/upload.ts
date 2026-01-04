import { createSupportSupabaseClient } from './supabase-client-factory'

// [Joshen TODO] Feedback form and support attachments should use this
export const uploadAttachment = async (
  bucket: string,
  fileName: string,
  image: File,
  getUrl: boolean = true
) => {
  const supabaseClient = createSupportSupabaseClient()

  const options = { cacheControl: '3600' }

  const { data: file, error } = await supabaseClient.storage
    .from(bucket)
    .upload(fileName, image, options)

  if (error) {
    console.error('Failed to upload:', error)
    return undefined
  }

  if (file && getUrl) {
    const { data } = await supabaseClient.storage.from(bucket).getPublicUrl(file.path)
    return data?.publicUrl
  }

  return undefined
}
