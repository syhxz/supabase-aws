/**
 * Tests for project store credential preference functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as ProjectStore from './project-store-adapter'
import { resetCredentialFallbackManager } from './credential-fallback-manager'

describe('Project Store Credential Preference', () => {
  beforeEach(() => {
    // Reset the credential fallback manager before each test
    resetCredentialFallbackManager()
  })

  afterEach(() => {
    // Clean up after each test
    resetCredentialFallbackManager()
  })

  describe('Enhanced Project Metadata', () => {
    it('should calculate credential status correctly for complete credentials', async () => {
      // Create a project with complete credentials
      const projectData = {
        ref: 'test-complete-creds',
        name: 'Test Complete Credentials',
        database_name: 'test_complete_db',
        database_user: 'test_user',
        database_password_hash: 'hashed_password_123',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'localhost',
        connection_string: 'postgresql://test_user:password@localhost:5432/test_complete_db'
      }

      const saveResult = await ProjectStore.save(projectData)
      expect(saveResult.error).toBeUndefined()
      expect(saveResult.data).toBeDefined()

      if (saveResult.data) {
        const enhancedResult = await ProjectStore.findByRefWithCredentialStatus(projectData.ref)
        expect(enhancedResult.error).toBeUndefined()
        expect(enhancedResult.data).toBeDefined()

        if (enhancedResult.data) {
          expect(enhancedResult.data.credential_status).toBe('complete')
          expect(enhancedResult.data.uses_fallback_credentials).toBe(false)
        }
      }
    })

    it('should calculate credential status correctly for missing user', async () => {
      // Create a project with missing user
      const projectData = {
        ref: 'test-missing-user',
        name: 'Test Missing User',
        database_name: 'test_missing_user_db',
        database_user: null,
        database_password_hash: 'hashed_password_123',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'localhost',
        connection_string: 'postgresql://fallback:password@localhost:5432/test_missing_user_db'
      }

      const saveResult = await ProjectStore.save(projectData)
      expect(saveResult.error).toBeUndefined()
      expect(saveResult.data).toBeDefined()

      if (saveResult.data) {
        const enhancedResult = await ProjectStore.findByRefWithCredentialStatus(projectData.ref)
        expect(enhancedResult.error).toBeUndefined()
        expect(enhancedResult.data).toBeDefined()

        if (enhancedResult.data) {
          expect(enhancedResult.data.credential_status).toBe('missing_user')
          expect(enhancedResult.data.uses_fallback_credentials).toBe(true)
        }
      }
    })

    it('should calculate credential status correctly for missing password', async () => {
      // Create a project with missing password
      const projectData = {
        ref: 'test-missing-password',
        name: 'Test Missing Password',
        database_name: 'test_missing_password_db',
        database_user: 'test_user',
        database_password_hash: null,
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'localhost',
        connection_string: 'postgresql://test_user:fallback@localhost:5432/test_missing_password_db'
      }

      const saveResult = await ProjectStore.save(projectData)
      expect(saveResult.error).toBeUndefined()
      expect(saveResult.data).toBeDefined()

      if (saveResult.data) {
        const enhancedResult = await ProjectStore.findByRefWithCredentialStatus(projectData.ref)
        expect(enhancedResult.error).toBeUndefined()
        expect(enhancedResult.data).toBeDefined()

        if (enhancedResult.data) {
          expect(enhancedResult.data.credential_status).toBe('missing_password')
          expect(enhancedResult.data.uses_fallback_credentials).toBe(true)
        }
      }
    })

    it('should calculate credential status correctly for missing both credentials', async () => {
      // Create a project with missing both credentials
      const projectData = {
        ref: 'test-missing-both',
        name: 'Test Missing Both',
        database_name: 'test_missing_both_db',
        database_user: null,
        database_password_hash: null,
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'localhost',
        connection_string: 'postgresql://fallback:fallback@localhost:5432/test_missing_both_db'
      }

      const saveResult = await ProjectStore.save(projectData)
      expect(saveResult.error).toBeUndefined()
      expect(saveResult.data).toBeDefined()

      if (saveResult.data) {
        const enhancedResult = await ProjectStore.findByRefWithCredentialStatus(projectData.ref)
        expect(enhancedResult.error).toBeUndefined()
        expect(enhancedResult.data).toBeDefined()

        if (enhancedResult.data) {
          expect(enhancedResult.data.credential_status).toBe('missing_both')
          expect(enhancedResult.data.uses_fallback_credentials).toBe(true)
        }
      }
    })
  })

  describe('Effective Credentials', () => {
    it('should prefer project-specific credentials when complete', async () => {
      // Create a project with complete credentials
      const projectData = {
        ref: 'test-prefer-project',
        name: 'Test Prefer Project Credentials',
        database_name: 'test_prefer_project_db',
        database_user: 'project_user',
        database_password_hash: 'project_password_hash',
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'localhost',
        connection_string: 'postgresql://project_user:password@localhost:5432/test_prefer_project_db'
      }

      const saveResult = await ProjectStore.save(projectData)
      expect(saveResult.error).toBeUndefined()
      expect(saveResult.data).toBeDefined()

      if (saveResult.data) {
        const credentialsResult = await ProjectStore.getProjectEffectiveCredentials(projectData.ref)
        expect(credentialsResult.error).toBeUndefined()
        expect(credentialsResult.data).toBeDefined()

        if (credentialsResult.data) {
          expect(credentialsResult.data.user).toBe('project_user')
          expect(credentialsResult.data.password).toBe('project_password_hash')
          expect(credentialsResult.data.usedFallback).toBe(false)
          expect(credentialsResult.data.fallbackReason).toBeUndefined()
        }
      }
    })

    it('should use fallback credentials when project credentials are incomplete', async () => {
      // Create a project with incomplete credentials
      const projectData = {
        ref: 'test-use-fallback',
        name: 'Test Use Fallback Credentials',
        database_name: 'test_use_fallback_db',
        database_user: null,
        database_password_hash: null,
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'localhost',
        connection_string: 'postgresql://fallback:fallback@localhost:5432/test_use_fallback_db'
      }

      const saveResult = await ProjectStore.save(projectData)
      expect(saveResult.error).toBeUndefined()
      expect(saveResult.data).toBeDefined()

      if (saveResult.data) {
        const credentialsResult = await ProjectStore.getProjectEffectiveCredentials(projectData.ref)
        expect(credentialsResult.error).toBeUndefined()
        expect(credentialsResult.data).toBeDefined()

        if (credentialsResult.data) {
          expect(credentialsResult.data.usedFallback).toBe(true)
          expect(credentialsResult.data.fallbackReason).toBe('missing_both')
          // The actual fallback user/password will depend on environment configuration
          expect(credentialsResult.data.user).toBeDefined()
          expect(credentialsResult.data.password).toBeDefined()
        }
      }
    })
  })

  describe('Credential Updates', () => {
    it('should update project credentials properly', async () => {
      // Create a project with incomplete credentials
      const projectData = {
        ref: 'test-update-creds',
        name: 'Test Update Credentials',
        database_name: 'test_update_creds_db',
        database_user: null,
        database_password_hash: null,
        organization_id: 1,
        status: 'ACTIVE_HEALTHY' as const,
        region: 'localhost',
        connection_string: 'postgresql://fallback:fallback@localhost:5432/test_update_creds_db'
      }

      const saveResult = await ProjectStore.save(projectData)
      expect(saveResult.error).toBeUndefined()
      expect(saveResult.data).toBeDefined()

      if (saveResult.data) {
        const projectId = saveResult.data.id

        // Update with complete credentials
        const updateResult = await ProjectStore.updateProjectCredentials(projectId, {
          database_user: 'updated_user',
          database_password_hash: 'updated_password_hash'
        })

        expect(updateResult.error).toBeUndefined()
        expect(updateResult.data).toBeDefined()

        if (updateResult.data) {
          expect(updateResult.data.database_user).toBe('updated_user')
          expect(updateResult.data.database_password_hash).toBe('updated_password_hash')

          // Verify enhanced status reflects the update
          const enhancedResult = await ProjectStore.findByRefWithCredentialStatus(projectData.ref)
          expect(enhancedResult.error).toBeUndefined()
          expect(enhancedResult.data).toBeDefined()

          if (enhancedResult.data) {
            expect(enhancedResult.data.credential_status).toBe('complete')
            expect(enhancedResult.data.uses_fallback_credentials).toBe(false)
          }
        }
      }
    })
  })

  describe('Enhanced Lookup Functions', () => {
    it('should return enhanced metadata for all projects', async () => {
      // Create multiple projects with different credential states
      const projects = [
        {
          ref: 'test-enhanced-1',
          name: 'Test Enhanced 1',
          database_name: 'test_enhanced_1_db',
          database_user: 'user1',
          database_password_hash: 'hash1',
          organization_id: 1,
          status: 'ACTIVE_HEALTHY' as const,
          region: 'localhost',
          connection_string: 'postgresql://user1:password@localhost:5432/test_enhanced_1_db'
        },
        {
          ref: 'test-enhanced-2',
          name: 'Test Enhanced 2',
          database_name: 'test_enhanced_2_db',
          database_user: null,
          database_password_hash: null,
          organization_id: 1,
          status: 'ACTIVE_HEALTHY' as const,
          region: 'localhost',
          connection_string: 'postgresql://fallback:fallback@localhost:5432/test_enhanced_2_db'
        }
      ]

      // Save all projects
      for (const project of projects) {
        const saveResult = await ProjectStore.save(project)
        expect(saveResult.error).toBeUndefined()
      }

      // Get all projects with enhanced metadata
      const allResult = await ProjectStore.findAllWithCredentialStatus()
      expect(allResult.error).toBeUndefined()
      expect(allResult.data).toBeDefined()

      if (allResult.data) {
        const enhancedProjects = allResult.data.filter(p => 
          p.ref === 'test-enhanced-1' || p.ref === 'test-enhanced-2'
        )

        expect(enhancedProjects).toHaveLength(2)

        const project1 = enhancedProjects.find(p => p.ref === 'test-enhanced-1')
        const project2 = enhancedProjects.find(p => p.ref === 'test-enhanced-2')

        expect(project1?.credential_status).toBe('complete')
        expect(project1?.uses_fallback_credentials).toBe(false)

        expect(project2?.credential_status).toBe('missing_both')
        expect(project2?.uses_fallback_credentials).toBe(true)
      }
    })
  })
})