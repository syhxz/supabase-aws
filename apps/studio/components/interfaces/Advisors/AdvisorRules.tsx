import { ScaffoldContainer, ScaffoldSection } from 'components/layouts/Scaffold'
import { lintInfoMap } from '../Linter/Linter.utils'
import { AdvisorRuleItem } from './AdvisorRuleItem'
import { useAdvisorData } from '../../../hooks/analytics/useAdvisorData'
import { Card, Alert_Shadcn_, AlertDescription_Shadcn_, AlertTitle_Shadcn_ } from 'ui'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface AdvisorRulesProps {
  category: 'security' | 'performance'
}

export const AdvisorRules = ({ category }: AdvisorRulesProps) => {
  const lints = lintInfoMap.filter((x) => x.category === category)
  
  // Fetch project-specific advisor data
  const { 
    data: advisorResponse, 
    isLoading, 
    error, 
    refetch 
  } = useAdvisorData({
    limit: 50,
    advisor_type: category
  })

  const advisorData = advisorResponse?.data || []

  return (
    <ScaffoldContainer>
      <ScaffoldSection isFullWidth className="!pt-6">
        {/* Project-specific advisor recommendations */}
        {advisorData.length > 0 && (
          <Card className="p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Active {category} recommendations for this project</h4>
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <div className="space-y-3">
              {advisorData.map((recommendation) => (
                <div 
                  key={recommendation.id} 
                  className={`p-3 rounded border-l-4 ${
                    recommendation.severity === 'critical' 
                      ? 'border-red-500 bg-red-50' 
                      : recommendation.severity === 'warning'
                      ? 'border-yellow-500 bg-yellow-50'
                      : 'border-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium capitalize">
                          {recommendation.advisor_type}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          recommendation.severity === 'critical' 
                            ? 'bg-red-100 text-red-800' 
                            : recommendation.severity === 'warning'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {recommendation.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        {recommendation.recommendation}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 ml-4">
                      {new Date(recommendation.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Error state */}
        {error && (
          <Alert_Shadcn_ variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle_Shadcn_>Error Loading Advisor Data</AlertTitle_Shadcn_>
            <AlertDescription_Shadcn_>
              {error.message || 'Failed to load advisor recommendations for this project'}
            </AlertDescription_Shadcn_>
          </Alert_Shadcn_>
        )}

        {/* Static advisor rules */}
        <div className="[&>div:first-child>div]:rounded-t [&>div:last-child>div]:border-b [&>div:last-child>div]:rounded-b">
          {lints.map((lint) => (
            <AdvisorRuleItem key={lint.name} lint={lint} />
          ))}
        </div>
      </ScaffoldSection>
    </ScaffoldContainer>
  )
}
