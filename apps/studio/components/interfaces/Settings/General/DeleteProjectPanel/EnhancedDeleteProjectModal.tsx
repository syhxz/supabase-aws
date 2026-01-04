/**
 * Enhanced Delete Project Modal with comprehensive error handling
 * 
 * This component provides:
 * - Comprehensive error handling for project deletion operations
 * - User-friendly error messages and recovery options
 * - Proper validation and confirmation flow
 * - Graceful error recovery and retry mechanisms
 * 
 * Requirements: All error handling scenarios for project deletion
 */

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { LOCAL_STORAGE_KEYS } from 'common'
import { CANCELLATION_REASONS } from 'components/interfaces/Billing/Billing.constants'
import { useSendDowngradeFeedbackMutation } from 'data/feedback/exit-survey-send'
import { useProjectDeleteMutation } from 'data/projects/project-delete-mutation'
import { useOrgSubscriptionQuery } from 'data/subscriptions/org-subscription-query'
import { useLocalStorageQuery } from 'hooks/misc/useLocalStorage'
import { useSelectedOrganizationQuery } from 'hooks/misc/useSelectedOrganization'
import { useSelectedProjectQuery } from 'hooks/misc/useSelectedProject'
import { Input, Button } from 'ui'
import TextConfirmModal from 'ui-patterns/Dialogs/TextConfirmModal'
import { 
  ProjectManagementError, 
  ErrorFactory, 
  handleClientError, 
  createErrorContext 
} from '../../../../../lib/api/error-handling'

export interface EnhancedDeleteProjectModalProps {
  visible: boolean
  onClose: () => void
}

export const EnhancedDeleteProjectModal = ({
  visible,
  onClose,
}: EnhancedDeleteProjectModalProps) => {
  const router = useRouter()
  const { data: project } = useSelectedProjectQuery()
  const { data: organization } = useSelectedOrganizationQuery()

  const [lastVisitedOrganization] = useLocalStorageQuery(
    LOCAL_STORAGE_KEYS.LAST_VISITED_ORGANIZATION,
    ''
  )

  // State for error handling
  const [error, setError] = useState<ProjectManagementError | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  // Existing state
  const projectRef = project?.ref
  const { data: subscription } = useOrgSubscriptionQuery({ orgSlug: organization?.slug })
  const projectPlan = subscription?.plan?.id ?? 'free'
  const isFree = projectPlan === 'free'

  const [message, setMessage] = useState<string>('')
  const [selectedReason, setSelectedReason] = useState<string[]>([])

  // Single select for cancellation reason
  const onSelectCancellationReason = (reason: string) => {
    setSelectedReason([reason])
    setError(null) // Clear any previous errors when user interacts
  }

  // Helper to get label for selected reason
  const getReasonLabel = (reason: string | undefined) => {
    const found = CANCELLATION_REASONS.find((r) => r.value === reason)
    return found?.label || 'What can we improve on?'
  }

  const textareaLabel = getReasonLabel(selectedReason[0])

  const [shuffledReasons] = useState(() => [
    ...CANCELLATION_REASONS.sort(() => Math.random() - 0.5),
    { value: 'None of the above' },
  ])

  const { mutate: deleteProject, isPending: isDeleting } = useProjectDeleteMutation({
    onSuccess: async () => {
      try {
        if (!isFree) {
          await sendExitSurvey({
            orgSlug: organization?.slug,
            projectRef,
            message,
            reasons: selectedReason.reduce((a, b) => `${a}- ${b}\n`, ''),
            exitAction: 'delete',
          })
        }

        toast.success(`Successfully deleted ${project?.name}`)
        setError(null)
        setRetryCount(0)

        if (lastVisitedOrganization) {
          router.push(`/org/${lastVisitedOrganization}`)
        } else {
          router.push('/organizations')
        }
      } catch (surveyError) {
        // Don't block deletion success if survey fails
        console.warn('Exit survey failed to send:', surveyError)
        toast.success(`Successfully deleted ${project?.name}`)
        
        if (lastVisitedOrganization) {
          router.push(`/org/${lastVisitedOrganization}`)
        } else {
          router.push('/organizations')
        }
      }
    },
    onError: (deleteError) => {
      const errorContext = createErrorContext('deleteProject', {
        projectId: project?.id,
        projectRef: project?.ref,
        endpoint: 'project-deletion'
      })

      let managementError: ProjectManagementError

      // Handle different types of deletion errors
      if (deleteError instanceof Error) {
        if (deleteError.message.includes('not found')) {
          managementError = ErrorFactory.projectDeletion.projectNotFound(project?.ref || '', errorContext)
        } else if (deleteError.message.includes('forbidden') || deleteError.message.includes('permission')) {
          managementError = ErrorFactory.projectDeletion.deleteForbidden(project?.ref || '', errorContext)
        } else if (deleteError.message.includes('default project')) {
          managementError = ErrorFactory.projectDeletion.deleteDefaultProject(errorContext)
        } else {
          managementError = ErrorFactory.projectDeletion.deleteFailed(project?.ref || '', deleteError, errorContext)
        }
      } else {
        managementError = ErrorFactory.projectDeletion.deleteFailed(
          project?.ref || '', 
          new Error('Unknown deletion error'), 
          errorContext
        )
      }

      setError(managementError)
      handleClientError(managementError, { showToast: true })
    }
  })

  const { mutateAsync: sendExitSurvey, isPending: isSending } = useSendDowngradeFeedbackMutation()
  const isSubmitting = isDeleting || isSending || isRetrying

  /**
   * Enhanced project deletion handler with comprehensive error handling
   */
  async function handleDeleteProject() {
    const errorContext = createErrorContext('handleDeleteProject', {
      projectId: project?.id,
      projectRef: project?.ref,
      retryCount
    })

    try {
      // Clear previous errors
      setError(null)

      // Validate project exists
      if (!project) {
        throw ErrorFactory.projectDeletion.projectNotFound('', errorContext)
      }

      // Validate project name confirmation (this is handled by TextConfirmModal)
      // Additional validation for non-free projects
      if (!isFree && selectedReason.length === 0) {
        throw ErrorFactory.projectDeletion.validationFailed(
          'Please select a reason for deleting your project',
          errorContext
        )
      }

      // Validate project is not default project
      if (project.ref === 'default') {
        throw ErrorFactory.projectDeletion.deleteDefaultProject(errorContext)
      }

      // Attempt deletion
      deleteProject({ 
        projectRef: project.ref, 
        organizationSlug: organization?.slug 
      })

    } catch (validationError) {
      if (validationError instanceof ProjectManagementError) {
        setError(validationError)
        handleClientError(validationError, { showToast: true })
      } else {
        const managementError = ErrorFactory.projectDeletion.deleteFailed(
          project?.ref || '',
          validationError as Error,
          errorContext
        )
        setError(managementError)
        handleClientError(managementError, { showToast: true })
      }
    }
  }

  /**
   * Retry deletion with exponential backoff
   */
  async function handleRetryDeletion() {
    if (retryCount >= 3) {
      const errorContext = createErrorContext('handleRetryDeletion', {
        projectId: project?.id,
        projectRef: project?.ref,
        retryCount
      })
      
      const maxRetriesError = ErrorFactory.projectDeletion.deleteFailed(
        project?.ref || '',
        new Error('Maximum retry attempts exceeded'),
        errorContext
      )
      
      setError(maxRetriesError)
      handleClientError(maxRetriesError, { showToast: true })
      return
    }

    setIsRetrying(true)
    setRetryCount(prev => prev + 1)

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, retryCount) * 1000
    await new Promise(resolve => setTimeout(resolve, delay))

    setIsRetrying(false)
    await handleDeleteProject()
  }

  /**
   * Handle modal close with error state cleanup
   */
  function handleClose() {
    if (!isSubmitting) {
      setError(null)
      setRetryCount(0)
      onClose()
    }
  }

  /**
   * Reset form state when modal becomes visible
   */
  useEffect(() => {
    if (visible) {
      setSelectedReason([])
      setMessage('')
      setError(null)
      setRetryCount(0)
    }
  }, [visible])

  /**
   * Render error recovery options
   */
  function renderErrorRecovery() {
    if (!error || !error.recoveryOptions?.length) return null

    return (
      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
        <h4 className="text-sm font-medium text-red-800 mb-2">
          Error Recovery Options
        </h4>
        <div className="flex flex-wrap gap-2">
          {error.recoveryOptions.map((option, index) => (
            <Button
              key={index}
              type={option.type}
              size="tiny"
              onClick={option.action}
              disabled={isSubmitting}
            >
              {option.label}
            </Button>
          ))}
          {error.recoveryStrategy === 'retry' && retryCount < 3 && (
            <Button
              type="default"
              size="tiny"
              onClick={handleRetryDeletion}
              loading={isRetrying}
              disabled={isSubmitting}
            >
              Retry ({3 - retryCount} attempts left)
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <TextConfirmModal
      visible={visible}
      loading={isSubmitting}
      size={isFree ? 'small' : 'xlarge'}
      title={`Confirm deletion of ${project?.name}`}
      variant="destructive"
      alert={{
        title: isFree
          ? 'This action cannot be undone.'
          : `This will permanently delete the ${project?.name}`,
        description: !isFree ? `All project data will be lost, and cannot be undone` : '',
      }}
      text={
        isFree
          ? `This will permanently delete the ${project?.name} project and all of its data.`
          : undefined
      }
      confirmPlaceholder="Type the project name in here"
      confirmString={project?.name || ''}
      confirmLabel="I understand, delete this project"
      onConfirm={handleDeleteProject}
      onCancel={handleClose}
    >
      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Deletion Failed
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error.userMessage}</p>
              </div>
            </div>
          </div>
          {renderErrorRecovery()}
        </div>
      )}

      {/* Exit survey for non-free projects */}
      {!isFree && (
        <>
          <div className="space-y-1">
            <h4 className="text-base">
              Help us improve by sharing why you're deleting your project.
            </h4>
          </div>
          <div className="space-y-4 pt-4">
            <div className="flex flex-wrap gap-2" data-toggle="buttons">
              {shuffledReasons.map((option) => {
                const active = selectedReason[0] === option.value
                return (
                  <label
                    key={option.value}
                    className={[
                      'flex cursor-pointer items-center space-x-2 rounded-md py-1',
                      'pl-2 pr-3 text-center text-sm shadow-sm transition-all duration-100',
                      `${
                        active
                          ? ` bg-foreground text-background opacity-100 hover:bg-opacity-75`
                          : ` bg-border-strong text-foreground opacity-50 hover:opacity-75`
                      }`,
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="options"
                      value={option.value}
                      className="hidden"
                      checked={active}
                      onChange={() => onSelectCancellationReason(option.value)}
                    />
                    <div>{option.value}</div>
                  </label>
                )
              })}
            </div>
            <div className="text-area-text-sm flex flex-col gap-y-2">
              <label className="text-sm whitespace-pre-line break-words">{textareaLabel}</label>
              <Input.TextArea
                name="message"
                rows={3}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </>
      )}
    </TextConfirmModal>
  )
}