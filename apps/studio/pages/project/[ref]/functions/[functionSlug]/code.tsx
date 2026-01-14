import { common, dirname, relative } from '@std/path/posix'
import { PermissionAction } from '@supabase/shared-types/out/constants'
import { AlertCircle, CornerDownLeft, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useParams } from 'common'
import { DeployEdgeFunctionWarningModal } from 'components/interfaces/EdgeFunctions/DeployEdgeFunctionWarningModal'
import { EdgeFunctionFile } from 'components/interfaces/EdgeFunctions/EdgeFunction.types'
import DefaultLayout from 'components/layouts/DefaultLayout'
import EdgeFunctionDetailsLayout from 'components/layouts/EdgeFunctionsLayout/EdgeFunctionDetailsLayout'
import { ButtonTooltip } from 'components/ui/ButtonTooltip'
import { FileExplorerAndEditor } from 'components/ui/FileExplorerAndEditor'
import { useEdgeFunctionBodyQuery } from 'data/edge-functions/edge-function-body-query'
import { useEdgeFunctionQuery } from 'data/edge-functions/edge-function-query'
import { useEdgeFunctionDeployMutation } from 'data/edge-functions/edge-functions-deploy-mutation'
import { useSendEventMutation } from 'data/telemetry/send-event-mutation'
import { useAsyncCheckPermissions } from 'hooks/misc/useCheckPermissions'
import { useSelectedOrganizationQuery } from 'hooks/misc/useSelectedOrganization'
import { useSelectedProjectQuery } from 'hooks/misc/useSelectedProject'
import { BASE_PATH } from 'lib/constants'
import { LogoLoader, Button } from 'ui'

const CodePage = () => {
  const { ref, functionSlug } = useParams()
  const { data: project } = useSelectedProjectQuery()
  const { data: org } = useSelectedOrganizationQuery()

  const { mutate: sendEvent } = useSendEventMutation()
  const [showDeployWarning, setShowDeployWarning] = useState(false)

  const { can: canDeployFunction } = useAsyncCheckPermissions(PermissionAction.FUNCTIONS_WRITE, '*')

  const { data: selectedFunction } = useEdgeFunctionQuery({
    projectRef: ref,
    slug: functionSlug,
  })
  const {
    data: functionBody,
    isLoading: isLoadingFiles,
    isError: isErrorLoadingFiles,
    isSuccess: isSuccessLoadingFiles,
    error: filesError,
    refetch: refetchFiles,
  } = useEdgeFunctionBodyQuery(
    {
      projectRef: ref,
      slug: functionSlug,
    },
    {
      // [Alaister]: These parameters prevent the function files
      // from being refetched when the user is editing the code
      retry: false,
      retryOnMount: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchInterval: false,
      refetchIntervalInBackground: false,
    }
  )
  const [files, setFiles] = useState<EdgeFunctionFile[]>([])

  const { mutate: deployFunction, isPending: isDeploying } = useEdgeFunctionDeployMutation({
    onSuccess: () => {
      toast.success('Successfully updated edge function')
      setShowDeployWarning(false)
    },
  })

  const onUpdate = async () => {
    if (isDeploying || !ref || !functionSlug || !selectedFunction || files.length === 0) return

    try {
      const newEntrypointPath = selectedFunction.entrypoint_path?.split('/').pop()
      const newImportMapPath = selectedFunction.import_map_path?.split('/').pop()

      deployFunction({
        projectRef: ref,
        slug: selectedFunction.slug,
        metadata: {
          name: selectedFunction.name,
          verify_jwt: selectedFunction.verify_jwt,
          entrypoint_path: newEntrypointPath,
          import_map_path: newImportMapPath,
        },
        files: files.map(({ name, content }) => ({ name, content })),
      })
    } catch (error) {
      toast.error(
        `Failed to update function: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  function getBasePath(entrypoint: string | undefined, fileNames: string[]): string {
    if (!entrypoint) {
      return '/'
    }

    let candidate = fileNames.find((name) => entrypoint.endsWith(name))

    if (candidate) {
      return dirname(candidate)
    } else {
      try {
        return dirname(new URL(entrypoint).pathname)
      } catch (e) {
        console.error('Failed to parse entrypoint', entrypoint)
        return '/'
      }
    }
  }

  const handleDeployClick = () => {
    if (files.length === 0 || isLoadingFiles) return
    setShowDeployWarning(true)
    sendEvent({
      action: 'edge_function_deploy_updates_button_clicked',
      groups: {
        project: ref ?? 'Unknown',
        organization: org?.slug ?? 'Unknown',
      },
    })
  }

  const handleRetryLoad = () => {
    refetchFiles()
  }

  const handleDeployConfirm = () => {
    sendEvent({
      action: 'edge_function_deploy_updates_confirm_clicked',
      groups: {
        project: ref ?? 'Unknown',
        organization: org?.slug ?? 'Unknown',
      },
    })
    onUpdate()
  }

  useEffect(() => {
    // Set files from API response when available
    if (selectedFunction?.entrypoint_path && functionBody) {
      const base_path = getBasePath(
        selectedFunction?.entrypoint_path,
        functionBody.files.map((file) => file.name)
      )
      const filesWithRelPath = functionBody.files
        // set file paths relative to entrypoint
        .map((file: { name: string; content: string }) => {
          try {
            // if the current file and base path doesn't share a common path,
            // return unmodified file
            const common_path = common([base_path, file.name])
            if (common_path === '' || common_path === '/tmp/') {
              return file
            }

            // prepend "/" to turn relative paths to absolute
            file.name = relative('/' + base_path, '/' + file.name)
            return file
          } catch (e) {
            console.error(e)
            // return unmodified file
            return file
          }
        })

      setFiles((prev) => {
        return filesWithRelPath.map((file: { name: string; content: string }, index: number) => {
          const prevState = prev.find((x) => x.name === file.name)
          return {
            id: index + 1,
            name: file.name,
            content: file.content,
            selected: prevState?.selected ?? index === 0,
          }
        })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [functionBody])

  return (
    <div className="flex flex-col h-full">
      {isLoadingFiles && (
        <div className="flex flex-col items-center justify-center h-full bg-surface-200">
          <LogoLoader />
        </div>
      )}

      {isErrorLoadingFiles && (
        <div className="flex flex-col items-center justify-center h-full bg-surface-200">
          <div className="flex flex-col items-center text-center gap-4 max-w-md">
            <AlertCircle size={24} strokeWidth={1.5} className="text-amber-900" />
            <div className="space-y-2">
              <h3 className="text-md mt-4">Failed to load function code</h3>
              <p className="text-sm text-foreground-light">
                {filesError?.message?.includes('not found') || filesError?.message?.includes('404')
                  ? `The function "${functionSlug}" could not be found. It may have been deleted or the slug may be incorrect.`
                  : filesError?.message?.includes('permission') || filesError?.message?.includes('403')
                  ? 'You do not have permission to view this function code.'
                  : filesError?.message?.includes('timeout') || filesError?.message?.includes('network')
                  ? 'Unable to connect to the Edge Functions service. Please check your network connection.'
                  : filesError?.message ||
                    'There was an error loading the function code. The format may be invalid or the function may be corrupted.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="default"
                size="small"
                icon={<RefreshCw size={14} />}
                onClick={handleRetryLoad}
              >
                Retry
              </Button>
              <Button
                type="default"
                size="small"
                onClick={() => window.history.back()}
              >
                Go back
              </Button>
            </div>
          </div>
        </div>
      )}

      {isSuccessLoadingFiles && (
        <>
          <FileExplorerAndEditor
            files={files}
            onFilesChange={setFiles}
            aiEndpoint={`${BASE_PATH}/api/ai/code/complete`}
            aiMetadata={{
              projectRef: project?.ref,
              connectionString: project?.connectionString,
              orgSlug: org?.slug,
            }}
          />
          <div className="flex items-center bg-background-muted justify-end p-4 border-t bg-surface-100 shrink-0">
            <ButtonTooltip
              loading={isDeploying}
              size="medium"
              disabled={!canDeployFunction || files.length === 0 || isLoadingFiles}
              onClick={handleDeployClick}
              iconRight={
                isDeploying ? (
                  <Loader2 className="animate-spin" size={10} strokeWidth={1.5} />
                ) : (
                  <div className="flex items-center space-x-1">
                    <CornerDownLeft size={10} strokeWidth={1.5} />
                  </div>
                )
              }
              tooltip={{
                content: {
                  side: 'top',
                  text: !canDeployFunction
                    ? 'You need additional permissions to update edge functions'
                    : undefined,
                },
              }}
            >
              Deploy updates
            </ButtonTooltip>
          </div>
        </>
      )}

      <DeployEdgeFunctionWarningModal
        visible={showDeployWarning}
        onCancel={() => setShowDeployWarning(false)}
        onConfirm={handleDeployConfirm}
        isDeploying={isDeploying}
      />
    </div>
  )
}

CodePage.getLayout = (page: React.ReactNode) => {
  return (
    <DefaultLayout>
      <EdgeFunctionDetailsLayout>{page}</EdgeFunctionDetailsLayout>
    </DefaultLayout>
  )
}

export default CodePage
