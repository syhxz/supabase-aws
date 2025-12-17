import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { ConnectionPooling } from '../ConnectionPooling'

// Mock the hooks and dependencies
vi.mock('common', () => ({
  useParams: () => ({ ref: 'test-project' }),
  isFeatureEnabled: () => true
}))

vi.mock('hooks/misc/useSelectedProject', () => ({
  useSelectedProjectQuery: () => ({
    data: { id: 'test-project', ref: 'test-project', connectionString: 'test-connection' }
  })
}))

vi.mock('hooks/misc/useSelectedOrganization', () => ({
  useSelectedOrganizationQuery: () => ({
    data: { plan: { id: 'pro' } }
  })
}))

vi.mock('hooks/misc/useCheckPermissions', () => ({
  useAsyncCheckPermissions: () => ({ can: true })
}))

vi.mock('data/database/pooling-configuration-query', () => ({
  usePoolingConfigurationQuery: () => ({
    data: {
      poolingService: 'supavisor',
      poolSize: 25,
      maxClientConnections: 200,
      poolMode: 'transaction',
      isEnabled: true,
      status: 'running',
      environment: 'self-hosted',
      capabilities: {
        configurationUpdate: true,
        statisticsMonitoring: true,
        healthChecks: true,
        containerManagement: true
      }
    },
    isLoading: false,
    isError: false,
    isSuccess: true
  })
}))

vi.mock('data/database/pooling-statistics-query', () => ({
  usePoolingStatisticsQuery: () => ({
    data: {
      poolingService: 'supavisor',
      activeConnections: 5,
      idleConnections: 10,
      totalConnections: 15,
      poolUtilization: 0.6,
      clientConnections: 8,
      maxClientConnections: 200,
      environment: 'self-hosted'
    },
    isLoading: false
  })
}))

vi.mock('data/database/pooling-health-query', () => ({
  usePoolingHealthQuery: () => ({
    data: {
      poolingService: 'supavisor',
      healthy: true,
      status: 'healthy',
      environment: 'self-hosted',
      message: 'Service is running normally',
      lastChecked: new Date().toISOString()
    },
    isLoading: false
  })
}))

vi.mock('data/database/pooling-configuration-update-mutation', () => ({
  usePoolingConfigurationUpdateMutation: () => ({
    mutate: vi.fn(),
    isPending: false
  })
}))

vi.mock('data/database/max-connections-query', () => ({
  useMaxConnectionsQuery: () => ({
    data: { maxConnections: 100 }
  })
}))

vi.mock('data/subscriptions/project-addons-query', () => ({
  useProjectAddonsQuery: () => ({
    data: { selected_addons: [] },
    isSuccess: true
  })
}))

vi.mock('data/database/supavisor-recommendations-query', () => ({
  useSupavisorRecommendationsQuery: () => ({
    data: {
      computeSize: 'Nano',
      recommendedPoolSize: 15,
      recommendedMaxClientConnections: 100,
      reasoning: 'For Nano compute instances, we recommend a pool size of 15 to balance performance and resource usage.'
    },
    isLoading: false
  })
}))

vi.mock('data/database/pooling-service-detection-query', () => ({
  usePoolingServiceDetectionQuery: () => ({
    data: {
      primary: {
        service: 'supavisor',
        isAvailable: true,
        isHealthy: true,
        features: {
          configurationUpdate: true,
          statisticsMonitoring: true,
          healthChecks: true,
          containerManagement: true
        }
      }
    },
    isLoading: false,
    isError: false
  })
}))

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
})

describe('ConnectionPooling Component', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
  })

  afterEach(() => {
    queryClient.clear()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    )
  }

  it('displays Supavisor service badge for self-hosted environment', () => {
    renderWithProviders(<ConnectionPooling />)
    
    expect(screen.getByText('Supavisor')).toBeInTheDocument()
    expect(screen.getByText('healthy')).toBeInTheDocument()
  })

  it('displays pool statistics for self-hosted environment', () => {
    renderWithProviders(<ConnectionPooling />)
    
    expect(screen.getByText('Pool Statistics')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument() // activeConnections value
    expect(screen.getByText('Idle')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument() // idleConnections value
  })

  it('displays pool size configuration field', () => {
    renderWithProviders(<ConnectionPooling />)
    
    expect(screen.getByText('Pool Size')).toBeInTheDocument()
    expect(screen.getByText(/maximum number of connections made to the underlying Postgres cluster/)).toBeInTheDocument()
  })

  it('displays max client connections field', () => {
    renderWithProviders(<ConnectionPooling />)
    
    expect(screen.getByText('Max Client Connections')).toBeInTheDocument()
    expect(screen.getByText(/maximum number of concurrent client connections allowed/)).toBeInTheDocument()
  })
})