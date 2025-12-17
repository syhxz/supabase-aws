import type { NextApiRequest, NextApiResponse } from 'next'
import z from 'zod'

import { DASHBOARD_LOG_BUCKET } from 'components/interfaces/Support/dashboard-logs'
import apiWrapper from 'lib/api/apiWrapper'
import { getUserClaims } from 'lib/gotrue'
import { createSupportSupabaseClient } from 'lib/supabase-client-factory'

export const maxDuration = 120

const GenerateAttachmentUrlSchema = z.object({
  filenames: z.array(z.string()),
  bucket: z
    .enum(['support-attachments', 'feedback-attachments', DASHBOARD_LOG_BUCKET])
    .default('support-attachments'),
})

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const { claims, error: userClaimsError } = await getUserClaims(req.headers.authorization!)
  if (userClaimsError || !claims) {
    return res.status(401).json({ error: { message: 'Unauthorized' } })
  }
  const userId = claims.sub

  const json = JSON.parse(req.body)
  const parseResult = GenerateAttachmentUrlSchema.safeParse(json)
  if (!parseResult.success) {
    return res.status(400).json({ error: { message: 'Invalid request body' } })
  }
  const filenames = parseResult.data.filenames

  const requestedPrefixes = [...new Set(filenames.map((filename) => filename.split('/')[0]))]
  if (requestedPrefixes.some((prefix) => prefix !== userId)) {
    return res
      .status(403)
      .json({ error: { message: 'Forbidden: Users can only access their own resources' } })
  }

  const adminSupabase = createSupportSupabaseClient()

  const bucket = parseResult.data.bucket
  // Create signed URLs for 10 years
  const { data, error: signedUrlError } = await adminSupabase.storage
    .from(bucket)
    .createSignedUrls(filenames, 10 * 365 * 24 * 60 * 60)
  if (signedUrlError) {
    console.error('Failed to sign URLs for attachments', signedUrlError)
    return res.status(500).json({ error: { message: 'Failed to sign URLs for attachments' } })
  }
  return res.status(200).json(data ? data.map((file) => file.signedUrl) : [])
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'POST':
      return handlePost(req, res)
    default:
      res.setHeader('Allow', ['POST'])
      res.status(405).json({
        data: null,
        error: { message: `Method ${method} Not Allowed` },
      })
  }
}

const wrapper = (req: NextApiRequest, res: NextApiResponse) =>
  apiWrapper(req, res, handler, { withAuth: true })

export default wrapper
