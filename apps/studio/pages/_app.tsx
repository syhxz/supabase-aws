import 'react-data-grid/lib/styles.css'
import 'styles/code.scss'
import 'styles/contextMenu.scss'
import 'styles/editor.scss'
import 'styles/focus.scss'
import 'styles/graphiql-base.scss'
import 'styles/grid.scss'
import 'styles/main.scss'
import 'styles/markdown-preview.scss'
import 'styles/monaco.scss'
import 'styles/react-data-grid-logs.scss'
import 'styles/reactflow.scss'
import 'styles/storage.scss'
import 'styles/stripe.scss'
import 'styles/toast.scss'
import 'styles/typography.scss'
import 'styles/ui.scss'
import 'ui/build/css/themes/dark.css'
import 'ui/build/css/themes/light.css'

import { loader } from '@monaco-editor/react'
import * as Sentry from '@sentry/nextjs'
import { Hydrate, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import Head from 'next/head'
import { NuqsAdapter } from 'nuqs/adapters/next/pages'
import { ErrorInfo, useCallback, useEffect, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import {
  FeatureFlagProvider,
  getFlags,
  TelemetryTagManager,
  ThemeProvider,
  useThemeSandbox,
} from 'common'
import { useConfigurationManager } from 'lib/configuration-manager'
import { ConfigurationErrorRecovery, ConfigurationWarningBanner } from 'components/interfaces/App/ConfigurationErrorRecovery'
import MetaFaviconsPagesRouter from 'common/MetaFavicons/pages-router'
import { AppBannerContextProvider } from 'components/interfaces/App/AppBannerWrapperContext'
import { AuthGuard } from 'components/interfaces/App/AuthGuard'
import { StudioCommandMenu } from 'components/interfaces/App/CommandMenu'
import { StudioCommandProvider as CommandProvider } from 'components/interfaces/App/CommandMenu/StudioCommandProvider'
import { FeaturePreviewContextProvider } from 'components/interfaces/App/FeaturePreview/FeaturePreviewContext'
import FeaturePreviewModal from 'components/interfaces/App/FeaturePreview/FeaturePreviewModal'
import { MonacoThemeProvider } from 'components/interfaces/App/MonacoThemeProvider'
import { RouteValidationWrapper } from 'components/interfaces/App/RouteValidationWrapper'
import { GlobalErrorBoundaryState } from 'components/ui/ErrorBoundary/GlobalErrorBoundaryState'
import { useRootQueryClient } from 'data/query-client'
import { customFont, sourceCodePro } from 'fonts'
import { useCustomContent } from 'hooks/custom-content/useCustomContent'
import { LegacyInlineEditorHotkeyMigration } from 'hooks/misc/useLegacyInlineEditorHotkeyMigration'
import { AuthProvider } from 'lib/auth'
import { API_URL, BASE_PATH, IS_PLATFORM, useDefaultProvider } from 'lib/constants'
import { ProfileProvider } from 'lib/profile'
import { Telemetry } from 'lib/telemetry'
import type { AppPropsWithLayout } from 'types'
import { SonnerToaster, TooltipProvider, LogoLoader, Button } from 'ui'
import { AlertTriangle } from 'lucide-react'

dayjs.extend(customParseFormat)
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)
dayjs.extend(duration)

loader.config({
  // [Joshen] Attempt for offline support/bypass ISP issues is to store the assets required for monaco
  // locally. We're however, only storing the assets which we need (based on what the network tab loads
  // while using monaco). If we end up facing more effort trying to maintain this, probably to either
  // use cloudflare or find some way to pull all the files from a CDN via a CLI, rather than tracking individual files
  // The alternative was to import * as monaco from 'monaco-editor' but i couldn't get it working
  paths: {
    vs: IS_PLATFORM
      ? 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs'
      : `${BASE_PATH}/monaco-editor`,
  },
})

// [Joshen TODO] Once we settle on the new nav layout - we'll need a lot of clean up in terms of our layout components
// a lot of them are unnecessary and introduce way too many cluttered CSS especially with the height styles that make
// debugging way too difficult. Ideal scenario is we just have one AppLayout to control the height and scroll areas of
// the dashboard, all other layout components should not be doing that

function CustomApp({ Component, pageProps }: AppPropsWithLayout) {
  const queryClient = useRootQueryClient()
  const { appTitle } = useCustomContent(['app:title'])

  // Use the comprehensive configuration manager
  const configManager = useConfigurationManager({
    maxRetries: 3,
    retryDelay: 2000,
    enableHealthChecks: true,
    enableCaching: true,
    autoRetry: true,
  })

  const getLayout = Component.getLayout ?? ((page) => page)

  const errorBoundaryHandler = (error: Error, info: ErrorInfo) => {
    Sentry.withScope(function (scope) {
      scope.setTag('globalErrorBoundary', true)
      const eventId = Sentry.captureException(error)
      // Attach the Sentry event ID to the error object so it can be accessed by the error boundary
      if (eventId && error && typeof error === 'object') {
        ;(error as any).sentryId = eventId
      }
    })

    console.error(error.stack)
  }

  useThemeSandbox()

  const isTestEnv = process.env.NEXT_PUBLIC_NODE_ENV === 'test'

  const cloudProvider = useDefaultProvider()

  const getConfigCatFlags = useCallback(
    (userEmail?: string) => {
      const customAttributes = cloudProvider ? { cloud_provider: cloudProvider } : undefined
      return getFlags(userEmail, customAttributes)
    },
    [cloudProvider]
  )

  // Handle configuration actions
  const handleRetry = useCallback(() => {
    configManager.retry()
  }, [configManager])

  const handleUseFallback = useCallback(() => {
    configManager.acceptFallback()
  }, [configManager])

  const handleRefresh = useCallback(() => {
    configManager.refresh()
  }, [configManager])

  // Show loading screen while config is being fetched (only for initial load)
  if (configManager.isLoading && !configManager.config && !isTestEnv) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-alternative">
        <LogoLoader />
        <p className="mt-4 text-sm text-foreground-light">{configManager.statusMessage}</p>
        {configManager.isRetrying && (
          <p className="mt-2 text-xs text-foreground-lighter">
            Attempt {configManager.retryAttempts} of {3}
          </p>
        )}
      </div>
    )
  }

  // Determine what to show for configuration status
  const showConfigError = configManager.error && !configManager.usingFallback && !isTestEnv
  const showFallbackWarning = configManager.usingFallback && !isTestEnv
  const showHealthWarnings = configManager.healthResult && !configManager.healthResult.healthy && configManager.healthResult.warnings.length > 0 && !isTestEnv

  return (
    <ErrorBoundary FallbackComponent={GlobalErrorBoundaryState} onError={errorBoundaryHandler}>
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          <Hydrate state={pageProps.dehydratedState}>
            {/* Configuration Error Recovery */}
            {showConfigError && configManager.error && (
              <ConfigurationErrorRecovery
                error={configManager.error}
                healthResult={configManager.healthResult || undefined}
                isRetrying={configManager.isRetrying}
                onRetry={handleRetry}
                onUseFallback={handleUseFallback}
                canUseFallback={configManager.error.canFallback}
                context="Application Startup"
              />
            )}
            
            {/* Fallback Configuration Warning */}
            {showFallbackWarning && configManager.fallbackResult && (
              <ConfigurationWarningBanner
                message={configManager.fallbackResult.userMessage}
                details={configManager.fallbackResult.recommendations}
                dismissible={false}
              />
            )}
            
            {/* Health Check Warnings */}
            {showHealthWarnings && configManager.healthResult && (
              <ConfigurationWarningBanner
                message="Some services may not be fully operational"
                details={[...configManager.healthResult.errors, ...configManager.healthResult.warnings]}
                dismissible={true}
              />
            )}
            <AuthProvider>
              <FeatureFlagProvider
                API_URL={API_URL}
                enabled={IS_PLATFORM}
                getConfigCatFlags={getConfigCatFlags}
              >
                <ProfileProvider>
                  <Head>
                    <title>{appTitle ?? 'Supabase'}</title>
                    <meta name="viewport" content="initial-scale=1.0, width=device-width" />
                    <meta property="og:image" content={`${BASE_PATH}/img/supabase-logo.png`} />
                    <meta name="googlebot" content="notranslate" />
                    {/* [Alaister]: This has to be an inline style tag here and not a separate component due to next/font */}
                    <style
                      dangerouslySetInnerHTML={{
                        __html: `:root{--font-custom:${customFont.style.fontFamily};--font-source-code-pro:${sourceCodePro.style.fontFamily};}`,
                      }}
                    />
                  </Head>
                  <MetaFaviconsPagesRouter applicationName="Supabase Studio" includeManifest />
                  <TooltipProvider delayDuration={0}>
                    <AuthGuard>
                      <RouteValidationWrapper>
                        <ThemeProvider
                          defaultTheme="system"
                          themes={['dark', 'light', 'classic-dark']}
                          enableSystem
                          disableTransitionOnChange
                        >
                          <AppBannerContextProvider>
                            <CommandProvider>
                              <FeaturePreviewContextProvider>
                                {getLayout(<Component {...pageProps} />)}
                                <StudioCommandMenu />
                                <FeaturePreviewModal />
                              </FeaturePreviewContextProvider>
                              <SonnerToaster position="top-right" />
                              <MonacoThemeProvider />
                            </CommandProvider>
                          </AppBannerContextProvider>
                        </ThemeProvider>
                      </RouteValidationWrapper>
                    </AuthGuard>
                  </TooltipProvider>
                  {/* Temporary migration, to be removed by 2025-11-28 */}
                  <LegacyInlineEditorHotkeyMigration />
                  <Telemetry />
                  {!isTestEnv && (
                    <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
                  )}
                </ProfileProvider>
              </FeatureFlagProvider>
            </AuthProvider>
          </Hydrate>
        </NuqsAdapter>
      </QueryClientProvider>
      <TelemetryTagManager />
    </ErrorBoundary>
  )
}

export default CustomApp
