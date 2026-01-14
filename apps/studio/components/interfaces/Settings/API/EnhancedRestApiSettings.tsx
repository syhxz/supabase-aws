import { memo, useCallback, useMemo, useState } from 'react'
import { useParams } from 'common'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  Switch, 
  Button,
  Separator,
  Badge,
  Alert_Shadcn_,
  AlertTitle_Shadcn_,
  AlertDescription_Shadcn_,
  Form_Shadcn_,
  FormField_Shadcn_,
  FormItem_Shadcn_,
  FormControl_Shadcn_,
  FormMessage_Shadcn_,
  Input_Shadcn_,
  CollapsibleContent_Shadcn_,
  Collapsible_Shadcn_
} from 'ui'
import { FormItemLayout } from 'ui-patterns/form/FormItemLayout/FormItemLayout'
import { Admonition } from 'ui-patterns/admonition'
import { useSelectedProjectQuery } from 'hooks/misc/useSelectedProject'
import { useEnhancedRestApiConfigQuery } from '../../../../data/config/enhanced-rest-api-config-query'
import { useEnhancedRestApiConfigUpdateMutation } from '../../../../data/config/enhanced-rest-api-config-update-mutation'
import { Settings, Database, Search, Layers, Zap, Activity, LucideIcon } from 'lucide-react'

const enhancedConfigSchema = z.object({
  // Core features
  enableRPCFunctions: z.boolean(),
  enableDatabaseViews: z.boolean(),
  enableAdvancedJSON: z.boolean(),
  enableFullTextSearch: z.boolean(),
  enableAggregateQueries: z.boolean(),
  enableBulkOperations: z.boolean(),
  enableNestedResources: z.boolean(),
  enableTransactions: z.boolean(),
  enableArrayOperations: z.boolean(),
  enableContentNegotiation: z.boolean(),
  
  // Performance settings
  queryTimeout: z.number().min(1000).max(300000), // 1s to 5min
  connectionPoolSize: z.number().min(1).max(1000).optional().nullable(),
  enableQueryLogging: z.boolean(),
  enablePerformanceMonitoring: z.boolean(),
  enableCaching: z.boolean(),
  
  // Advanced settings
  logLevel: z.enum(['error', 'warn', 'info', 'debug']),
  enableRequestLogging: z.boolean(),
  enableErrorLogging: z.boolean()
})

type EnhancedConfigFormData = z.infer<typeof enhancedConfigSchema>

interface FeatureGroup {
  id: string
  title: string
  description: string
  icon: LucideIcon
  features: {
    key: keyof EnhancedConfigFormData
    label: string
    description: string
    badge?: string
    requiresSchemas?: boolean
  }[]
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'core-features',
    title: 'Core Features',
    description: 'Essential REST API enhancements for advanced database operations',
    icon: Database,
    features: [
      {
        key: 'enableRPCFunctions',
        label: 'RPC Functions',
        description: 'Enable calling PostgreSQL functions via POST /rpc/function_name endpoints',
        badge: 'Popular'
      },
      {
        key: 'enableDatabaseViews',
        label: 'Database Views',
        description: 'Expose database views through the REST API with full query capabilities',
        requiresSchemas: true
      },
      {
        key: 'enableAdvancedJSON',
        label: 'Advanced JSON Operations',
        description: 'Support PostgreSQL JSON operators (→, →→, @>, <@) for complex JSON queries'
      },
      {
        key: 'enableFullTextSearch',
        label: 'Full-Text Search',
        description: 'Enable PostgreSQL text search operators (fts, plfts, phfts, wfts)'
      }
    ]
  },
  {
    id: 'query-features',
    title: 'Query Features',
    description: 'Advanced querying capabilities for complex data operations',
    icon: Search,
    features: [
      {
        key: 'enableAggregateQueries',
        label: 'Aggregate Queries',
        description: 'Support COUNT, SUM, AVG, MIN, MAX functions with GROUP BY and HAVING'
      },
      {
        key: 'enableArrayOperations',
        label: 'Array Operations',
        description: 'PostgreSQL array operators (cs, cd, ov) and array indexing support'
      },
      {
        key: 'enableNestedResources',
        label: 'Nested Resources',
        description: 'Fetch related data in single requests using foreign key relationships',
        badge: 'Performance'
      }
    ]
  },
  {
    id: 'operation-features',
    title: 'Operation Features',
    description: 'Enhanced data manipulation and transaction capabilities',
    icon: Layers,
    features: [
      {
        key: 'enableBulkOperations',
        label: 'Bulk Operations',
        description: 'Optimized batch processing for large insert and update operations',
        badge: 'Performance'
      },
      {
        key: 'enableTransactions',
        label: 'Transactions',
        description: 'Atomic operations across multiple requests with rollback support'
      },
      {
        key: 'enableContentNegotiation',
        label: 'Content Negotiation',
        description: 'Multiple response formats (JSON, CSV, single objects) based on Accept headers'
      }
    ]
  }
]

const PERFORMANCE_SETTINGS = [
  {
    key: 'enableQueryLogging' as const,
    label: 'Query Logging',
    description: 'Log all SQL queries for debugging and performance analysis'
  },
  {
    key: 'enablePerformanceMonitoring' as const,
    label: 'Performance Monitoring',
    description: 'Track query performance metrics and response times'
  },
  {
    key: 'enableCaching' as const,
    label: 'Response Caching',
    description: 'Cache frequently accessed data to improve response times'
  }
]

export const EnhancedRestApiSettings = memo(() => {
  const { ref: projectRef } = useParams()
  const { data: project } = useSelectedProjectQuery()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['core-features']))

  const {
    data: config,
    isLoading,
    isError,
    error
  } = useEnhancedRestApiConfigQuery({ projectRef })

  const { mutate: updateConfig, isPending: isUpdating } = useEnhancedRestApiConfigUpdateMutation({
    onSuccess: () => {
      toast.success('Enhanced REST API settings updated successfully')
    },
    onError: (error: Error) => {
      toast.error('Failed to update settings', {
        description: error.message
      })
    }
  })

  const defaultValues = useMemo(() => ({
    // Core features
    enableRPCFunctions: config?.enableRPCFunctions ?? false,
    enableDatabaseViews: config?.enableDatabaseViews ?? false,
    enableAdvancedJSON: config?.enableAdvancedJSON ?? false,
    enableFullTextSearch: config?.enableFullTextSearch ?? false,
    enableAggregateQueries: config?.enableAggregateQueries ?? false,
    enableBulkOperations: config?.enableBulkOperations ?? false,
    enableNestedResources: config?.enableNestedResources ?? false,
    enableTransactions: config?.enableTransactions ?? false,
    enableArrayOperations: config?.enableArrayOperations ?? false,
    enableContentNegotiation: config?.enableContentNegotiation ?? false,
    
    // Performance settings
    queryTimeout: config?.queryTimeout ?? 30000,
    connectionPoolSize: config?.connectionPoolSize ?? null,
    enableQueryLogging: config?.enableQueryLogging ?? false,
    enablePerformanceMonitoring: config?.enablePerformanceMonitoring ?? true,
    enableCaching: config?.enableCaching ?? false,
    
    // Advanced settings
    logLevel: config?.logLevel ?? 'info' as const,
    enableRequestLogging: config?.enableRequestLogging ?? false,
    enableErrorLogging: config?.enableErrorLogging ?? true
  }), [config])

  const form = useForm<EnhancedConfigFormData>({
    resolver: zodResolver(enhancedConfigSchema),
    defaultValues,
    mode: 'onChange'
  })

  // Reset form when config loads
  useMemo(() => {
    if (config) {
      form.reset(defaultValues)
    }
  }, [config, defaultValues, form])

  const onSubmit = useCallback((values: EnhancedConfigFormData) => {
    if (!projectRef) return
    
    updateConfig({
      projectRef,
      ...values
    })
  }, [projectRef, updateConfig])

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }, [])

  const getEnabledFeaturesCount = useCallback(() => {
    const values = form.getValues()
    return FEATURE_GROUPS.reduce((count, group) => {
      return count + group.features.filter(feature => values[feature.key] === true).length
    }, 0)
  }, [form])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>Enhanced REST API Settings</CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>Enhanced REST API Settings</CardHeader>
        <CardContent>
          <Alert_Shadcn_ variant="destructive">
            <AlertTitle_Shadcn_>Failed to load enhanced settings</AlertTitle_Shadcn_>
            <AlertDescription_Shadcn_>
              {error?.message || 'Unable to load enhanced REST API configuration'}
            </AlertDescription_Shadcn_>
          </Alert_Shadcn_>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings size={20} />
          <div>
            <h3 className="text-lg font-medium">Enhanced REST API Settings</h3>
            <p className="text-sm text-muted-foreground">
              Configure advanced PostgREST features for your project
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {getEnabledFeaturesCount()} features enabled
          </Badge>
          {config?.lastUpdated && (
            <Badge variant="outline">
              Updated {new Date(config.lastUpdated).toLocaleDateString()}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Form_Shadcn_ {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Feature Groups */}
            {FEATURE_GROUPS.map((group) => (
              <div key={group.id} className="border rounded-lg">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <group.icon size={20} />
                    <div className="text-left">
                      <h4 className="font-medium">{group.title}</h4>
                      <p className="text-sm text-muted-foreground">{group.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {group.features.filter(f => form.watch(f.key)).length}/{group.features.length}
                    </Badge>
                    <div className={`transform transition-transform ${expandedGroups.has(group.id) ? 'rotate-180' : ''}`}>
                      ▼
                    </div>
                  </div>
                </button>
                
                <Collapsible_Shadcn_ open={expandedGroups.has(group.id)}>
                  <CollapsibleContent_Shadcn_ className="border-t">
                    <div className="p-4 space-y-4">
                      {group.features.map((feature) => (
                        <FormField_Shadcn_
                          key={feature.key}
                          control={form.control}
                          name={feature.key}
                          render={({ field }) => (
                            <FormItem_Shadcn_>
                              <FormItemLayout
                                layout="flex"
                                label={
                                  <div className="flex items-center gap-2">
                                    {feature.label}
                                    {feature.badge && (
                                      <Badge variant="outline" className="text-xs">
                                        {feature.badge}
                                      </Badge>
                                    )}
                                  </div>
                                }
                                description={feature.description}
                              >
                                <FormControl_Shadcn_>
                                  <Switch
                                    checked={field.value as boolean}
                                    onCheckedChange={field.onChange}
                                    size="large"
                                  />
                                </FormControl_Shadcn_>
                              </FormItemLayout>
                              <FormMessage_Shadcn_ />
                            </FormItem_Shadcn_>
                          )}
                        />
                      ))}
                    </div>
                  </CollapsibleContent_Shadcn_>
                </Collapsible_Shadcn_>
              </div>
            ))}

            <Separator />

            {/* Performance Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Zap size={20} className="text-muted-foreground" />
                <div>
                  <h4 className="font-medium">Performance Settings</h4>
                  <p className="text-sm text-muted-foreground">
                    Configure performance and monitoring options
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField_Shadcn_
                  control={form.control}
                  name="queryTimeout"
                  render={({ field }) => (
                    <FormItem_Shadcn_>
                      <FormItemLayout
                        label="Query Timeout (ms)"
                        description="Maximum time to wait for query execution"
                      >
                        <FormControl_Shadcn_>
                          <Input_Shadcn_
                            type="number"
                            min={1000}
                            max={300000}
                            step={1000}
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl_Shadcn_>
                      </FormItemLayout>
                      <FormMessage_Shadcn_ />
                    </FormItem_Shadcn_>
                  )}
                />

                <FormField_Shadcn_
                  control={form.control}
                  name="connectionPoolSize"
                  render={({ field }) => (
                    <FormItem_Shadcn_>
                      <FormItemLayout
                        label="Connection Pool Size"
                        description="Override automatic pool sizing (optional)"
                      >
                        <FormControl_Shadcn_>
                          <Input_Shadcn_
                            type="number"
                            min={1}
                            max={1000}
                            placeholder="Auto"
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          />
                        </FormControl_Shadcn_>
                      </FormItemLayout>
                      <FormMessage_Shadcn_ />
                    </FormItem_Shadcn_>
                  )}
                />
              </div>

              <div className="space-y-4">
                {PERFORMANCE_SETTINGS.map((setting) => (
                  <FormField_Shadcn_
                    key={setting.key}
                    control={form.control}
                    name={setting.key}
                    render={({ field }) => (
                      <FormItem_Shadcn_>
                        <FormItemLayout
                          layout="flex"
                          label={setting.label}
                          description={setting.description}
                        >
                          <FormControl_Shadcn_>
                            <Switch
                              checked={field.value as boolean}
                              onCheckedChange={field.onChange}
                              size="large"
                            />
                          </FormControl_Shadcn_>
                        </FormItemLayout>
                        <FormMessage_Shadcn_ />
                      </FormItem_Shadcn_>
                    )}
                  />
                ))}
              </div>
            </div>

            <Separator />

            {/* Advanced Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Activity size={20} className="text-muted-foreground" />
                <div>
                  <h4 className="font-medium">Advanced Settings</h4>
                  <p className="text-sm text-muted-foreground">
                    Logging and debugging configuration
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField_Shadcn_
                  control={form.control}
                  name="logLevel"
                  render={({ field }) => (
                    <FormItem_Shadcn_>
                      <FormItemLayout
                        label="Log Level"
                        description="Minimum log level to record"
                      >
                        <FormControl_Shadcn_>
                          <select
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="error">Error</option>
                            <option value="warn">Warning</option>
                            <option value="info">Info</option>
                            <option value="debug">Debug</option>
                          </select>
                        </FormControl_Shadcn_>
                      </FormItemLayout>
                      <FormMessage_Shadcn_ />
                    </FormItem_Shadcn_>
                  )}
                />

                <FormField_Shadcn_
                  control={form.control}
                  name="enableRequestLogging"
                  render={({ field }) => (
                    <FormItem_Shadcn_>
                      <FormItemLayout
                        layout="flex"
                        label="Request Logging"
                        description="Log all HTTP requests"
                      >
                        <FormControl_Shadcn_>
                          <Switch
                            checked={field.value as boolean}
                            onCheckedChange={field.onChange}
                            size="large"
                          />
                        </FormControl_Shadcn_>
                      </FormItemLayout>
                      <FormMessage_Shadcn_ />
                    </FormItem_Shadcn_>
                  )}
                />

                <FormField_Shadcn_
                  control={form.control}
                  name="enableErrorLogging"
                  render={({ field }) => (
                    <FormItem_Shadcn_>
                      <FormItemLayout
                        layout="flex"
                        label="Error Logging"
                        description="Log all errors and exceptions"
                      >
                        <FormControl_Shadcn_>
                          <Switch
                            checked={field.value as boolean}
                            onCheckedChange={field.onChange}
                            size="large"
                          />
                        </FormControl_Shadcn_>
                      </FormItemLayout>
                      <FormMessage_Shadcn_ />
                    </FormItem_Shadcn_>
                  )}
                />
              </div>
            </div>

            {/* Submit Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Changes will be applied to the REST API container immediately
              </div>
              <div className="flex gap-2">
                <Button
                  htmlType="button"
                  type="outline"
                  onClick={() => form.reset(defaultValues)}
                  disabled={!form.formState.isDirty || isUpdating}
                >
                  Reset
                </Button>
                <Button
                  htmlType="submit"
                  disabled={!form.formState.isDirty || isUpdating}
                  loading={isUpdating}
                >
                  {isUpdating ? 'Updating...' : 'Update Settings'}
                </Button>
              </div>
            </div>
          </form>
        </Form_Shadcn_>

        {/* Information Panel */}
        <Admonition
          type="default"
          title="Enhanced REST API Features"
          description={
            <div className="space-y-2 text-sm">
              <p>
                These settings enable advanced PostgREST features that extend beyond the standard REST API capabilities.
              </p>
              <p>
                <strong>Performance Impact:</strong> Enabling multiple features may increase memory usage and query complexity.
                Monitor your application performance after making changes.
              </p>
              <p>
                <strong>Container Updates:</strong> Configuration changes are applied to the supabase-rest container in real-time.
                No restart required.
              </p>
            </div>
          }
        />
      </CardContent>
    </Card>
  )
})

EnhancedRestApiSettings.displayName = 'EnhancedRestApiSettings'