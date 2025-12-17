import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Alert } from 'ui'
import { RefreshCw, AlertTriangle, Info } from 'lucide-react'
import { ContainerStatusDisplay } from './ContainerStatusDisplay'
import { DockerContainerService, type ContainerStatus, type HealthCheckResult } from 'lib/api/self-hosted/docker-container-service'

interface ServiceStatusPanelProps {
  projectRef: string
  focusedService?: string
  onServiceAction?: (action: string, service: string, result: boolean) => void
}

export function ServiceStatusPanel({ 
  projectRef, 
  focusedService = 'supavisor',
  onServiceAction 
}: ServiceStatusPanelProps) {
  const [containers, setContainers] = useState<ContainerStatus[]>([])
  const [healthResults, setHealthResults] = useState<Map<string, HealthCheckResult>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dockerService = new DockerContainerService()

  const loadContainerStatus = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      // Get Supabase containers
      const supabaseContainers = await dockerService.getSupabaseContainersStatus()
      setContainers(supabaseContainers)

      // Get health status for each running container
      const healthMap = new Map<string, HealthCheckResult>()
      
      for (const container of supabaseContainers) {
        if (container.status === 'running') {
          try {
            const health = await dockerService.getContainerHealth(container.name)
            healthMap.set(container.name, health)
          } catch (healthError) {
            console.warn(`Failed to get health for ${container.name}:`, healthError)
          }
        }
      }
      
      setHealthResults(healthMap)
    } catch (err) {
      console.error('Failed to load container status:', err)
      setError(err instanceof Error ? err.message : 'Failed to load container status')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadContainerStatus()
    
    // Set up periodic refresh for health status
    const interval = setInterval(() => {
      loadContainerStatus(true)
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [projectRef])

  const handleContainerAction = async (
    action: 'restart' | 'start' | 'stop',
    containerName: string
  ) => {
    setActionLoading(containerName)
    
    try {
      let result: { success: boolean; message: string }
      
      switch (action) {
        case 'restart':
          result = await dockerService.restartContainer(containerName)
          break
        case 'start':
          result = await dockerService.startContainer(containerName)
          break
        case 'stop':
          result = await dockerService.stopContainer(containerName)
          break
        default:
          throw new Error(`Unknown action: ${action}`)
      }

      if (result.success) {
        console.log('Success:', result.message)
        onServiceAction?.(action, containerName, true)
        
        // Refresh status after a short delay
        setTimeout(() => {
          loadContainerStatus(true)
        }, 2000)
      } else {
        console.error('Error:', result.message)
        onServiceAction?.(action, containerName, false)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to ${action} container`
      console.error('Container action error:', message)
      onServiceAction?.(action, containerName, false)
    } finally {
      setActionLoading(null)
    }
  }

  const handleViewLogs = async (containerName: string) => {
    try {
      const logs = await dockerService.getContainerLogs(containerName, 50)
      
      // In a real implementation, you might open a modal or navigate to a logs page
      console.log(`Logs for ${containerName}:`, logs)
      console.log(`Retrieved ${logs.length} log lines for ${containerName}`)
    } catch (err) {
      console.error(`Failed to retrieve logs for ${containerName}`)
    }
  }

  const focusedContainer = containers?.find?.(c => 
    c.name.includes(focusedService) || c.name.includes(`supabase-${focusedService}`)
  )
  
  const otherContainers = containers?.filter(c => 
    !c.name.includes(focusedService) && !c.name.includes(`supabase-${focusedService}`)
  ) ?? []

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading Service Status...
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Service Status Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert title="Service Status Error">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </Alert>
          <Button 
            className="mt-4" 
            type="outline" 
            onClick={() => loadContainerStatus()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Service Status
              {isRefreshing && <RefreshCw className="h-4 w-4 animate-spin" />}
            </CardTitle>
            <Button
              type="outline"
              size="small"
              onClick={() => loadContainerStatus(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {containers.length === 0 ? (
            <Alert title="No Services Found">
              <Info className="h-4 w-4" />
              No Supabase containers found. Make sure Docker is running and Supabase services are started.
            </Alert>
          ) : (
            <div className="space-y-4">
              {focusedContainer && (
                <div>
                  <h4 className="text-sm font-medium mb-3 text-gray-700">
                    {focusedService.charAt(0).toUpperCase() + focusedService.slice(1)} Service
                  </h4>
                  <ContainerStatusDisplay
                    container={focusedContainer}
                    health={healthResults.get(focusedContainer.name)}
                    onRestart={(name) => handleContainerAction('restart', name)}
                    onStart={(name) => handleContainerAction('start', name)}
                    onStop={(name) => handleContainerAction('stop', name)}
                    onViewLogs={handleViewLogs}
                    isLoading={actionLoading === focusedContainer.name}
                  />
                </div>
              )}
              
              {otherContainers.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3 text-gray-700">
                    Other Services
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    {otherContainers.map((container) => (
                      <ContainerStatusDisplay
                        key={container.name}
                        container={container}
                        health={healthResults.get(container.name)}
                        onRestart={(name) => handleContainerAction('restart', name)}
                        onStart={(name) => handleContainerAction('start', name)}
                        onStop={(name) => handleContainerAction('stop', name)}
                        onViewLogs={handleViewLogs}
                        isLoading={actionLoading === container.name}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}