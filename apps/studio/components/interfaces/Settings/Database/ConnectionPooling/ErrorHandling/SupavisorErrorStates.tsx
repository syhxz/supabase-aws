import React from 'react'
import { AlertError } from 'components/ui/AlertError'
import { InlineLink } from 'components/ui/InlineLink'
import { DOCS_URL } from 'lib/constants'
import {
  AlertDescription_Shadcn_,
  AlertTitle_Shadcn_,
  Alert_Shadcn_,
  Button,
  ExternalLinkIcon,
  InfoIcon,
  WarningIcon,
} from 'ui'
import { Admonition } from 'ui-patterns'

interface SupavisorErrorStatesProps {
  projectRef?: string
  errorType: 'missing-config' | 'service-unavailable' | 'configuration-invalid' | 'network-error'
  error?: Error | null
  onRetry?: () => void
  onSetupGuide?: () => void
}

/**
 * Specialized error states for Supavisor configuration issues
 */
export const SupavisorErrorStates: React.FC<SupavisorErrorStatesProps> = ({
  projectRef,
  errorType,
  error,
  onRetry,
  onSetupGuide,
}) => {
  switch (errorType) {
    case 'missing-config':
      return (
        <Alert_Shadcn_ variant="default" className="border-amber-200 bg-amber-50">
          <InfoIcon className="h-4 w-4 text-amber-600" />
          <AlertTitle_Shadcn_ className="text-amber-800">
            Supavisor Configuration Required
          </AlertTitle_Shadcn_>
          <AlertDescription_Shadcn_ className="text-amber-700">
            <div className="space-y-3">
              <p>
                Supavisor environment variables are not configured or incomplete. 
                To enable connection pooling, you need to set up the required environment variables.
              </p>
              
              <div className="bg-amber-100 p-3 rounded border border-amber-200">
                <p className="font-medium text-amber-800 mb-2">Required Environment Variables:</p>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li><code>POOLER_TENANT_ID</code> - Your tenant identifier</li>
                  <li><code>POOLER_DEFAULT_POOL_SIZE</code> - Default pool size (e.g., 20)</li>
                  <li><code>POOLER_MAX_CLIENT_CONN</code> - Maximum client connections (e.g., 100)</li>
                  <li><code>POOLER_PROXY_PORT_TRANSACTION</code> - Proxy port (e.g., 6543)</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button asChild type="default" size="tiny">
                  <InlineLink href={`${DOCS_URL}/guides/database/connection-management#supavisor-setup`}>
                    <ExternalLinkIcon className="w-3 h-3 mr-1" />
                    Setup Guide
                  </InlineLink>
                </Button>
                {onRetry && (
                  <Button type="outline" size="tiny" onClick={onRetry}>
                    Check Again
                  </Button>
                )}
              </div>
            </div>
          </AlertDescription_Shadcn_>
        </Alert_Shadcn_>
      )

    case 'service-unavailable':
      return (
        <Alert_Shadcn_ variant="warning" className="border-orange-200 bg-orange-50">
          <WarningIcon className="h-4 w-4 text-orange-600" />
          <AlertTitle_Shadcn_ className="text-orange-800">
            Supavisor Service Unavailable
          </AlertTitle_Shadcn_>
          <AlertDescription_Shadcn_ className="text-orange-700">
            <div className="space-y-3">
              <p>
                The Supavisor connection pooling service is not running or not accessible. 
                This could be due to the Docker container being stopped or a configuration issue.
              </p>
              
              <div className="bg-orange-100 p-3 rounded border border-orange-200">
                <p className="font-medium text-orange-800 mb-2">Troubleshooting Steps:</p>
                <ol className="text-sm text-orange-700 space-y-1 list-decimal list-inside">
                  <li>Check if the Supavisor Docker container is running</li>
                  <li>Verify the management port (4000) is accessible</li>
                  <li>Check Docker logs for error messages</li>
                  <li>Ensure environment variables are properly set</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <Button asChild type="default" size="tiny">
                  <InlineLink href={`${DOCS_URL}/guides/database/connection-management#troubleshooting`}>
                    <ExternalLinkIcon className="w-3 h-3 mr-1" />
                    Troubleshooting Guide
                  </InlineLink>
                </Button>
                {onRetry && (
                  <Button type="outline" size="tiny" onClick={onRetry}>
                    Retry Connection
                  </Button>
                )}
              </div>
            </div>
          </AlertDescription_Shadcn_>
        </Alert_Shadcn_>
      )

    case 'configuration-invalid':
      return (
        <AlertError
          projectRef={projectRef}
          subject="Invalid Supavisor Configuration"
          error={error}
          additionalActions={
            <>
              <Button asChild type="default" size="tiny">
                <InlineLink href={`${DOCS_URL}/guides/database/connection-management#configuration`}>
                  <ExternalLinkIcon className="w-3 h-3 mr-1" />
                  Configuration Guide
                </InlineLink>
              </Button>
              {onRetry && (
                <Button type="outline" size="tiny" onClick={onRetry}>
                  Retry
                </Button>
              )}
            </>
          }
        >
          <p>
            The Supavisor configuration contains invalid values. Please check your environment 
            variables and ensure all required settings are properly configured.
          </p>
        </AlertError>
      )

    case 'network-error':
      return (
        <AlertError
          projectRef={projectRef}
          subject="Network Connection Error"
          error={error}
          additionalActions={
            onRetry && (
              <Button type="outline" size="tiny" onClick={onRetry}>
                Retry Connection
              </Button>
            )
          }
        >
          <p>
            Unable to connect to the Supavisor service. This might be a temporary network issue 
            or the service might be starting up. Please try again in a few moments.
          </p>
        </AlertError>
      )

    default:
      return (
        <AlertError
          projectRef={projectRef}
          subject="Connection Pooling Error"
          error={error}
          additionalActions={
            onRetry && (
              <Button type="outline" size="tiny" onClick={onRetry}>
                Try Again
              </Button>
            )
          }
        />
      )
  }
}

/**
 * Setup guidance component for unconfigured environments
 */
export const SupavisorSetupGuidance: React.FC<{ projectRef?: string }> = ({ projectRef }) => {
  return (
    <Admonition
      type="default"
      title="Connection Pooling Setup Required"
      className="border-blue-200 bg-blue-50"
    >
      <div className="space-y-4">
        <p className="text-blue-800">
          To enable connection pooling in your self-hosted Supabase environment, 
          you need to configure Supavisor with the appropriate environment variables.
        </p>
        
        <div className="bg-blue-100 p-4 rounded border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-3">Quick Setup Steps:</h4>
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>
              Add the required environment variables to your <code>.env</code> file:
              <div className="mt-2 p-2 bg-blue-50 rounded border text-xs font-mono">
                POOLER_TENANT_ID=your-project-id<br/>
                POOLER_DEFAULT_POOL_SIZE=20<br/>
                POOLER_MAX_CLIENT_CONN=100<br/>
                POOLER_PROXY_PORT_TRANSACTION=6543
              </div>
            </li>
            <li>Restart your Supabase Docker containers</li>
            <li>Verify the Supavisor service is running on port 6543</li>
            <li>Refresh this page to see your connection pooling configuration</li>
          </ol>
        </div>

        <div className="flex gap-2">
          <Button asChild type="default" size="tiny">
            <InlineLink href={`${DOCS_URL}/guides/database/connection-management#self-hosted-setup`}>
              <ExternalLinkIcon className="w-3 h-3 mr-1" />
              Complete Setup Guide
            </InlineLink>
          </Button>
          <Button asChild type="outline" size="tiny">
            <InlineLink href={`${DOCS_URL}/guides/self-hosting/docker#environment-variables`}>
              Environment Variables Reference
            </InlineLink>
          </Button>
        </div>
      </div>
    </Admonition>
  )
}