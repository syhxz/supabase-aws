import { useParams } from 'common'
import { useApiKeysVisibility } from 'components/interfaces/APIKeys/hooks/useApiKeysVisibility'
import { getKeys, useAPIKeysQuery } from 'data/api-keys/api-keys-query'
import { useProjectSettingsV2Query } from 'data/config/project-settings-v2-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from 'ui'

interface RecommendedSecret {
  name: string
  value: string
  description: string
}

interface RecommendedSecretsProps {
  onAddSecret: (name: string, value: string) => void
  existingSecretNames: string[]
}

export const RecommendedSecrets = ({ onAddSecret, existingSecretNames }: RecommendedSecretsProps) => {
  const { ref: projectRef } = useParams()

  const { canReadAPIKeys } = useApiKeysVisibility()
  const { data: apiKeys } = useAPIKeysQuery(
    { projectRef, reveal: true },
    { enabled: canReadAPIKeys }
  )
  const { data: settings } = useProjectSettingsV2Query({ projectRef })

  const { anonKey, serviceKey } = getKeys(apiKeys)

  // Get the project URL
  const protocol = settings?.app_config?.protocol ?? 'https'
  const endpoint = settings?.app_config?.endpoint
  const projectUrl = endpoint ? `${protocol}://${endpoint}` : ''

  // Get database URL from settings
  const dbHost = settings?.db_host
  const dbPort = settings?.db_port ?? 5432
  const dbName = settings?.db_name ?? 'postgres'
  const dbUser = settings?.db_user ?? 'postgres'
  const databaseUrl = dbHost
    ? `postgresql://${dbUser}:[YOUR-PASSWORD]@${dbHost}:${dbPort}/${dbName}`
    : ''

  const recommendedSecrets: RecommendedSecret[] = [
    {
      name: 'SUPABASE_URL',
      value: projectUrl,
      description: 'Your Supabase project URL',
    },
    {
      name: 'SUPABASE_ANON_KEY',
      value: anonKey?.api_key ?? '',
      description: 'Public anonymous key for client-side operations',
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      value: serviceKey?.api_key ?? '',
      description: 'Service role key with admin privileges (keep secret!)',
    },
    {
      name: 'SUPABASE_DB_URL',
      value: databaseUrl,
      description: 'Direct database connection URL',
    },
  ].filter((secret) => secret.value) // Only show secrets with values

  const handleAddSecret = (name: string, value: string) => {
    onAddSecret(name, value)
    toast.success(`Added ${name} to form`)
  }

  // Filter out secrets that already exist
  const availableSecrets = recommendedSecrets.filter(
    (secret) => !existingSecretNames.includes(secret.name)
  )

  if (availableSecrets.length === 0) {
    return null
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recommended Secrets</CardTitle>
            <p className="text-sm text-foreground-light mt-1">
              Common Supabase environment variables for your Edge Functions
            </p>
          </div>
          <Badge variant="default">Quick Add</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {availableSecrets.map((secret) => (
            <div
              key={secret.name}
              className="flex items-start justify-between p-3 border rounded-md hover:bg-surface-100 transition-colors"
            >
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-sm font-mono font-semibold">{secret.name}</code>
                  {secret.name === 'SUPABASE_SERVICE_ROLE_KEY' && (
                    <Badge variant="warning" className="text-xs">
                      Secret
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-foreground-light">{secret.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  type="primary"
                  size="tiny"
                  icon={<Plus size={14} />}
                  onClick={() => handleAddSecret(secret.name, secret.value)}
                >
                  Add
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-surface-100 rounded-md">
          <p className="text-xs text-foreground-light">
            💡 <strong>Tip:</strong> Click "Add" to automatically populate these secrets with values from your project
            settings. The actual values will be visible in the form below before saving.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
