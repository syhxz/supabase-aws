import dayjs from 'dayjs'
import { Check, Copy, Code, Globe } from 'lucide-react'
import { useRouter } from 'next/router'
import { useState, useMemo } from 'react'

import { useParams } from 'common/hooks'
import { useProjectSettingsV2Query } from 'data/config/project-settings-v2-query'
import { useCustomDomainsQuery } from 'data/custom-domains/custom-domains-query'
import type { EdgeFunctionsResponse } from 'data/edge-functions/edge-functions-query'
import { copyToClipboard, TableCell, TableRow, Badge } from 'ui'
import { TimestampInfo } from 'ui-patterns'

interface EdgeFunctionsListItemProps {
  function: EdgeFunctionsResponse & {
    deploymentSource?: 'ui' | 'api' | string
    deployedViaStudio?: boolean
    deployedViaAPI?: boolean
    source?: string
  }
}

export const EdgeFunctionsListItem = ({ function: item }: EdgeFunctionsListItemProps) => {
  const router = useRouter()
  const { ref } = useParams()
  const [isCopied, setIsCopied] = useState(false)

  const { data: settings } = useProjectSettingsV2Query({ projectRef: ref })
  const { data: customDomainData } = useCustomDomainsQuery({ projectRef: ref })

  const protocol = settings?.app_config?.protocol ?? 'https'
  const endpoint = settings?.app_config?.endpoint ?? ''
  const functionUrl =
    customDomainData?.customDomain?.status === 'active'
      ? `https://${customDomainData.customDomain.hostname}/functions/v1/${item.slug}`
      : `${protocol}://${endpoint}/functions/v1/${item.slug}`

  // Enhanced function name display with fallback
  const displayName = useMemo(() => {
    if (item.name && item.name.trim()) {
      return item.name
    }
    if (item.slug) {
      return item.slug
    }
    return 'Unknown Function'
  }, [item.name, item.slug])

  // Detect deployment source based on metadata patterns
  const deploymentSource = useMemo(() => {
    // Check for deployment source indicators in the function metadata
    if (item.deploymentSource) {
      return item.deploymentSource
    }
    
    // Fallback detection based on metadata patterns
    if (item.deployedViaStudio || item.source === 'studio') {
      return 'ui'
    }
    
    if (item.deployedViaAPI || item.source === 'api') {
      return 'api'
    }
    
    // Default to 'ui' for backward compatibility
    return 'ui'
  }, [item])

  const deploymentSourceConfig = useMemo(() => {
    switch (deploymentSource) {
      case 'api':
        return {
          label: 'API',
          icon: Code,
          variant: 'outline' as const,
          description: 'Deployed via API'
        }
      case 'ui':
        return {
          label: 'Studio',
          icon: Globe,
          variant: 'default' as const,
          description: 'Deployed via Studio UI'
        }
      default:
        return {
          label: 'Unknown',
          icon: Code,
          variant: 'secondary' as const,
          description: 'Unknown deployment source'
        }
    }
  }, [deploymentSource])

  return (
    <TableRow
      key={item.id}
      onClick={() => {
        router.push(`/project/${ref}/functions/${item.slug}`)
      }}
      className="cursor-pointer"
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm text-foreground whitespace-nowrap font-medium">{displayName}</p>
            {item.slug !== displayName && (
              <p className="text-xs text-foreground-light">{item.slug}</p>
            )}
          </div>
          <Badge 
            variant={deploymentSourceConfig.variant}
            className="flex items-center gap-1 text-xs"
          >
            <deploymentSourceConfig.icon size={12} />
            {deploymentSourceConfig.label}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-xs text-foreground-light flex gap-2 items-center truncate">
          <p title={functionUrl} className="font-mono truncate hidden md:inline max-w-[30rem]">
            {functionUrl}
          </p>
          <button
            type="button"
            className="text-foreground-lighter hover:text-foreground transition"
            onClick={(event: any) => {
              function onCopy(value: any) {
                setIsCopied(true)
                copyToClipboard(value)
                setTimeout(() => setIsCopied(false), 3000)
              }
              event.stopPropagation()
              onCopy(functionUrl)
            }}
          >
            {isCopied ? (
              <div className="text-brand">
                <Check size={14} strokeWidth={3} />
              </div>
            ) : (
              <div className="relative">
                <div className="block">
                  <Copy size={14} strokeWidth={1.5} />
                </div>
              </div>
            )}
          </button>
        </div>
      </TableCell>
      <TableCell className="hidden 2xl:table-cell">
        <p className="text-foreground-light">
          {dayjs(item.created_at).format('DD MMM, YYYY HH:mm')}
        </p>
      </TableCell>
      <TableCell className="lg:table-cell">
        <TimestampInfo
          className="text-sm text-foreground-light"
          utcTimestamp={item.updated_at}
          label={dayjs(item.updated_at).fromNow()}
        />
      </TableCell>
      <TableCell className="lg:table-cell">
        <p className="text-foreground-light">{item.version}</p>
      </TableCell>
    </TableRow>
  )
}
