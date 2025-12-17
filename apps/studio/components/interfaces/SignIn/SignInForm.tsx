import HCaptcha from '@hcaptcha/react-hcaptcha'
import { zodResolver } from '@hookform/resolvers/zod'
import type { AuthError } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { type SubmitHandler, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import z from 'zod'

import { useAddLoginEvent } from 'data/misc/audit-login-mutation'
import { getMfaAuthenticatorAssuranceLevel } from 'data/profile/mfa-authenticator-assurance-level-query'
import { useSendEventMutation } from 'data/telemetry/send-event-mutation'
import { useLastSignIn } from 'hooks/misc/useLastSignIn'
import { captureCriticalError } from 'lib/error-reporting'
import { auth, buildPathWithParams, getReturnToPath } from 'lib/gotrue'
import { analyzeNetworkError, withNetworkErrorHandling } from 'lib/network-error-handler'
import { Button, Form_Shadcn_, FormControl_Shadcn_, FormField_Shadcn_, Input_Shadcn_ } from 'ui'
import { FormItemLayout } from 'ui-patterns/form/FormItemLayout/FormItemLayout'
import { LastSignInWrapper } from './LastSignInWrapper'
import { Eye, EyeOff } from 'lucide-react'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Must be a valid email'),
  password: z.string().min(1, 'Password is required'),
})

const formId = 'sign-in-form'

export const SignInForm = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [_, setLastSignIn] = useLastSignIn()

  const [passwordHidden, setPasswordHidden] = useState(true)

  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaRef = useRef<HCaptcha>(null)
  const [returnTo, setReturnTo] = useState<string | null>(null)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })
  const isSubmitting = form.formState.isSubmitting

  useEffect(() => {
    // Only call getReturnToPath after component mounts client-side
    setReturnTo(getReturnToPath())
  }, [])

  const { mutate: sendEvent } = useSendEventMutation()
  const { mutate: addLoginEvent } = useAddLoginEvent()

  let forgotPasswordUrl = `/forgot-password`

  if (returnTo && !returnTo.includes('/forgot-password')) {
    forgotPasswordUrl = `${forgotPasswordUrl}?returnTo=${encodeURIComponent(returnTo)}`
  }

  const onSubmit: SubmitHandler<z.infer<typeof schema>> = async ({ email, password }) => {
    const toastId = toast.loading('Signing in...')

    try {
      let token = captchaToken
      // Only execute captcha if site key is configured
      if (!token && process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY) {
        const captchaResponse = await captchaRef.current?.execute({ async: true })
        token = captchaResponse?.response ?? null
      }

      // Call signin API endpoint (uses runtime GoTrue URL configuration)
      const IS_PLATFORM = process.env.NEXT_PUBLIC_IS_PLATFORM === 'true'
      
      let data: any = null
      let error: any = null

      if (!IS_PLATFORM) {
        // Self-hosted mode: use API endpoint for runtime URL resolution
        const response = await withNetworkErrorHandling(
          () => fetch('/api/platform/signin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email,
              password,
              captchaToken: token ?? undefined,
            }),
          }),
          {
            maxRetries: 2,
            initialDelayMs: 1000,
            onError: (errorAnalysis) => {
              if (errorAnalysis.isNetworkError) {
                console.error('[SignIn] Network error during authentication:', errorAnalysis.technicalMessage)
              }
            },
          }
        )

        const result = await response.json()
        
        if (!response.ok) {
          error = { message: result.error || 'Failed to sign in' }
        } else {
          data = result
          // Set session manually since we're not using auth.signInWithPassword
          if (result.session) {
            await auth.setSession(result.session)
          }
        }
      } else {
        // Platform mode: use direct auth client
        const result = await withNetworkErrorHandling(
          () => auth.signInWithPassword({
            email,
            password,
            options: { captchaToken: token ?? undefined },
          }),
          {
            maxRetries: 2,
            initialDelayMs: 1000,
            onError: (errorAnalysis) => {
              if (errorAnalysis.isNetworkError) {
                console.error('[SignIn] Network error during authentication:', errorAnalysis.technicalMessage)
              }
            },
          }
        )
        
        data = result.data
        error = result.error
      }

    if (!error) {
      setLastSignIn('email')
      try {
        // Check MFA status - but don't block login if this fails
        try {
          const mfaData = await getMfaAuthenticatorAssuranceLevel()
          if (mfaData) {
            if (mfaData.currentLevel !== mfaData.nextLevel) {
              toast.success(`You need to provide your second factor authentication`, { id: toastId })
              const url = buildPathWithParams('/sign-in-mfa')
              router.replace(url)
              return
            }
          }
        } catch (mfaError: any) {
          // Log MFA check error but continue with login
          console.warn('[SignIn] MFA check failed, continuing with login:', mfaError)
        }

        toast.success(`Signed in successfully!`, { id: toastId })
        sendEvent({
          action: 'sign_in',
          properties: { category: 'account', method: 'email' },
        })
        addLoginEvent({})

        await queryClient.resetQueries()
        // since we're already on the /sign-in page, prevent redirect loops
        const IS_PLATFORM = process.env.NEXT_PUBLIC_IS_PLATFORM === 'true'
        let redirectPath = IS_PLATFORM ? '/organizations' : '/project/default'
        if (returnTo && returnTo !== '/sign-in') {
          redirectPath = returnTo
        }
        
        console.log('[SignIn] Redirecting to:', redirectPath)
        router.push(redirectPath)
      } catch (error: any) {
        console.error('[SignIn] Post-login error:', error)
        toast.error(`Failed to complete sign in: ${(error as AuthError).message}`, { id: toastId })
        captureCriticalError(error, 'sign in via EP')
      }
    } else {
      setCaptchaToken(null)
      captchaRef.current?.resetCaptcha()

      // Clear password field for security after failed login
      form.setValue('password', '')

      // Handle specific error cases with user-friendly messages
      const errorMessage = error.message.toLowerCase()
      
      if (errorMessage === 'email not confirmed') {
        return toast.error(
          'Account has not been verified, please check the link sent to your email',
          { id: toastId }
        )
      }
      
      // Handle invalid credentials - don't reveal which field is incorrect
      if (
        errorMessage.includes('invalid login credentials') ||
        errorMessage.includes('invalid email or password') ||
        errorMessage.includes('email not found') ||
        errorMessage.includes('invalid password')
      ) {
        return toast.error(
          'Invalid email or password. Please check your credentials and try again.',
          { id: toastId }
        )
      }

      // Log error for debugging
      console.error('[SignIn] Authentication error:', error)

      // Display the error message from GoTrue
      toast.error(error.message, { id: toastId })
    }
    } catch (error: any) {
      // Handle network errors that failed after retries
      const errorAnalysis = analyzeNetworkError(error)
      
      if (errorAnalysis.isNetworkError) {
        toast.error(errorAnalysis.userMessage, {
          id: toastId,
          description: 'Please check your internet connection and try again.',
          action: {
            label: 'Retry',
            onClick: () => form.handleSubmit(onSubmit)(),
          },
        })
      } else {
        // Unexpected error
        console.error('[SignIn] Unexpected error during sign in:', error)
        toast.error('An unexpected error occurred. Please try again.', {
          id: toastId,
          description: error.message || 'Unknown error',
        })
      }
      
      // Reset captcha and password field
      setCaptchaToken(null)
      captchaRef.current?.resetCaptcha()
      form.setValue('password', '')
    }
  }

  return (
    <Form_Shadcn_ {...form}>
      <form id={formId} className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField_Shadcn_
          key="email"
          name="email"
          control={form.control}
          render={({ field }) => (
            <FormItemLayout name="email" label="Email">
              <FormControl_Shadcn_>
                <Input_Shadcn_
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...field}
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                />
              </FormControl_Shadcn_>
            </FormItemLayout>
          )}
        />

        <div className="relative">
          <FormField_Shadcn_
            key="password"
            name="password"
            control={form.control}
            render={({ field }) => (
              <FormItemLayout name="password" label="Password">
                <FormControl_Shadcn_>
                  <div className="relative">
                    <Input_Shadcn_
                      id="password"
                      type={passwordHidden ? 'password' : 'text'}
                      autoComplete="current-password"
                      {...field}
                      placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                      disabled={isSubmitting}
                      className="pr-10"
                    />
                    <Button
                      type="default"
                      title={passwordHidden ? `Show password` : `Hide password`}
                      aria-label={passwordHidden ? `Show password` : `Hide password`}
                      className="absolute right-1 top-1 px-1.5"
                      icon={passwordHidden ? <Eye /> : <EyeOff />}
                      disabled={isSubmitting}
                      onClick={() => setPasswordHidden((prev) => !prev)}
                    />
                  </div>
                </FormControl_Shadcn_>
              </FormItemLayout>
            )}
          />

          {/* positioned using absolute instead of labelOptional prop so tabbing between inputs works smoothly */}
          <Link
            href={forgotPasswordUrl}
            className="absolute top-0 right-0 text-sm text-foreground-lighter"
          >
            Forgot Password?
          </Link>
        </div>

        {process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY && (
          <div className="self-center">
            <HCaptcha
              ref={captchaRef}
              sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY}
              size="invisible"
              onVerify={(token) => {
                setCaptchaToken(token)
              }}
              onExpire={() => {
                setCaptchaToken(null)
              }}
            />
          </div>
        )}

        <LastSignInWrapper type="email">
          <Button block form={formId} htmlType="submit" size="large" loading={isSubmitting}>
            Sign In
          </Button>
        </LastSignInWrapper>
      </form>
    </Form_Shadcn_>
  )
}
