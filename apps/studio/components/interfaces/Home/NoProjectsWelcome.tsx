import { useRouter } from 'next/router'
import { Button } from 'ui'
import { Plus } from 'lucide-react'

export const NoProjectsWelcome = () => {
  const router = useRouter()

  const handleCreateProject = () => {
    // Navigate to project creation page
    router.push('/new/default-org-slug')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Welcome to Supabase Studio</h1>
          <p className="text-foreground-light text-lg">
            Get started by creating your first project
          </p>
        </div>

        <div className="space-y-4 text-left bg-surface-100 p-6 rounded-lg">
          <h2 className="text-lg font-semibold">What is a project?</h2>
          <ul className="space-y-2 text-foreground-light">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Each project has its own dedicated PostgreSQL database</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Manage tables, authentication, storage, and more</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Projects are isolated from each other for security</span>
            </li>
          </ul>
        </div>

        <Button
          size="large"
          type="primary"
          icon={<Plus />}
          onClick={handleCreateProject}
          className="w-full"
        >
          Create Your First Project
        </Button>

        <p className="text-sm text-foreground-lighter">
          You can create multiple projects to organize your work
        </p>
      </div>
    </div>
  )
}
