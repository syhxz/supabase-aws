import { zodResolver } from '@hookform/resolvers/zod'
import { PermissionAction } from '@supabase/shared-types/out/constants'
import { indexOf } from 'lodash'
import { Lock } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { useParams } from 'common'
import { DocsButton } from 'components/ui/DocsButton'
import { FormActions } from 'components/ui/Forms/FormActions'
import { useDataApiConfigQuery } from 'data/config/data-api-config-query'
import { useDataApiConfigUpdateMutation } from 'data/config/data-api-config-update-mutation'
import { useDatabaseExtensionsQuery } from 'data/database-extensions/database-extensions-query'
import { useSchemasQuery } from 'data/database/schemas-query'
import { useAsyncCheckPermissions } from 'hooks/misc/useCheckPermissions'
import { useSelectedProjectQuery } from 'hooks/misc/useSelectedProject'
import { DOCS_URL } from 'lib/constants'
import {
  AlertDescription_Shadcn_,
  AlertTitle_Shadcn_,
  Alert_Shadcn_,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CollapsibleContent_Shadcn_,
  Collapsible_Shadcn_,
  FormControl_Shadcn_,
  FormField_Shadcn_,
  FormItem_Shadcn_,
  FormMessage_Shadcn_,
  Form_Shadcn_,
  Input_Shadcn_,
  Separator,
  Skeleton,
  Switch,
  WarningIcon,
  cn,
} from 'ui'
import { GenericSkeletonLoader } from 'ui-patterns'
import { Admonition } from 'ui-patterns/admonition'
import { FormItemLayout } from 'ui-patterns/form/FormItemLayout/FormItemLayout'
import {
  MultiSelector,
  MultiSelectorContent,
  MultiSelectorItem,
  MultiSelectorList,
  MultiSelectorTrigger,
} from 'ui-patterns/multi-select'
import { useDataApiPerformanceMonitoring } from 'hooks/useDataApiPerformanceMonitoring'
import { PerformanceMonitoringDisplay } from './PerformanceMonitoringDisplay'
import { HardenAPIModal } from './HardenAPIModal'

const formSchema = z
  .object({
    dbSchema: z
      .array(z.string())
      .min(0, 'Schema selection is required')
      .refine(
        (schemas) => schemas.every(schema => schema.length > 0),
        'Schema names cannot be empty'
      ),
    dbExtraSearchPath: z
      .array(z.string())
      .max(20, 'Search path cannot contain more than 20 schemas')
      .refine(
        (paths) => paths.every(path => path.length > 0 && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(path)),
        'Search path must contain valid schema names (alphanumeric and underscore only)'
      )
      .refine(
        (paths) => {
          const duplicates = paths.filter((path, index) => paths.indexOf(path) !== index)
          return duplicates.length === 0
        },
        'Search path cannot contain duplicate schema names'
      ),
    maxRows: z
      .number({
        required_error: 'Max rows is required',
        invalid_type_error: 'Max rows must be a number'
      })
      .min(1, 'Max rows must be at least 1')
      .max(1000000, "Max rows can't be more than 1,000,000")
      .int('Max rows must be a whole number'),
    dbPool: z
      .number({
        invalid_type_error: 'Pool size must be a number'
      })
      .min(1, 'Pool size must be at least 1')
      .max(1000, "Pool size can't be more than 1000")
      .int('Pool size must be a whole number')
      .optional()
      .nullable(),
    enableDataApi: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.enableDataApi && data.dbSchema.length === 0) {
        return false
      }
      return true
    },
    {
      message: 'Must have at least one schema if Data API is enabled',
      path: ['dbSchema'],
    }
  )

// Utility function to validate PostgreSQL schema names
const isValidSchemaName = (name: string): boolean => {
  // PostgreSQL identifier rules: start with letter or underscore, followed by letters, digits, underscores
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && name.length <= 63
}

export const PostgrestConfig = () => {
  const { ref: projectRef } = useParams()
  const { data: project } = useSelectedProjectQuery()

  // Performance monitoring
  const {
    startOperation,
    endOperation,
    recordConfigLoadTime,
    getPerformanceSummary,
  } = useDataApiPerformanceMonitoring({
    enableMetrics: true,
    trackErrors: true,
    trackSuccessfulOperations: true,
  })

  const [showModal, setShowModal] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [lastError, setLastError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [networkErrorRetryAttempts, setNetworkErrorRetryAttempts] = useState(0)

  const {
    data: config,
    isError,
    isLoading: isLoadingConfig,
    error: configError,
  } = useDataApiConfigQuery({ projectRef })
  
  const { data: extensions } = useDatabaseExtensionsQuery({
    projectRef: project?.ref,
    connectionString: project?.connectionString,
  })
  const {
    data: allSchemas = [],
    isLoading: isLoadingSchemas,
    isSuccess: isSuccessSchemas,
  } = useSchemasQuery({
    projectRef: project?.ref,
    connectionString: project?.connectionString,
  })

  const isLoading = isLoadingConfig || isLoadingSchemas

  const { mutate: updateDataApiConfig, isPending: isUpdating } =
    useDataApiConfigUpdateMutation({
      onSuccess: (data) => {
        // End performance monitoring with success
        endOperation(true)
        
        // Success feedback with detailed information
        toast.success('Data API configuration updated successfully', {
          description: `Configuration applied at ${new Date(data.appliedAt).toLocaleTimeString()}`,
          duration: 5000,
        })
        
        // Reset error state on success
        setRetryCount(0)
        setLastError(null)
        setNetworkErrorRetryAttempts(0)
        setIsRetrying(false)
      },
      onError: (error) => {
        // End performance monitoring with error
        endOperation(false)
        
        const errorMessage = error.message || 'An unexpected error occurred. Please try again.'
        setLastError(errorMessage)
        setIsRetrying(false)
        
        // Determine error type for appropriate handling
        const isNetworkError = error.message?.includes('network') || 
                              error.message?.includes('timeout') ||
                              error.message?.includes('fetch') ||
                              error.message?.includes('Failed to fetch')
        
        const isValidationError = error.message?.includes('validation') ||
                                 error.message?.includes('invalid')
        
        const isServerError = error.message?.includes('server') ||
                             error.message?.includes('500')

        // Network error handling with automatic retry
        if (isNetworkError && networkErrorRetryAttempts < 3) {
          const nextRetryAttempt = networkErrorRetryAttempts + 1
          setNetworkErrorRetryAttempts(nextRetryAttempt)
          
          toast.error('Network error occurred', {
            description: `Retrying automatically (attempt ${nextRetryAttempt}/3)...`,
            duration: 3000,
            action: {
              label: 'Retry now',
              onClick: () => handleRetry()
            }
          })
          
          // Automatic retry with exponential backoff
          setTimeout(() => {
            handleRetry()
          }, Math.pow(2, nextRetryAttempt) * 1000) // 2s, 4s, 8s delays
          
        } else if (isValidationError) {
          // Validation errors - show specific field errors
          toast.error('Configuration validation failed', {
            description: errorMessage,
            duration: 8000,
          })
          
        } else if (isServerError) {
          // Server errors - offer retry option
          toast.error('Server error occurred', {
            description: errorMessage,
            duration: 6000,
            action: {
              label: 'Retry',
              onClick: () => handleRetry()
            }
          })
          
        } else {
          // Generic error handling
          toast.error('Failed to update Data API configuration', {
            description: errorMessage,
            duration: 6000,
            action: networkErrorRetryAttempts < 3 ? {
              label: 'Retry',
              onClick: () => handleRetry()
            } : {
              label: 'Reset form',
              onClick: () => {
                resetForm()
                setNetworkErrorRetryAttempts(0)
                setLastError(null)
              }
            }
          })
        }
      },
    })

  // Enhanced retry handler with loading state
  const handleRetry = () => {
    setIsRetrying(true)
    setRetryCount(prev => prev + 1)
    
    // Re-submit the form with current values
    const currentValues = form.getValues()
    onSubmit(currentValues)
  }

  const formId = 'project-postgres-config'
  // System schemas to exclude from Data API exposure
  // Includes PostgreSQL system schemas and Supabase internal schemas
  const systemSchemas = [
    'information_schema', 
    'pg_catalog', 
    'pg_toast',
    'auth', 
    'pgbouncer', 
    'hooks', 
    'extensions',
    'realtime',
    'supabase_functions',
    'storage',
    'graphql_public',
    'pgsodium',
    'pgsodium_masks',
    'vault'
  ]
  const { can: canUpdatePostgrestConfig, isSuccess: isPermissionsLoaded } =
    useAsyncCheckPermissions(PermissionAction.UPDATE, 'custom_config_postgrest')

  const isGraphqlExtensionEnabled =
    (extensions ?? []).find((ext) => ext.name === 'pg_graphql')?.installed_version !== null

  const dbSchema = config?.exposedSchemas || []
  const defaultValues = {
    dbSchema,
    maxRows: config?.maxRows || 1000,
    dbExtraSearchPath: config?.extraSearchPath || [],
    dbPool: config?.poolSize,
    enableDataApi: config?.enableDataApi || false,
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues,
  })

  // Enhanced validation for search path against available schemas
  const validateSearchPath = (searchPath: string[]) => {
    const availableSchemaNames = allSchemas.map(schema => schema.name)
    
    // Check for duplicate schemas in search path
    const duplicates = searchPath.filter((schema, index) => searchPath.indexOf(schema) !== index)
    if (duplicates.length > 0) {
      form.setError('dbExtraSearchPath', {
        type: 'manual',
        message: `Duplicate schemas in search path: ${duplicates.join(', ')}`
      })
      return false
    }
    
    // Check for invalid schema names (not in database)
    const invalidSchemas = searchPath.filter(path => !availableSchemaNames.includes(path))
    if (invalidSchemas.length > 0) {
      form.setError('dbExtraSearchPath', {
        type: 'manual',
        message: `Schema names not found in database: ${invalidSchemas.join(', ')}`
      })
      return false
    }
    
    // Check for invalid PostgreSQL identifiers
    const invalidIdentifiers = searchPath.filter(path => !isValidSchemaName(path))
    if (invalidIdentifiers.length > 0) {
      form.setError('dbExtraSearchPath', {
        type: 'manual',
        message: `Invalid PostgreSQL identifiers: ${invalidIdentifiers.join(', ')}`
      })
      return false
    }
    
    // Check search path length limit
    if (searchPath.length > 20) {
      form.setError('dbExtraSearchPath', {
        type: 'manual',
        message: 'Search path cannot contain more than 20 schemas'
      })
      return false
    }
    
    form.clearErrors('dbExtraSearchPath')
    return true
  }

  // Filter schemas for Data API exposure (exclude system schemas)
  const availableSchemas = allSchemas
    .filter((schema) => !systemSchemas.includes(schema.name))
    .map((schema) => ({
      id: schema.id,
      value: schema.name,
      name: schema.name,
      disabled: false,
    })) ?? []

  // All schemas including system schemas for search path configuration
  const allAvailableSchemas = allSchemas.map((schema) => ({
    id: schema.id,
    value: schema.name,
    name: schema.name,
    disabled: false,
  })) ?? []

  function resetForm() {
    const enableDataApi = config?.enableDataApi || false
    form.reset({ ...defaultValues, enableDataApi })
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!projectRef) return console.error('Project ref is required')

    // Start performance monitoring
    startOperation()

    // Validate search path before submission
    if (!validateSearchPath(values.dbExtraSearchPath)) {
      endOperation(false)
      return
    }

    updateDataApiConfig({
      projectRef,
      enableDataApi: values.enableDataApi,
      exposedSchemas: values.dbSchema,
      extraSearchPath: values.dbExtraSearchPath,
      maxRows: values.maxRows,
      poolSize: values.dbPool,
    })
  }

  useEffect(() => {
    if (config && isSuccessSchemas) {
      // Record configuration load time
      const loadTime = performance.now()
      recordConfigLoadTime(loadTime)
      
      /**
       * Checks if enableDataApi should be enabled or disabled
       * based on the db_schema value being empty string
       */
      resetForm()
    }
  }, [config, isSuccessSchemas, recordConfigLoadTime])

  const isDataApiEnabledInForm = form.getValues('enableDataApi')

  return (
    <Card id="postgrest-config">
      <CardHeader className="flex-row items-center justify-between">
        Data API Settings
        <div className="flex items-center gap-x-2">
          <DocsButton href={`${DOCS_URL}/guides/database/connecting-to-postgres#data-apis`} />
          <Button type="default" icon={<Lock />} onClick={() => setShowModal(true)}>
            Harden Data API
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn(!isLoading ? 'p-0' : '')}>
        <Form_Shadcn_ {...form}>
          <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
            {isLoading ? (
              <GenericSkeletonLoader />
            ) : isError ? (
              <div className="px-8 py-8">
                <Admonition 
                  type="destructive" 
                  title="Failed to retrieve API settings"
                  description={
                    <>
                      <p>Unable to load your Data API configuration. This might be due to a network issue or server error.</p>
                      {configError?.message && (
                        <p className="mt-2 text-sm">Error details: {configError.message}</p>
                      )}
                      {lastError && (
                        <p className="mt-2 text-sm font-medium">Last operation error: {lastError}</p>
                      )}
                    </>
                  }
                />
                <div className="flex gap-2 mt-4">
                  <Button 
                    type="default" 
                    onClick={() => window.location.reload()}
                    disabled={isRetrying}
                  >
                    {isRetrying ? 'Retrying...' : 'Retry'}
                  </Button>
                  {networkErrorRetryAttempts > 0 && (
                    <Button 
                      type="outline" 
                      onClick={() => {
                        setNetworkErrorRetryAttempts(0)
                        setLastError(null)
                        window.location.reload()
                      }}
                    >
                      Reset & Reload
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <FormField_Shadcn_
                  control={form.control}
                  name="enableDataApi"
                  render={({ field }) => (
                    <FormItem_Shadcn_ className="w-full">
                      <FormItemLayout
                        className="w-full px-8 py-8"
                        layout="flex"
                        label="Enable Data API"
                        description="When enabled you will be able to use any Supabase client library and PostgREST endpoints with any schema configured below."
                      >
                        <FormControl_Shadcn_>
                          <Switch
                            size="large"
                            disabled={!canUpdatePostgrestConfig}
                            checked={field.value}
                            onCheckedChange={(value) => {
                              field.onChange(value)
                              if (!value) {
                                form.setValue('enableDataApi', false)
                                form.setValue('dbSchema', [])
                              } else {
                                form.setValue('enableDataApi', true)
                                form.setValue('dbSchema', dbSchema)
                              }
                            }}
                          />
                        </FormControl_Shadcn_>
                      </FormItemLayout>
                      <FormMessage_Shadcn_ />

                      {!field.value && (
                        <>
                          <Separator />
                          <Alert_Shadcn_
                            variant="warning"
                            className="mb-0 border-none rounded-none"
                          >
                            <WarningIcon className="!left-[2rem]" />
                            <AlertTitle_Shadcn_ className="!pl-[3.5rem] !left-[6rem]">
                              No schemas can be queried
                            </AlertTitle_Shadcn_>
                            <AlertDescription_Shadcn_ className="!pl-[3.5rem]">
                              <p>
                                With this setting disabled, you will not be able to query any
                                schemas via the Data API.
                              </p>
                              <p>
                                You will see errors from the Postgrest endpoint
                                <code className="text-xs">/rest/v1/</code>.
                              </p>
                            </AlertDescription_Shadcn_>
                          </Alert_Shadcn_>
                        </>
                      )}
                    </FormItem_Shadcn_>
                  )}
                />
                <Collapsible_Shadcn_ open={form.getValues('enableDataApi')}>
                  <CollapsibleContent_Shadcn_ className="border-t divide-y transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                    <FormField_Shadcn_
                      control={form.control}
                      name="dbSchema"
                      render={({ field }) => (
                        <FormItem_Shadcn_ className="w-full">
                          <FormItemLayout
                            label="Exposed schemas"
                            description="The schemas to expose in your API. Tables, views and stored procedures in
                          these schemas will get API endpoints. System schemas are automatically excluded for security."
                            layout="horizontal"
                            className="px-8 py-8"
                          >
                            {isLoadingSchemas ? (
                              <div className="col-span-12 flex flex-col gap-2 lg:col-span-7">
                                <Skeleton className="w-full h-[38px]" />
                              </div>
                            ) : availableSchemas.length === 0 ? (
                              <div className="col-span-12 lg:col-span-7">
                                <Admonition
                                  type="warning"
                                  title="No schemas available"
                                  description="No user schemas are available for Data API exposure. Create a schema or use the public schema to enable Data API functionality."
                                />
                              </div>
                            ) : (
                              <MultiSelector
                                onValuesChange={field.onChange}
                                values={field.value}
                                size="small"
                                disabled={!canUpdatePostgrestConfig || !isDataApiEnabledInForm}
                              >
                                <MultiSelectorTrigger
                                  mode="inline-combobox"
                                  label="Select schemas for Data API..."
                                  badgeLimit="wrap"
                                  showIcon={false}
                                  deletableBadge
                                />
                                <MultiSelectorContent>
                                  <MultiSelectorList>
                                    {availableSchemas.length <= 0 ? (
                                      <MultiSelectorItem key="empty" value="no">
                                        No schemas available
                                      </MultiSelectorItem>
                                    ) : (
                                      availableSchemas.map((schema) => (
                                        <MultiSelectorItem key={schema.id + '-' + schema.name} value={schema.name}>
                                          {schema.name}
                                        </MultiSelectorItem>
                                      ))
                                    )}
                                  </MultiSelectorList>
                                </MultiSelectorContent>
                              </MultiSelector>
                            )}
                          </FormItemLayout>
                          <FormMessage_Shadcn_ />

                          {availableSchemas.length > 0 && (
                            <Admonition
                              type="default"
                              title="Schema filtering"
                              className="mt-2 mx-8"
                              description={
                                <>
                                  <p className="prose text-sm">
                                    System schemas ({systemSchemas.slice(0, 6).join(', ')}, etc.) are automatically excluded from the Data API for security reasons.
                                  </p>
                                  <p className="prose text-sm mt-1">
                                    Only user-created schemas and the public schema can be exposed through the Data API.
                                  </p>
                                </>
                              }
                            />
                          )}

                          {!field.value.includes('public') && field.value.length > 0 && (
                            <Admonition
                              type="default"
                              title="The public schema for this project is not exposed"
                              className="mt-2"
                              description={
                                <>
                                  <p className="prose text-sm">
                                    You will not be able to query tables and views in the{' '}
                                    <code className="text-xs">public</code> schema via supabase-js
                                    or HTTP clients.
                                  </p>
                                  {isGraphqlExtensionEnabled && (
                                    <>
                                      <p className="prose text-sm mt-2">
                                        Tables in the <code className="text-xs">public</code>{' '}
                                        schema are still exposed over our GraphQL endpoints.
                                      </p>
                                      <Button asChild type="default" className="mt-2">
                                        <Link href={`/project/${projectRef}/database/extensions`}>
                                          Disable the pg_graphql extension
                                        </Link>
                                      </Button>
                                    </>
                                  )}
                                </>
                              }
                            />
                          )}
                        </FormItem_Shadcn_>
                      )}
                    />

                    <FormField_Shadcn_
                      control={form.control}
                      name="dbExtraSearchPath"
                      render={({ field }) => (
                        <FormItem_Shadcn_ className="w-full">
                          <FormItemLayout
                            className="w-full px-8 py-8"
                            layout="horizontal"
                            label="Extra search path"
                            description="Extra schemas to add to the search path of every request. The search path determines the order in which PostgreSQL resolves unqualified table and function names. Schemas are searched in the order specified here, followed by the default search path."
                          >
                            {isLoadingSchemas ? (
                              <div className="col-span-12 flex flex-col gap-2 lg:col-span-7">
                                <Skeleton className="w-full h-[38px]" />
                              </div>
                            ) : (
                              <MultiSelector
                                onValuesChange={(values) => {
                                  field.onChange(values)
                                  // Validate search path in real-time
                                  validateSearchPath(values)
                                }}
                                values={field.value}
                                size="small"
                                disabled={!canUpdatePostgrestConfig || !isDataApiEnabledInForm}
                              >
                                <MultiSelectorTrigger
                                  mode="inline-combobox"
                                  label="Select schemas to add to search path..."
                                  badgeLimit="wrap"
                                  showIcon={false}
                                  deletableBadge
                                />
                                <MultiSelectorContent>
                                  <MultiSelectorList>
                                    {allAvailableSchemas.length <= 0 ? (
                                      <MultiSelectorItem key="empty" value="no">
                                        No schemas available
                                      </MultiSelectorItem>
                                    ) : (
                                      allAvailableSchemas.map((schema) => (
                                        <MultiSelectorItem key={schema.id + '-' + schema.name} value={schema.name}>
                                          {schema.name}
                                        </MultiSelectorItem>
                                      ))
                                    )}
                                  </MultiSelectorList>
                                </MultiSelectorContent>
                              </MultiSelector>
                            )}
                          </FormItemLayout>
                          <FormMessage_Shadcn_ />
                          
                          {/* Search path guidance */}
                          <Admonition
                            type="default"
                            title="Search path configuration"
                            className="mt-2 mx-8"
                            description={
                              <>
                                <p className="prose text-sm">
                                  The search path determines the order PostgreSQL uses to resolve unqualified object names (tables, functions, etc.).
                                </p>
                                <p className="prose text-sm mt-1">
                                  <strong>Order matters:</strong> Schemas are searched in the order you specify here, then the default search path.
                                </p>
                                <p className="prose text-sm mt-1">
                                  <strong>Valid names:</strong> Schema names must be valid PostgreSQL identifiers (letters, numbers, underscores, starting with letter or underscore).
                                </p>
                                <p className="prose text-sm mt-1">
                                  <strong>System schemas:</strong> You can include system schemas (auth, extensions, etc.) in the search path for advanced use cases.
                                </p>
                              </>
                            }
                          />
                        </FormItem_Shadcn_>
                      )}
                    />

                    <FormField_Shadcn_
                      control={form.control}
                      name="maxRows"
                      render={({ field }) => (
                        <FormItem_Shadcn_ className="w-full">
                          <FormItemLayout
                            className="w-full px-8 py-8"
                            layout="horizontal"
                            label="Max rows"
                            description="The maximum number of rows returned from a view, table, or stored procedure. Limits payload size for accidental or malicious requests. Must be between 1 and 1,000,000."
                          >
                            <FormControl_Shadcn_>
                              <Input_Shadcn_
                                size="small"
                                disabled={!canUpdatePostgrestConfig || !isDataApiEnabledInForm}
                                {...field}
                                type="number"
                                min="1"
                                max="1000000"
                                {...form.register('maxRows', {
                                  valueAsNumber: true,
                                })}
                              />
                            </FormControl_Shadcn_>
                          </FormItemLayout>
                          <FormMessage_Shadcn_ />
                        </FormItem_Shadcn_>
                      )}
                    />

                    <FormField_Shadcn_
                      control={form.control}
                      name="dbPool"
                      render={({ field }) => (
                        <FormItem_Shadcn_ className="w-full">
                          <FormItemLayout
                            className="w-full px-8 py-8"
                            layout="horizontal"
                            label="Pool size"
                            description="Number of maximum connections to keep open in the Data API server's database pool. Must be between 1 and 1000. Leave empty to let it be configured automatically based on compute size."
                          >
                            <FormControl_Shadcn_>
                              <Input_Shadcn_
                                size="small"
                                disabled={!canUpdatePostgrestConfig || !isDataApiEnabledInForm}
                                {...field}
                                type="number"
                                min="1"
                                max="1000"
                                placeholder="Configured automatically based on compute size"
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === '' ? null : Number(e.target.value)
                                  )
                                }
                                value={field.value === null ? '' : field.value}
                              />
                            </FormControl_Shadcn_>
                          </FormItemLayout>
                          <FormMessage_Shadcn_ />
                          
                          {field.value && field.value > 100 && (
                            <Admonition
                              type="warning"
                              title="High pool size detected"
                              className="mt-2 mx-8"
                              description="Pool sizes above 100 may impact performance. Consider using a smaller value unless you have specific requirements for high concurrency."
                            />
                          )}
                          
                          <Admonition
                            type="default"
                            title="Pool size guidance"
                            className="mt-2 mx-8"
                            description={
                              <>
                                <p className="prose text-sm">
                                  <strong>Recommended ranges by use case:</strong>
                                </p>
                                <ul className="prose text-sm mt-1 ml-4 list-disc">
                                  <li><strong>Small applications:</strong> 5-15 connections</li>
                                  <li><strong>Medium applications:</strong> 15-40 connections</li>
                                  <li><strong>High-traffic applications:</strong> 40-80 connections</li>
                                  <li><strong>Enterprise applications:</strong> 80-150 connections</li>
                                </ul>
                                <p className="prose text-sm mt-2">
                                  <strong>Auto-configuration:</strong> Leave empty to let the system determine optimal pool size based on your compute size. This is recommended for most use cases.
                                </p>
                                <p className="prose text-sm mt-1">
                                  <strong>Performance tip:</strong> Monitor your database connections and adjust based on actual usage patterns. Too many connections can waste resources, while too few can limit performance.
                                </p>
                              </>
                            }
                          />
                        </FormItem_Shadcn_>
                      )}
                    />
                  </CollapsibleContent_Shadcn_>
                </Collapsible_Shadcn_>
              </>
            )}
          </form>
        </Form_Shadcn_>
      </CardContent>
      <CardFooter>
        {/* Status indicator for ongoing operations */}
        {(isUpdating || isRetrying) && (
          <div className="w-full mb-4">
            <Admonition
              type="default"
              title={isRetrying ? "Retrying configuration update..." : "Updating configuration..."}
              description={
                isRetrying 
                  ? `Retry attempt ${retryCount}. Please wait while we apply your changes.`
                  : "Please wait while we apply your configuration changes. This may take a few moments."
              }
            />
          </div>
        )}
        
        {/* Error status display */}
        {lastError && !isUpdating && !isRetrying && (
          <div className="w-full mb-4">
            <Admonition
              type="destructive"
              title="Configuration update failed"
              description={
                <>
                  <p>{lastError}</p>
                  {networkErrorRetryAttempts > 0 && (
                    <p className="mt-2 text-sm">
                      Network retry attempts: {networkErrorRetryAttempts}/3
                    </p>
                  )}
                </>
              }
            />
          </div>
        )}

        <FormActions
          form={formId}
          isSubmitting={isUpdating || isRetrying}
          hasChanges={form.formState.isDirty}
          handleReset={() => {
            resetForm()
            setLastError(null)
            setNetworkErrorRetryAttempts(0)
            setRetryCount(0)
          }}
          disabled={!canUpdatePostgrestConfig}
          helper={
            isPermissionsLoaded && !canUpdatePostgrestConfig
              ? "You need additional permissions to update your project's API settings"
              : undefined
          }
        />
      </CardFooter>

      <HardenAPIModal visible={showModal} onClose={() => setShowModal(false)} />
      
      {/* Performance monitoring display (development only) */}
      <PerformanceMonitoringDisplay projectRef={projectRef} />
    </Card>
  )
}
