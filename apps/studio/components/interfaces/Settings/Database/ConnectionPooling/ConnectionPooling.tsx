import { zodResolver } from '@hookform/resolvers/zod'
import { PermissionAction } from '@supabase/shared-types/out/constants'
import { capitalize } from 'lodash'
import { Fragment, useEffect, useMemo } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import z from 'zod'

import { useParams } from 'common'
import AlertError from 'components/ui/AlertError'
import { DocsButton } from 'components/ui/DocsButton'
import { ArrayErrorBoundary } from 'components/ui/ErrorBoundary/ArrayErrorBoundary'
import { setValueAsNullableNumber } from 'components/ui/Forms/Form.constants'
import { FormActions } from 'components/ui/Forms/FormActions'
import { InlineLink } from 'components/ui/InlineLink'
import Panel from 'components/ui/Panel'
import { useMaxConnectionsQuery } from 'data/database/max-connections-query'
import { usePoolingConfigurationQuery } from 'data/database/pooling-configuration-query'
import { usePoolingConfigurationUpdateMutation } from 'data/database/pooling-configuration-update-mutation'
import { usePoolingServiceDetectionQuery } from 'data/database/pooling-service-detection-query'
import { safeFind, ensureArray, isArray } from 'lib/array-validation'
import { PoolingServiceAdapter } from 'lib/api/self-hosted/pooling-service-detector'

import { PoolMonitoringPanel } from './PoolMonitoringPanel'
import { 
  PoolingErrorBoundary, 
  SupavisorErrorStates, 
  SupavisorSetupGuidance,
  ConfigurationUpdateFeedback,
  useConfigurationUpdateFeedback
} from './ErrorHandling'
import { useProjectAddonsQuery } from 'data/subscriptions/project-addons-query'
import { useAsyncCheckPermissions } from 'hooks/misc/useCheckPermissions'
import { useSelectedOrganizationQuery } from 'hooks/misc/useSelectedOrganization'
import { useSelectedProjectQuery } from 'hooks/misc/useSelectedProject'
import { DOCS_URL, IS_PLATFORM } from 'lib/constants'
import {
  AlertDescription_Shadcn_,
  AlertTitle_Shadcn_,
  Alert_Shadcn_,
  Badge,
  FormControl_Shadcn_,
  FormField_Shadcn_,
  Form_Shadcn_,
  Input_Shadcn_,
  Separator,
} from 'ui'
import { Admonition } from 'ui-patterns'
import { FormItemLayout } from 'ui-patterns/form/FormItemLayout/FormItemLayout'
import ShimmeringLoader from 'ui-patterns/ShimmeringLoader'
import { POOLING_OPTIMIZATIONS } from './ConnectionPooling.constants'

const formId = 'pooling-configuration-form'

const PoolingConfigurationFormSchema = z.object({
  poolSize: z.number().nullable(),
  maxClientConnections: z.number().nullable(),
})

/**
 * Unified ConnectionPooling component that works with both PgBouncer (platform) and Supavisor (self-hosted)
 */
export const ConnectionPooling = () => {
  const { ref: projectRef } = useParams()
  const { data: project } = useSelectedProjectQuery()
  const { data: org } = useSelectedOrganizationQuery()

  const { can: canUpdateConnectionPoolingConfiguration } = useAsyncCheckPermissions(
    PermissionAction.UPDATE,
    'projects',
    { resource: { project_id: project?.id } }
  )

  const {
    data: poolingConfig,
    error: poolingConfigError,
    isLoading: isLoadingPoolingConfig,
    isError: isErrorPoolingConfig,
    isSuccess: isSuccessPoolingConfig,
  } = usePoolingConfigurationQuery({ projectRef })

  const {
    data: serviceDetection,
    isLoading: isLoadingDetection,
    isError: isErrorDetection,
  } = usePoolingServiceDetectionQuery({ projectRef })



  const disablePoolModeSelection = useMemo(() => {
    return org?.plan?.id === 'free'
  }, [org])

  const { data: maxConnData } = useMaxConnectionsQuery({
    projectRef: project?.ref,
    connectionString: project?.connectionString,
  })
  const { data: addons, isSuccess: isSuccessAddons } = useProjectAddonsQuery({ projectRef })

  // Validate addons data and log any issues for debugging
  useEffect(() => {
    if (isSuccessAddons && addons) {
      if (!isArray(addons.selected_addons)) {
        console.warn('[ConnectionPooling] Invalid addons data format:', {
          addons,
          selectedAddonsType: typeof addons.selected_addons,
          expectedType: 'array'
        })
      }
    }
  }, [addons, isSuccessAddons])

  const { mutate: updatePoolerConfig, isPending: isUpdatingPoolerConfig } =
    usePoolingConfigurationUpdateMutation()

  const {
    updateState,
    startUpdate,
    updateSuccess,
    updateError,
    resetState
  } = useConfigurationUpdateFeedback()

  // Safe array operations with validation and fallback behavior
  const selectedAddons = ensureArray(addons?.selected_addons)
  const hasIpv4Addon = !!safeFind(selectedAddons, (addon: any) => addon?.type === 'ipv4')
  const computeInstance = safeFind(selectedAddons, (addon: any) => addon?.type === 'compute_instance')
  const computeSize =
    computeInstance?.variant?.name ?? capitalize(project?.infra_compute_size) ?? 'Nano'
  const poolingOptimizations =
    POOLING_OPTIMIZATIONS[
      (computeInstance?.variant?.identifier as keyof typeof POOLING_OPTIMIZATIONS) ??
        (project?.infra_compute_size === 'nano' ? 'ci_nano' : 'ci_micro')
    ] ?? POOLING_OPTIMIZATIONS.ci_nano
  const defaultPoolSize = poolingOptimizations.poolSize ?? 15
  const defaultMaxClientConn = poolingOptimizations.maxClientConn ?? 200

  const form = useForm<z.infer<typeof PoolingConfigurationFormSchema>>({
    resolver: zodResolver(PoolingConfigurationFormSchema),
    defaultValues: {
      poolSize: undefined,
      maxClientConnections: null,
    },
  })
  const { poolSize } = form.watch()
  const connectionPoolingUnavailable = poolingConfig?.isEnabled === false
  
  // Environment and service detection with adaptation
  const environment = poolingConfig?.environment || (IS_PLATFORM ? 'platform' : 'self-hosted')
  const poolingService = poolingConfig?.poolingService || (IS_PLATFORM ? 'pgbouncer' : 'supavisor')
  
  // Get UI configuration based on detected service and capabilities
  const uiConfig = serviceDetection ? 
    PoolingServiceAdapter.getUIConfiguration(
      serviceDetection.primary.service,
      serviceDetection.primary
    ) : {
      serviceName: poolingService === 'pgbouncer' ? 'PgBouncer' : 'Supavisor',
      badgeVariant: poolingService === 'supavisor' ? 'default' : 'secondary',
      showHealthStatus: true,
      showStatistics: true,
      allowConfigurationUpdate: true,
      showContainerManagement: !IS_PLATFORM,
      documentationUrl: poolingService === 'pgbouncer' 
        ? '/guides/database/connecting-to-postgres#connection-pooler'
        : '/guides/database/connection-management#configuring-supavisors-pool-size',
      description: poolingService === 'pgbouncer' 
        ? 'Platform connection pooling service'
        : 'Self-hosted connection pooling service',
      features: poolingService === 'pgbouncer'
        ? ['Connection pooling', 'Load balancing', 'Connection reuse']
        : ['Connection pooling', 'Multi-tenant support', 'Real-time monitoring']
    }

  const serviceName = uiConfig.serviceName
  const capabilities = poolingConfig?.capabilities || serviceDetection?.primary.features

  // Error type detection for self-hosted environments
  const getErrorType = () => {
    if (!poolingConfigError) return null
    
    const errorMessage = poolingConfigError.message || ''
    
    if (errorMessage.includes('environment variable') || errorMessage.includes('POOLER_TENANT_ID')) {
      return 'missing-config'
    }
    if (errorMessage.includes('service is not running') || errorMessage.includes('container')) {
      return 'service-unavailable'
    }
    if (errorMessage.includes('invalid') || errorMessage.includes('must be greater than 0')) {
      return 'configuration-invalid'
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return 'network-error'
    }
    
    return null
  }

  const onSubmit: SubmitHandler<z.infer<typeof PoolingConfigurationFormSchema>> = async (data) => {
    const { poolSize } = data

    if (!projectRef) return console.error('Project ref is required')

    startUpdate()

    updatePoolerConfig(
      {
        projectRef,
        poolSize: poolSize === null ? undefined : poolSize,
      },
      {
        onSuccess: (data) => {
          updateSuccess(
            `Successfully updated ${serviceName} configuration`,
            { poolSize: data?.poolSize, maxClientConnections: data?.maxClientConnections }
          )
          if (data) {
            form.reset({
              poolSize: data.poolSize,
              maxClientConnections: data.maxClientConnections,
            })
          }
        },
        onError: (error) => {
          updateError(
            error instanceof Error ? error : new Error('Unknown error'),
            `Failed to update ${serviceName} configuration`
          )
        }
      }
    )
  }

  const resetForm = () => {
    form.reset({
      poolSize: poolingConfig?.poolSize ?? defaultPoolSize,
      maxClientConnections: poolingConfig?.maxClientConnections ?? defaultMaxClientConn,
    })
  }

  useEffect(() => {
    if (isSuccessPoolingConfig) resetForm()
  }, [isSuccessPoolingConfig])

  return (
    <ArrayErrorBoundary 
      projectRef={projectRef}
      onError={(error, errorInfo) => {
        console.error('Array error in ConnectionPooling component:', {
          error: error.message,
          addonsData: addons,
          selectedAddonsType: typeof addons?.selected_addons,
          isSelectedAddonsArray: isArray(addons?.selected_addons)
        })
      }}
      onRetry={() => {
        // Force re-render by clearing form state
        form.reset()
      }}
    >
      <PoolingErrorBoundary projectRef={projectRef}>
        <section id="connection-pooler">
        {/* Configuration Update Feedback */}
        <ConfigurationUpdateFeedback
          updateState={updateState}
          onRetry={() => {
            resetState()
            // Retry the last form submission
            if (form.formState.isValid) {
              form.handleSubmit(onSubmit)()
            }
          }}
          onDismiss={resetState}
          serviceName={serviceName}
        />

        <Panel
        className="!mb-0"
        title={
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-x-2">
              <p>Connection pooling configuration</p>
              <div className="flex items-center gap-x-2">
                <Badge variant={uiConfig.badgeVariant as any}>
                  {serviceName}
                </Badge>

                {poolingConfig?.fallbackService && (
                  <Badge variant="outline">
                    Fallback from {poolingConfig.fallbackService === 'pgbouncer' ? 'PgBouncer' : 'Supavisor'}
                  </Badge>
                )}

                {!serviceDetection?.primary.isHealthy && serviceDetection?.primary.isAvailable && (
                  <Badge variant="destructive">Unhealthy</Badge>
                )}

                {!serviceDetection?.primary.isAvailable && (
                  <Badge variant="secondary">Unavailable</Badge>
                )}

                {disablePoolModeSelection && (
                  <Badge variant="outline">Shared Pooler</Badge>
                )}
              </div>
            </div>
            <DocsButton
              href={uiConfig.documentationUrl ? `${DOCS_URL}${uiConfig.documentationUrl}` : `${DOCS_URL}/guides/database/connecting-to-postgres#connection-pooler`}
            />
          </div>
        }
        footer={
          <FormActions
            form={formId}
            isSubmitting={isUpdatingPoolerConfig}
            hasChanges={form.formState.isDirty}
            handleReset={() => resetForm()}
            helper={
              !canUpdateConnectionPoolingConfiguration
                ? 'You need additional permissions to update connection pooling settings'
                : !capabilities?.configurationUpdate
                ? `Configuration updates are not available for ${serviceName}`
                : !serviceDetection?.primary.isAvailable
                ? `${serviceName} service is not available`
                : undefined
            }
          />
        }
      >
        {isSuccessAddons && !disablePoolModeSelection && !hasIpv4Addon && (
          <Admonition
            className="border-x-0 border-t-0 rounded-none"
            type="default"
            title="Dedicated Pooler is not IPv4 compatible"
          >
            <p className="!m-0">
              If your network only supports IPv4, consider purchasing the{' '}
              <InlineLink href={`/project/${projectRef}/settings/addons?panel=ipv4`}>
                IPv4 add-on
              </InlineLink>
            </p>
          </Admonition>
        )}
        <Panel.Content>
          {/* Service Detection Information */}
          {serviceDetection && poolingConfig?.detectionReason && (
            <div className="mb-4">
              <Alert_Shadcn_ variant="default">
                <AlertTitle_Shadcn_>Service Detection</AlertTitle_Shadcn_>
                <AlertDescription_Shadcn_>
                  {poolingConfig.detectionReason}
                  {serviceDetection.fallback && (
                    <div className="mt-2">
                      Fallback service available: {serviceDetection.fallback.service === 'pgbouncer' ? 'PgBouncer' : 'Supavisor'}
                    </div>
                  )}
                </AlertDescription_Shadcn_>
              </Alert_Shadcn_>
            </div>
          )}

          {/* Service Capabilities Information */}
          {capabilities && environment === 'self-hosted' && (
            <div className="mb-4">
              <div className="text-sm text-foreground-light">
                <p className="font-medium mb-2">Available Features:</p>
                <div className="flex flex-wrap gap-2">
                  {capabilities.configurationUpdate && (
                    <Badge variant="outline">Configuration Updates</Badge>
                  )}
                  {capabilities.statisticsMonitoring && (
                    <Badge variant="outline">Statistics Monitoring</Badge>
                  )}
                  {capabilities.healthChecks && (
                    <Badge variant="outline">Health Checks</Badge>
                  )}
                  {capabilities.containerManagement && (
                    <Badge variant="outline">Container Management</Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {(isLoadingPoolingConfig || isLoadingDetection) && (
            <div className="flex flex-col gap-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Fragment key={`loader-${i}`}>
                  <div className="grid gap-2 items-center md:grid md:grid-cols-12 md:gap-x-4 w-full">
                    <ShimmeringLoader className="h-4 w-1/3 col-span-4" delayIndex={i} />
                    <ShimmeringLoader className="h-8 w-full col-span-8" delayIndex={i} />
                  </div>
                  <Separator />
                </Fragment>
              ))}

              <ShimmeringLoader className="h-8 w-full" />
            </div>
          )}
          {isErrorPoolingConfig && environment === 'self-hosted' && (
            <SupavisorErrorStates
              projectRef={projectRef}
              errorType={getErrorType() || 'network-error'}
              error={poolingConfigError}
              onRetry={() => window.location.reload()}
            />
          )}
          {isErrorPoolingConfig && environment === 'platform' && (
            <AlertError
              error={poolingConfigError}
              subject={`Failed to retrieve ${serviceName} configuration`}
            />
          )}
          {connectionPoolingUnavailable && environment === 'self-hosted' && (
            <SupavisorSetupGuidance projectRef={projectRef} />
          )}
          {connectionPoolingUnavailable && environment === 'platform' && (
            <Admonition
              type="default"
              title={`${serviceName} configuration unavailable`}
              description="Please start a new project to enable this feature"
            />
          )}

          {/* Pool Monitoring Panel - show when statistics monitoring is available */}
          {uiConfig.showStatistics && capabilities?.statisticsMonitoring && (
            <div className="mb-6">
              <PoolMonitoringPanel 
                projectRef={projectRef}
                environment={environment}
                poolingService={poolingService}
              />
            </div>
          )}

          {isSuccessPoolingConfig && (
            <Form_Shadcn_ {...form}>
              <form
                id={formId}
                className="flex flex-col gap-y-6 w-full"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <FormField_Shadcn_
                  control={form.control}
                  name="poolSize"
                  render={({ field }) => (
                    <FormItemLayout
                      layout="horizontal"
                      label="Pool Size"
                      description={
                        <p>
                          The maximum number of connections made to the underlying Postgres cluster,
                          per user+db combination. Pool size has a default of {defaultPoolSize}{' '}
                          based on your compute size of {computeSize}.
                        </p>
                      }
                    >
                      <FormControl_Shadcn_>
                        <Input_Shadcn_
                          {...field}
                          type="number"
                          className="w-full"
                          value={field.value || ''}
                          placeholder={defaultPoolSize.toString()}
                          {...form.register('poolSize', {
                            setValueAs: setValueAsNullableNumber,
                          })}
                        />
                      </FormControl_Shadcn_>
                      {!!maxConnData &&
                        (poolSize ?? 15) > maxConnData.maxConnections * 0.8 && (
                          <Alert_Shadcn_ variant="warning" className="mt-2">
                            <AlertTitle_Shadcn_ className="text-foreground">
                              Pool size is greater than 80% of the max connections (
                              {maxConnData.maxConnections}) on your database
                            </AlertTitle_Shadcn_>
                            <AlertDescription_Shadcn_>
                              This may result in instability and unreliability with your database
                              connections.
                            </AlertDescription_Shadcn_>
                          </Alert_Shadcn_>
                        )}
                    </FormItemLayout>
                  )}
                />

                <FormField_Shadcn_
                  control={form.control}
                  name="maxClientConnections"
                  render={({ field }) => (
                    <FormItemLayout
                      layout="horizontal"
                      label="Max Client Connections"
                      description={
                        <>
                          <p>
                            The maximum number of concurrent client connections allowed. 
                            {environment === 'platform' ? (
                              <>This value is fixed at {defaultMaxClientConn} based on your compute size of {computeSize} and cannot be changed.</>
                            ) : (
                              <>Current value: {poolingConfig?.maxClientConnections || defaultMaxClientConn}</>
                            )}
                          </p>
                          <p className="mt-2">
                            Please refer to our{' '}
                            <InlineLink
                              href={`${DOCS_URL}/guides/database/connection-management#configuring-supavisors-pool-size`}
                            >
                              documentation
                            </InlineLink>{' '}
                            to find out more.
                          </p>
                        </>
                      }
                    >
                      <FormControl_Shadcn_>
                        <Input_Shadcn_
                          {...field}
                          type="number"
                          className="w-full"
                          value={poolingConfig?.maxClientConnections || ''}
                          disabled={true}
                          placeholder={defaultMaxClientConn.toString()}
                          {...form.register('maxClientConnections', {
                            setValueAs: setValueAsNullableNumber,
                          })}
                        />
                      </FormControl_Shadcn_>
                    </FormItemLayout>
                  )}
                />
              </form>
            </Form_Shadcn_>
          )}
        </Panel.Content>
      </Panel>
    </section>
      </PoolingErrorBoundary>
    </ArrayErrorBoundary>
  )
}
