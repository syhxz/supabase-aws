import { useState } from 'react'
import { useParams } from 'common'
import { useSelectedProjectQuery } from 'hooks/misc/useSelectedProject'
import Panel from 'components/ui/Panel'
import { Button, Input, Badge, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from 'ui'
import { PasswordVisibilityToggle } from 'components/interfaces/Connect/PasswordVisibilityToggle'
import { AlertTriangle, Info } from 'lucide-react'
import { getCredentialFallbackManager } from '../../../../lib/api/self-hosted/credential-fallback-manager'
import { useProjectPasswordQuery } from 'data/projects/project-password-query'

/**
 * Component to display project-specific database user information
 * Requirements 4.1, 4.2, 4.3, 4.4, 4.5: Remove Note prompts, show actual passwords, provide complete connection info
 */
export const ProjectDatabaseInfo = () => {
  const { ref: projectRef } = useParams()
  const { data: project } = useSelectedProjectQuery()
  const [showPassword, setShowPassword] = useState(false)

  // Fetch project password from API
  const { data: projectPasswordData, isLoading: isLoadingPassword } = useProjectPasswordQuery({ 
    ref: projectRef 
  })
  
  // Component state information
  // projectRef: projectRef
  // projectPasswordData: projectPasswordData
  // isLoadingPassword: isLoadingPassword

  // Check if project has database user information (this might be available in extended project data)
  const projectDatabaseUser = (project as any)?.database_user
  const projectDatabaseName = (project as any)?.database_name

  // Check if fallback credentials are being used
  const fallbackManager = getCredentialFallbackManager()
  const projectCredentials = fallbackManager.getProjectCredentials(
    projectRef || '',
    projectDatabaseUser,
    projectPasswordData?.password || null
  )
  const isUsingFallback = fallbackManager.shouldUseFallback(projectCredentials)
  
  // Show this component for all projects, but indicate fallback status
  const displayUser = projectDatabaseUser || '[FALLBACK_USER]'
  const displayDatabaseName = projectDatabaseName || projectRef || '[DATABASE_NAME]'

  // Generate connection string with project-specific credentials or fallback
  const host = process.env.POSTGRES_HOST || 'localhost'
  const port = process.env.POSTGRES_PORT || '5432'
  const actualPassword = projectPasswordData?.password || '[PASSWORD_NOT_AVAILABLE]'
  const password = showPassword ? actualPassword : '[YOUR_PASSWORD]'
  
  const connectionString = `postgresql://${displayUser}:${password}@${host}:${port}/${displayDatabaseName}`

  return (
    <Panel className="!m-0">
      <Panel.Content>
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-base font-medium">Project Database Credentials</h3>
              {isUsingFallback && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="flex items-center gap-1 text-warning border-warning/20 bg-warning/5">
                        <AlertTriangle size={12} />
                        Using Fallback
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        This project is using system fallback credentials because project-specific 
                        credentials are not configured. Consider migrating to project-specific credentials 
                        for enhanced security.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-sm text-foreground-light mb-4">
              {isUsingFallback 
                ? 'This project is currently using system fallback credentials. Project-specific credentials provide enhanced security and isolation.'
                : 'This project uses dedicated database credentials for enhanced security and isolation.'
              }
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Database User</label>
                {isUsingFallback && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info size={14} className="text-warning" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">System fallback user is being used</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <Input
                type="text"
                value={displayUser}
                readOnly
                copy
                className={`font-mono text-sm ${isUsingFallback ? 'bg-warning/5 border-warning/20' : ''}`}
              />
              {isUsingFallback && (
                <p className="text-xs text-warning">
                  Fallback user - project-specific user not configured
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Database Name</label>
              <Input
                type="text"
                value={displayDatabaseName}
                readOnly
                copy
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Database Password</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground-lighter">
                  {showPassword ? 'Password placeholder visible' : 'Password hidden'}
                </span>
                <PasswordVisibilityToggle
                  isVisible={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                />
              </div>
            </div>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={showPassword ? actualPassword : '[YOUR_PASSWORD]'}
              readOnly
              className="font-mono text-sm"
            />
            <p className="text-xs text-foreground-lighter">
              For security reasons, the actual password is not stored and cannot be displayed. 
              Use the password you set during project creation or reset it below.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Connection String</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground-lighter">
                  {showPassword ? 'With password placeholder' : 'Password masked'}
                </span>
              </div>
            </div>
            <Input
              type="text"
              value={connectionString}
              readOnly
              copy
              className="font-mono text-sm"
            />
            <p className="text-xs text-foreground-lighter">
              Replace [YOUR_PASSWORD] with your actual database password when using this connection string.
            </p>
          </div>

          <div className={`border rounded-lg p-4 ${isUsingFallback ? 'bg-warning/5 border-warning/20' : 'bg-surface-100 border-border'}`}>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              {isUsingFallback ? 'Fallback Credential Status' : 'Enhanced Security Features'}
              {isUsingFallback && <AlertTriangle size={14} className="text-warning" />}
            </h4>
            {isUsingFallback ? (
              <ul className="text-xs text-foreground-light space-y-1">
                <li>• Currently using system fallback credentials</li>
                <li>• Project-specific credentials not configured</li>
                <li>• Consider migrating to project-specific credentials</li>
                <li>• Enhanced security available with dedicated credentials</li>
              </ul>
            ) : (
              <ul className="text-xs text-foreground-light space-y-1">
                <li>• Dedicated database user for this project only</li>
                <li>• Isolated from other projects' data</li>
                <li>• Project-specific connection credentials</li>
                <li>• No shared database access</li>
              </ul>
            )}
          </div>
        </div>
      </Panel.Content>
    </Panel>
  )
}