import React from 'react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from 'ui'
import { AlertCircle, CheckCircle, Clock, XCircle, RefreshCw, Play, Square } from 'lucide-react'
import type { ContainerStatus, HealthCheckResult } from 'lib/api/self-hosted/docker-container-service'

interface ContainerStatusDisplayProps {
  container: ContainerStatus
  health?: HealthCheckResult
  onRestart?: (containerName: string) => void
  onStart?: (containerName: string) => void
  onStop?: (containerName: string) => void
  onViewLogs?: (containerName: string) => void
  isLoading?: boolean
}

export function ContainerStatusDisplay({
  container,
  health,
  onRestart,
  onStart,
  onStop,
  onViewLogs,
  isLoading = false
}: ContainerStatusDisplayProps) {
  const getStatusIcon = () => {
    if (isLoading) {
      return <RefreshCw className="h-4 w-4 animate-spin" />
    }

    switch (container.status) {
      case 'running':
        return health?.healthy ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-yellow-600" />
        )
      case 'stopped':
        return <Square className="h-4 w-4 text-gray-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = () => {
    if (isLoading) {
      return <Badge variant="outline">Checking...</Badge>
    }

    switch (container.status) {
      case 'running':
        return health?.healthy ? (
          <Badge variant="success">Healthy</Badge>
        ) : (
          <Badge variant="warning">Unhealthy</Badge>
        )
      case 'stopped':
        return <Badge variant="secondary">Stopped</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getHealthMessage = () => {
    if (health?.message) {
      return health.message
    }
    
    switch (container.status) {
      case 'running':
        return 'Container is running'
      case 'stopped':
        return 'Container is stopped'
      case 'error':
        return 'Container has encountered an error'
      default:
        return 'Status unknown'
    }
  }

  const canRestart = container.status === 'running' || container.status === 'error'
  const canStart = container.status === 'stopped'
  const canStop = container.status === 'running'

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {getStatusIcon()}
            {container.name}
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          {getHealthMessage()}
        </div>

        {health?.responseTime && (
          <div className="text-xs text-gray-500">
            Response time: {health.responseTime}ms
          </div>
        )}

        {container.uptime && container.uptime !== '0' && (
          <div className="text-xs text-gray-500">
            Uptime: {container.uptime}
          </div>
        )}

        {container.ports.length > 0 && (
          <div className="text-xs text-gray-500">
            Ports: {container.ports.map(p => `${p.host}:${p.container}`).join(', ')}
          </div>
        )}

        {container.image && (
          <div className="text-xs text-gray-500">
            Image: {container.image}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {canStart && onStart && (
            <Button
              size="small"
              type="outline"
              onClick={() => onStart(container.name)}
              disabled={isLoading}
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}
          
          {canStop && onStop && (
            <Button
              size="small"
              type="outline"
              onClick={() => onStop(container.name)}
              disabled={isLoading}
            >
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          )}
          
          {canRestart && onRestart && (
            <Button
              size="small"
              type="outline"
              onClick={() => onRestart(container.name)}
              disabled={isLoading}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Restart
            </Button>
          )}
          
          {onViewLogs && (
            <Button
              size="small"
              type="text"
              onClick={() => onViewLogs(container.name)}
              disabled={isLoading}
            >
              View Logs
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}