/**
 * Tests for API URL logging functionality
 * 
 * Validates that all API requests log their URLs for debugging purposes.
 * 
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'

describe('API URL Logging', () => {
  describe('Implementation Verification', () => {
    it('should have URL logging in gotrue.ts', async () => {
      // Read the gotrue.ts file to verify URL logging is implemented
      const fs = await import('fs/promises')
      const path = await import('path')
      
      const gotrueFilePath = path.join(process.cwd(), '../../packages/common/gotrue.ts')
      const gotrueContent = await fs.readFile(gotrueFilePath, 'utf-8')
      
      // Verify URL logging is present in fetch wrapper
      expect(gotrueContent).toContain('[GoTrue Client] Making request to:')
      expect(gotrueContent).toContain('[GoTrue Client] Request failed:')
      expect(gotrueContent).toContain('[GoTrue Client] Request error:')
    })

    it('should have URL logging in gotrue-health.ts', async () => {
      const fs = await import('fs/promises')
      const path = await import('path')
      
      const healthFilePath = path.join(process.cwd(), 'lib/gotrue-health.ts')
      const healthContent = await fs.readFile(healthFilePath, 'utf-8')
      
      // Verify URL logging is present
      expect(healthContent).toContain('[GoTrue Health] Checking health at:')
      expect(healthContent).toContain('[GoTrue Health] Health check successful:')
      expect(healthContent).toContain('[GoTrue Health] Health check failed:')
      expect(healthContent).toContain('[GoTrue Health] Health check error:')
    })

    it('should have URL logging in config-health.ts', async () => {
      const fs = await import('fs/promises')
      const path = await import('path')
      
      const configHealthFilePath = path.join(process.cwd(), 'lib/config-health.ts')
      const configHealthContent = await fs.readFile(configHealthFilePath, 'utf-8')
      
      // Verify URL logging is present
      expect(configHealthContent).toContain('[Config Health] Checking service reachability:')
      expect(configHealthContent).toContain('[Config Health] Service reachable:')
      expect(configHealthContent).toContain('[Config Health] Service check failed:')
      expect(configHealthContent).toContain('[Config Health] Service check timeout:')
    })

    it('should have URL logging in logs.ts', async () => {
      const fs = await import('fs/promises')
      const path = await import('path')
      
      const logsFilePath = path.join(process.cwd(), 'lib/api/self-hosted/logs.ts')
      const logsContent = await fs.readFile(logsFilePath, 'utf-8')
      
      // Verify URL logging is present
      expect(logsContent).toContain('[Analytics API] Making request to:')
      expect(logsContent).toContain('[Analytics API] Request failed:')
      expect(logsContent).toContain('[Analytics API] Request error:')
    })

    it('should have runtime config integration in auth.tsx', async () => {
      const fs = await import('fs/promises')
      const path = await import('path')
      
      const authFilePath = path.join(process.cwd(), '../../packages/common/auth.tsx')
      const authContent = await fs.readFile(authFilePath, 'utf-8')
      
      // Verify runtime config update is called
      expect(authContent).toContain('updateGoTrueClientUrl')
      expect(authContent).toContain('await updateGoTrueClientUrl()')
    })

    it('should have runtime config subscription in gotrue.ts', async () => {
      const fs = await import('fs/promises')
      const path = await import('path')
      
      const gotrueFilePath = path.join(process.cwd(), '../../packages/common/gotrue.ts')
      const gotrueContent = await fs.readFile(gotrueFilePath, 'utf-8')
      
      // Verify runtime config subscription is present
      expect(gotrueContent).toContain('subscribeToConfigChanges')
      expect(gotrueContent).toContain('updateGoTrueClientUrl')
    })
  })
})
