import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Tabs_Shadcn_ as Tabs, TabsContent_Shadcn_ as TabsContent, TabsList_Shadcn_ as TabsList, TabsTrigger_Shadcn_ as TabsTrigger, Alert } from 'ui'
import { Activity, Server, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import { ServiceStatusPanel } from './ServiceStatusPanel'
import { useDockerContainersQuery, useContainerActionMutation } from 'data/database/docker-containers-query'
import { useSupavisorHealthQuery } from 'data/database/supavisor-health-query'

interface ServiceStatusDashboardProps {
  projectRef: string
  className?: string
}

export function ServiceStatusDashboard({ projectRef, className }: ServiceStatusDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')
  
  // Query for all containers
  const {
    data: containers,
    isLoading: containersLoading,
    error: containersError,
    refetch: refetchContainers
  } = useDockerContainersQuery({ projectRef })

  // Query for Supavisor health specifically
  const {
    data: supavisorHealth,
    isLoading: healthLoading,
    error: healthError
  } = useSupavisorHealthQuery({ projectRef })

  // Container action mutation
  const containerActionMutation = useContainerActionMutation({
    onSuccess: (data: any) => {
      console.log('Container action success:', data.message)
    },
    onError: (error: any) => {
      console.error('Container action error:', error.message || 'Container action failed')
    }
  })

  const handleServiceAction = (action: string, service: string, result: boolean) => {
    console.log(`Service action: ${action} on ${service}, result: ${result}`)
  }

  const getOverallHealthStatus = () => {
    if (containersLoading || healthLoading) {
      return { status: 'loading', message: 'Checking services...' }
    }

    if (containersError || healthError) {
      return { 
        status: 'error', 
        message: 'Unable to check service status' 
      }
    }

    if (!containers || containers.length === 0) {
      return { 
        status: 'warning', 
        message: 'No services detected' 
      }
    }

    const runningContainers = containers.filter((c: any) => c.status === 'running')
    const totalContainers = containers.length

    if (runningContainers.length === totalContainers) {
      return { 
        status: 'healthy', 
        message: `All ${totalContainers} services are running` 
      }
    } else if (runningContainers.length > 0) {
      return { 
        status: 'warning', 
        message: `${runningContainers.length}/${totalContainers} services are running` 
      }
    } else {
      return { 
        status: 'error', 
        message: 'No services are running' 
      }
    }
  }

  const overallHealth = getOverallHealthStatus()

  const getStatusIcon = () => {
    switch (overallHealth.status) {
      case 'loading':
        return <RefreshCw className="h-5 w-5 animate-spin text-gray-500" />
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      default:
        return <Server className="h-5 w-5 text-gray-500" />
    }
  }

  const getSupavisorStatus = () => {
    const supavisorContainer = containers?.find?.((c: any) => 
      c.name.includes('supavisor') || c.name.includes('supabase-supavisor')
    )

    if (!supavisorContainer) {
      return { status: 'not-found', message: 'Supavisor container not found' }
    }

    if (supavisorContainer.status !== 'running') {
      return { 
        status: 'stopped', 
        message: `Supavisor is ${supavisorContainer.status}` 
      }
    }

    if (supavisorHealth?.healthy) {
      return { status: 'healthy', message: 'Supavisor is healthy and ready' }
    } else if (supavisorHealth?.healthy === false) {
      return { 
        status: 'unhealthy', 
        message: supavisorHealth.message || 'Supavisor health check failed' 
      }
    }

    return { status: 'unknown', message: 'Supavisor status unknown' }
  }

  const supavisorStatus = getSupavisorStatus()

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Service Status Dashboard
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="supavisor">Supavisor</TabsTrigger>
              <TabsTrigger value="all-services">All Services</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {getStatusIcon()}
                      Overall Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">{overallHealth.message}</p>
                    {overallHealth.status === 'error' && (
                      <Button 
                        className="mt-3" 
                        type="outline" 
                        size="small"
                        onClick={() => refetchContainers()}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Status
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Server className="h-4 w-4" />
                      Connection Pooling
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">{supavisorStatus.message}</p>
                    {supavisorStatus.status === 'stopped' && (
                      <Button 
                        className="mt-3" 
                        type="outline" 
                        size="small"
                        onClick={() => {
                          const supavisorContainer = containers?.find?.((c: any) => 
                            c.name.includes('supavisor')
                          )
                          if (supavisorContainer) {
                            containerActionMutation.mutate({
                              projectRef,
                              container: supavisorContainer.name,
                              action: 'start'
                            })
                          }
                        }}
                        disabled={containerActionMutation.isPending}
                      >
                        {containerActionMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Start Supavisor
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>

              {(containersError || healthError) && (
                <Alert title="Service Status Error">
                  <AlertTriangle className="h-4 w-4" />
                  {containersError?.message || healthError?.message || 'Failed to load service status'}
                </Alert>
              )}
            </TabsContent>
            
            <TabsContent value="supavisor">
              <ServiceStatusPanel
                projectRef={projectRef}
                focusedService="supavisor"
                onServiceAction={handleServiceAction}
              />
            </TabsContent>
            
            <TabsContent value="all-services">
              <ServiceStatusPanel
                projectRef={projectRef}
                onServiceAction={handleServiceAction}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}