import { useState } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'

import { Button, Input_Shadcn_, copyToClipboard, Skeleton } from 'ui'
import { FormItemLayout } from 'ui-patterns/form/FormItemLayout/FormItemLayout'

interface ProjectUrlDisplayProps {
  projectRef: string
  apiUrl?: string
  isLoading?: boolean
}

export const ProjectUrlDisplay = ({ projectRef, apiUrl, isLoading }: ProjectUrlDisplayProps) => {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = () => {
    if (!apiUrl) return

    copyToClipboard(apiUrl, () => {
      setIsCopied(true)
      toast.success('Project URL copied to clipboard')
      setTimeout(() => setIsCopied(false), 2000)
    })
  }

  if (isLoading) {
    return (
      <FormItemLayout
        label="Project URL"
        description="The base URL for your project's Data API endpoints"
        layout="horizontal"
        className="px-8 py-8"
      >
        <div className="flex items-center gap-2">
          <Skeleton className="h-[38px] flex-1" />
          <Skeleton className="h-[38px] w-16" />
        </div>
      </FormItemLayout>
    )
  }

  return (
    <FormItemLayout
      label="Project URL"
      description="The base URL for your project's Data API endpoints"
      layout="horizontal"
      className="px-8 py-8"
    >
      <div className="flex items-center gap-2">
        <Input_Shadcn_ 
          readOnly 
          value={apiUrl || ''} 
          className="flex-1 font-mono text-sm"
        />
        <Button 
          type="default" 
          icon={<Copy />} 
          onClick={handleCopy}
          size="tiny"
        >
          {isCopied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </FormItemLayout>
  )
}