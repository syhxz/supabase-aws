import { ChevronRight, FileCode, X, AlertTriangle, Info } from 'lucide-react'
import Link from 'next/link'
import { PropsWithChildren, ReactNode, useState } from 'react'

import { useParams } from 'common'
import { useSupavisorConfigurationQuery } from 'data/database/supavisor-configuration-query'
import { IS_PLATFORM } from 'lib/constants'
import { useDatabaseSelectorStateSnapshot } from 'state/database-selector'
import {
  Badge,
  Button,
  cn,
  CodeBlock,
  CodeBlockLang,
  Collapsible_Shadcn_,
  CollapsibleContent_Shadcn_,
  CollapsibleTrigger_Shadcn_,
  WarningIcon,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'ui'
import { Admonition } from 'ui-patterns'
import { ConnectionParameters } from './ConnectionParameters'
import { PasswordVisibilityToggle } from './PasswordVisibilityToggle'
import { getConnectionStrings } from './DatabaseSettings.utils'
import { generateConnectionStringWithFallback } from '../../../lib/api/self-hosted/connection-string'

interface EnhancedConnectionPanelProps {
  type?: 'direct' | 'transaction' | 'session'
  badge?: string
  title: string
  description: string
  contentFooter?: ReactNode
  connectionInfo: {
    db_user: string
    db_port: number
    db_host: string
    db_name: string
  }
  poolingInfo?: {
    connectionString: string
    db_user: string
    db_port: number
    db_host: string
    db_name: string
  }
  projectPassword?: string
  ipv4Status: {
    type: 'error' | 'success'
    title: string
    description?: string | ReactNode
    links?: { text: string; url: string }[]
  }
  notice?: string[]
  parameters?: Array<{
    key: string
    value: string
    description?: string
  }>
  contentType?: 'input' | 'code'
  lang?: CodeBlockLang
  fileTitle?: string
  onCopyCallback: () => void
  // New props for fallback indication
  fallbackStatus?: {
    usedFallback: boolean
    fallbackReason?: string
    fallbackType?: 'user' | 'password' | 'both'
  }
}

const IPv4StatusIcon = ({ className, active }: { className?: string; active: boolean }) => {
  return (
    <div className={cn('relative inline-flex', className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1"
        stroke="currentColor"
        className="size-6 stroke-foreground-lighter"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"
        />
      </svg>

      {!active ? (
        <div className="absolute -right-1.5 -top-1.5 bg-destructive rounded w-4 h-4 flex items-center justify-center">
          <X size={10} strokeWidth={4} className="text-white rounded-full" />
        </div>
      ) : (
        <div className="absolute -right-1.5 -top-1.5 bg-brand-500 rounded w-4 h-4 flex items-center justify-center">
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8.33325 2.5L3.74992 7.08333L1.66659 5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  )
}

const FallbackCredentialIndicator = ({ 
  isUsingFallback, 
  fallbackReason, 
  fallbackType 
}: { 
  isUsingFallback: boolean
  fallbackReason?: string
  fallbackType?: 'user' | 'password' | 'both'
}) => {
  if (!isUsingFallback) return null

  const getIcon = () => {
    return <AlertTriangle size={16} className="text-warning" />
  }

  const getTitle = () => {
    switch (fallbackType) {
      case 'user':
        return 'Using fallback database user'
      case 'password':
        return 'Using fallback database password'
      case 'both':
        return 'Using fallback database credentials'
      default:
        return 'Using fallback credentials'
    }
  }

  const getDescription = () => {
    const baseDescription = fallbackReason || 'Project-specific credentials are not available'
    const actionText = 'Consider migrating this project to use project-specific credentials for enhanced security.'
    return `${baseDescription}. ${actionText}`
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="border border-warning/20 bg-warning/5 px-5 flex gap-3 items-center py-3 first:rounded-t last:rounded-b">
            <div className="flex items-center gap-2 flex-shrink-0">
              {getIcon()}
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-foreground font-medium">{getTitle()}</span>
              <span className="text-xs text-foreground-lighter">
                System credentials are being used for database connection
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{getDescription()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export const CodeBlockFileHeader = ({ title }: { title: string }) => {
  return (
    <div className="flex items-center justify-between px-4 py-1 bg-surface-100/50 border border-b-0 border-surface rounded-t">
      <div className="flex items-center gap-2">
        <FileCode size={12} className="text-foreground-muted" strokeWidth={1.5} />
        <span className="text-xs text-foreground-light">{title}</span>
      </div>
    </div>
  )
}

export const EnhancedConnectionPanel = ({
  type = 'direct',
  badge,
  title,
  description,
  contentFooter,
  connectionInfo,
  poolingInfo,
  projectPassword,
  ipv4Status,
  notice,
  parameters = [],
  lang = 'bash',
  fileTitle,
  children,
  onCopyCallback,
  fallbackStatus,
}: PropsWithChildren<EnhancedConnectionPanelProps>) => {
  const { ref: projectRef } = useParams()
  const state = useDatabaseSelectorStateSnapshot()
  const [showPassword, setShowPassword] = useState(false)

  const { data: poolingConfiguration } = useSupavisorConfigurationQuery({ projectRef })
  const poolingConfig = poolingConfiguration?.find((x) => x.identifier === state.selectedDatabaseId)
  const isSessionMode = poolingConfig?.pool_mode === 'session'

  const links = ipv4Status.links ?? []

  const isTransactionDedicatedPooler = type === 'transaction' && badge === 'Dedicated Pooler'

  // Generate connection strings with password visibility support and auto-generated credentials
  // Requirements 2.1, 2.2, 2.3, 2.5: Ensure connection strings include auto-generated credentials
  const connectionStrings = getConnectionStrings({
    connectionInfo,
    poolingInfo,
    metadata: { projectRef },
    revealPassword: showPassword,
    actualPassword: projectPassword,
  })

  // Select the appropriate connection string based on type
  // Requirements 2.1, 2.2, 2.3: Use connection strings with auto-generated credentials
  const connectionString = type === 'direct' 
    ? connectionStrings.direct.uri 
    : connectionStrings.pooler.uri

  // Determine if fallback credentials are being used
  const isUsingFallback = fallbackStatus?.usedFallback || false
  const fallbackReason = fallbackStatus?.fallbackReason
  const fallbackType = fallbackStatus?.fallbackType

  return (
    <div className="relative text-sm flex flex-col gap-5 lg:grid lg:grid-cols-12 w-full">
      <div className="col-span-4 flex flex-col">
        <div className="flex items-center gap-x-2 mb-2">
          <h1 className="text-sm">{title}</h1>
          {!!badge && !isTransactionDedicatedPooler && <Badge>{badge}</Badge>}
        </div>
        <p className="text-sm text-foreground-light mb-4">{description}</p>
        {contentFooter}
      </div>
      <div className="col-span-8 flex flex-col gap-2">
        {isTransactionDedicatedPooler && (
          <div className="text-xs flex items-center text-foreground-light">
            Using the Dedicated Pooler:
          </div>
        )}
        
        {/* Password visibility toggle */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-foreground-light flex items-center gap-2">
            Connection string
            {isUsingFallback && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={12} className="text-warning" />
                      <span className="text-warning text-xs">using fallback credentials</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      {fallbackReason || 'Project-specific credentials are not available'}. 
                      System credentials are being used instead.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground-lighter">
              {showPassword ? 'Password visible' : 'Password hidden'}
            </span>
            <PasswordVisibilityToggle
              isVisible={showPassword}
              onToggle={() => setShowPassword(!showPassword)}
              disabled={!projectPassword}
            />
          </div>
        </div>

        <div className="flex flex-col -space-y-px">
          {fileTitle && <CodeBlockFileHeader title={fileTitle} />}
          {type === 'transaction' && isSessionMode ? (
            <Admonition
              showIcon={false}
              type="default"
              className="[&>h5]:text-xs [&>div]:text-xs"
              title="Transaction pooler is unavailable as pool mode is set to Session"
              description="If you'd like to use transaction mode, update your pool mode to Transaction for the connection pooler in your project's Database Settings."
            >
              <Button asChild type="default" className="mt-2">
                <Link
                  href={`/project/${projectRef}/database/settings#connection-pooler`}
                  className="text-xs text-light hover:text-foreground"
                >
                  Database Settings
                </Link>
              </Button>
            </Admonition>
          ) : (
            <>
              <CodeBlock
                wrapperClassName={cn(
                  '[&_pre]:rounded-b-none [&_pre]:px-4 [&_pre]:py-3',
                  fileTitle && '[&_pre]:rounded-t-none'
                )}
                language={lang}
                value={connectionString}
                className="[&_code]:text-[12px] [&_code]:text-foreground [&_code]:!whitespace-normal"
                hideLineNumbers
                onCopyCallback={onCopyCallback}
              />
              {notice && (
                <div className="border px-4 py-1 w-full justify-start rounded-t-none !last:rounded-b group-data-[state=open]:rounded-b-none border-light">
                  {notice?.map((text: string) => (
                    <p key={text} className="text-xs text-foreground-lighter">
                      {text}
                    </p>
                  ))}
                </div>
              )}
              {parameters.length > 0 && <ConnectionParameters parameters={parameters} />}
            </>
          )}
        </div>
        <div className="flex flex-col -space-y-px w-full">
          {/* Fallback credential indicator */}
          <FallbackCredentialIndicator 
            isUsingFallback={isUsingFallback}
            fallbackReason={fallbackReason}
            fallbackType={fallbackType}
          />
          
          {IS_PLATFORM && (
            <div className="border border-muted px-5 flex gap-7 items-center py-3 first:rounded-t last:rounded-b">
              <div className="flex items-center gap-2">
                <IPv4StatusIcon active={ipv4Status.type === 'success'} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-foreground">{ipv4Status.title}</span>
                {ipv4Status.description &&
                  (typeof ipv4Status.description === 'string' ? (
                    <span className="text-xs text-foreground-lighter">
                      {ipv4Status.description}
                    </span>
                  ) : (
                    ipv4Status.description
                  ))}
                {links.length > 0 && (
                  <div className="flex items-center gap-x-2 mt-2">
                    {links.map((link) => (
                      <Button key={link.text} asChild type="default" size="tiny">
                        <Link href={link.url} className="text-xs text-light hover:text-foreground">
                          {link.text}
                        </Link>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {type === 'session' && (
            <div className="border border-muted px-5 flex gap-7 items-center py-3 first:rounded-t last:rounded-b bg-alternative/50">
              <div className="flex w-6 h-6 rounded items-center justify-center gap-2 flex-shrink-0 bg-surface-100">
                <WarningIcon />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-foreground">Only use on a IPv4 network</span>
                <div className="flex flex-col text-xs text-foreground-lighter">
                  <p>Session pooler connections are IPv4 proxied for free.</p>
                  <p>Use Direct Connection if connecting via an IPv6 network.</p>
                </div>
              </div>
            </div>
          )}

          {IS_PLATFORM && ipv4Status.type === 'error' && (
            <Collapsible_Shadcn_ className="group -space-y-px">
              <CollapsibleTrigger_Shadcn_
                asChild
                className="group/collapse w-full justify-start rounded-t-none !last:rounded-b group-data-[state=open]:rounded-b-none border-muted"
              >
                <Button
                  type="default"
                  size="tiny"
                  className="text-foreground-lighter !bg-dash-sidebar"
                  icon={
                    <ChevronRight
                      className={cn(
                        'group-data-[state=open]/collapse:rotate-90 text-foreground-muted transition-transform'
                      )}
                    />
                  }
                >
                  Some platforms are IPv4-only:
                </Button>
              </CollapsibleTrigger_Shadcn_>
              <CollapsibleContent_Shadcn_ className="bg-dash-sidebar rounded-b border px-3 py-2">
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-foreground-light max-w-xs">
                    A few major platforms are IPv4-only and may not work with a Direct Connection:
                  </p>
                  <div className="flex gap-4">
                    <div className="text-foreground text-xs">Vercel</div>
                    <div className="text-foreground text-xs">GitHub Actions</div>
                    <div className="text-foreground text-xs">Render</div>
                    <div className="text-foreground text-xs">Retool</div>
                  </div>
                  <p className="text-xs text-foreground-lighter max-w-xs">
                    If you wish to use a Direct Connection with these, please purchase{' '}
                    <Link
                      href={`/project/${projectRef}/settings/addons?panel=ipv4`}
                      className="text-xs text-light hover:text-foreground"
                    >
                      IPv4 support
                    </Link>
                    .
                  </p>
                  <p className="text-xs text-foreground-lighter max-w-xs">
                    You may also use the{' '}
                    <span className="text-foreground-light">Session Pooler</span> or{' '}
                    <span className="text-foreground-light">Transaction Pooler</span> if you are on
                    a IPv4 network.
                  </p>
                </div>
              </CollapsibleContent_Shadcn_>
            </Collapsible_Shadcn_>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}