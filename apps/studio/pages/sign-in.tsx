import { Lock } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

import { LastSignInWrapper } from 'components/interfaces/SignIn/LastSignInWrapper'
import { SignInForm } from 'components/interfaces/SignIn/SignInForm'
import { SignInWithCustom } from 'components/interfaces/SignIn/SignInWithCustom'
import { SignInWithGitHub } from 'components/interfaces/SignIn/SignInWithGitHub'
import { AuthenticationLayout } from 'components/layouts/AuthenticationLayout'
import SignInLayout from 'components/layouts/SignInLayout/SignInLayout'
import { useCustomContent } from 'hooks/custom-content/useCustomContent'
import { useIsFeatureEnabled } from 'hooks/misc/useIsFeatureEnabled'
import { IS_PLATFORM } from 'lib/constants'
import type { NextPageWithLayout } from 'types'
import { Button } from 'ui'

const SignInPage: NextPageWithLayout = () => {
  const router = useRouter()

  const {
    dashboardAuthSignInWithGithub: signInWithGithubEnabled,
    dashboardAuthSignInWithSso: signInWithSsoEnabled,
    dashboardAuthSignInWithEmail: signInWithEmailEnabled,
    dashboardAuthSignUp: signUpEnabled,
  } = useIsFeatureEnabled([
    'dashboard_auth:sign_in_with_github',
    'dashboard_auth:sign_in_with_sso',
    'dashboard_auth:sign_in_with_email',
    'dashboard_auth:sign_up',
  ])

  const { dashboardAuthCustomProvider: customProvider } = useCustomContent([
    'dashboard_auth:custom_provider',
  ])

  const showOrDivider =
    (signInWithGithubEnabled || signInWithSsoEnabled || customProvider) && signInWithEmailEnabled

  useEffect(() => {
    // Check runtime configuration first, then fall back to build-time config
    const checkAuthenticationMode = async () => {
      try {
        const response = await fetch('/api/runtime-config')
        const runtimeConfig = await response.json()
        
        const requireLogin = runtimeConfig?.requireLogin ?? (process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true')
        const isPlatform = runtimeConfig?.isPlatform ?? IS_PLATFORM
        
        // Authentication mode check: {
        //   isPlatform,
        //   requireLogin,
          environment: runtimeConfig?.environment || 'unknown',
          source: runtimeConfig?.source || 'build-time',
        })
        
        if (!isPlatform && !requireLogin) {
          console.log('[Sign In] Self-hosted instance without login requirement, redirecting to projects')
          router.replace('/project/default')
        }
      } catch (error) {
        console.warn('[Sign In] Failed to fetch runtime config, using build-time defaults:', error)
        
        // Fall back to build-time configuration
        const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
        
        if (!IS_PLATFORM && !requireLogin) {
          console.log('[Sign In] Using build-time config: redirecting to projects (no login required)')
          router.replace('/project/default')
        }
      }
    }
    
    checkAuthenticationMode()
  }, [router])

  return (
    <>
      <div className="flex flex-col gap-5">
        {customProvider && <SignInWithCustom providerName={customProvider} />}
        {signInWithGithubEnabled && <SignInWithGitHub />}
        {signInWithSsoEnabled && (
          <LastSignInWrapper type="sso">
            <Button
              asChild
              block
              size="large"
              type="outline"
              icon={<Lock width={18} height={18} />}
            >
              <Link
                href={{
                  pathname: '/sign-in-sso',
                  query: router.query,
                }}
              >
                Continue with SSO
              </Link>
            </Button>
          </LastSignInWrapper>
        )}

        {showOrDivider && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-strong" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 text-sm bg-studio text-foreground">or</span>
            </div>
          </div>
        )}
        {signInWithEmailEnabled && <SignInForm />}
      </div>

      {signUpEnabled && (
        <div className="self-center my-8 text-sm">
          <div>
            <span className="text-foreground-light">Don't have an account?</span>{' '}
            <Link
              href={{
                pathname: '/sign-up',
                query: router.query,
              }}
              className="underline transition text-foreground hover:text-foreground-light"
            >
              Sign Up Now
            </Link>
          </div>
        </div>
      )}
    </>
  )
}

SignInPage.getLayout = (page) => (
  <AuthenticationLayout>
    <SignInLayout
      heading="Welcome back"
      subheading="Sign in to your account"
      logoLinkToMarketingSite={true}
    >
      {page}
    </SignInLayout>
  </AuthenticationLayout>
)

export default SignInPage
