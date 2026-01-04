/**
 * Regression Tests for Existing Project Settings Preservation
 * 
 * Tests that existing project settings functionality remains unaffected
 * by the API Keys and JWT Keys integration.
 * 
 * Requirements: 4.5
 * 
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSettingsMenu } from 'components/layouts/ProjectSettingsLayout/SettingsMenu.utils'

const mockProject = {
  id: 1,
  ref: 'test-project',
  name: 'Test Project',
  status: 'ACTIVE_HEALTHY',
  parent_project_ref: null
}

const mockOrganization = {
  id: 1,
  slug: 'test-org',
  name: 'Test Organization'
}

describe('Existing Project Settings Preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Settings Menu Generation', () => {
    /**
     * Test: Menu structure maintains backward compatibility
     * 
     * Verifies that the menu structure changes don't break existing
     * navigation or component expectations.
     * 
     * Requirements: 4.5
     */
    it('should maintain menu structure backward compatibility', () => {
      const menu = generateSettingsMenu('test-project', mockProject, mockOrganization)

      // Verify menu structure format is preserved
      expect(Array.isArray(menu)).toBe(true)
      expect(menu.length).toBeGreaterThan(0)
      
      menu.forEach(group => {
        expect(group).toHaveProperty('title')
        expect(group).toHaveProperty('items')
        expect(Array.isArray(group.items)).toBe(true)
        
        group.items.forEach(item => {
          expect(item).toHaveProperty('name')
          expect(item).toHaveProperty('key')
          expect(item).toHaveProperty('url')
          expect(item).toHaveProperty('items')
          expect(Array.isArray(item.items)).toBe(true)
        })
      })
    })

    /**
     * Test: Essential settings are always present
     * 
     * Verifies that essential settings including the newly added API Keys 
     * and JWT Keys are present in the menu.
     * 
     * Requirements: 4.5
     */
    it('should maintain essential settings availability', () => {
      const menu = generateSettingsMenu('test-project', mockProject, mockOrganization, {
        legacyJwtKeys: true,
        logDrains: true
      })

      // Verify Project Settings group exists
      const projectSettingsGroup = menu.find(group => group.title === 'Project Settings')
      expect(projectSettingsGroup).toBeDefined()
      
      // Verify essential items are present (these should be available in both modes)
      const essentialItems = ['API Keys', 'JWT Keys', 'Log Drains']
      essentialItems.forEach(itemName => {
        const item = projectSettingsGroup?.items.find(item => item.name === itemName)
        expect(item, `${itemName} should be present in settings menu`).toBeDefined()
      })
    })

    /**
     * Test: URL patterns follow expected format
     * 
     * Verifies that all menu items have properly formatted URLs
     * that follow the expected pattern.
     * 
     * Requirements: 4.5
     */
    it('should maintain consistent URL patterns', () => {
      const menu = generateSettingsMenu('test-project', mockProject, mockOrganization)

      const projectSettingsGroup = menu.find(group => group.title === 'Project Settings')
      expect(projectSettingsGroup).toBeDefined()
      
      // Verify URL patterns are consistent
      projectSettingsGroup?.items.forEach(item => {
        expect(item.url).toMatch(/^\/project\/test-project\/settings\//)
        expect(item.url).not.toBe('')
        expect(item.url).not.toBeNull()
        expect(item.url).not.toBeUndefined()
      })
    })

    /**
     * Test: Feature flag handling remains consistent
     * 
     * Verifies that feature flag logic continues to work correctly
     * and doesn't break with the new menu items.
     * 
     * Requirements: 4.5
     */
    it('should maintain consistent feature flag handling', () => {
      // Test with various feature flag combinations
      const testCases = [
        {
          features: { legacyJwtKeys: false },
          description: 'with legacy JWT keys disabled'
        },
        {
          features: { logDrains: false },
          description: 'with log drains disabled'
        },
        {
          features: { legacyJwtKeys: true, logDrains: true },
          description: 'with all features enabled'
        }
      ]

      testCases.forEach(({ features, description }) => {
        const menu = generateSettingsMenu('test-project', mockProject, mockOrganization, features)
        
        // Menu should always be an array and have at least Project Settings
        expect(Array.isArray(menu)).toBe(true)
        expect(menu.length).toBeGreaterThan(0)
        
        const projectSettingsGroup = menu.find(group => group.title === 'Project Settings')
        expect(projectSettingsGroup, `Project Settings group should exist ${description}`).toBeDefined()
        
        // API Keys should always be present regardless of feature flags
        const apiKeysItem = projectSettingsGroup?.items.find(item => item.name === 'API Keys')
        expect(apiKeysItem, `API Keys should be present ${description}`).toBeDefined()
      })
    })
  })

  describe('Integration Points', () => {
    /**
     * Test: Menu item keys remain consistent
     * 
     * Verifies that menu item keys follow expected patterns
     * and are consistent for integration purposes.
     * 
     * Requirements: 4.5
     */
    it('should maintain consistent menu item keys', () => {
      const menu = generateSettingsMenu('test-project', mockProject, mockOrganization, {
        legacyJwtKeys: true,
        logDrains: true
      })

      const projectSettingsGroup = menu.find(group => group.title === 'Project Settings')
      expect(projectSettingsGroup).toBeDefined()
      
      // Verify key patterns are consistent
      const expectedKeyPatterns = [
        { name: 'API Keys', key: 'api-keys' },
        { name: 'JWT Keys', key: 'jwt' },
        { name: 'Log Drains', key: 'log-drains' }
      ]

      expectedKeyPatterns.forEach(({ name, key }) => {
        const item = projectSettingsGroup?.items.find(item => item.name === name)
        expect(item, `Menu item '${name}' should exist`).toBeDefined()
        expect(item?.key, `Menu item '${name}' should have correct key`).toBe(key)
      })
    })

    /**
     * Test: Menu items have proper navigation URLs
     * 
     * Verifies that all menu items have valid navigation URLs
     * that point to the correct settings pages.
     * 
     * Requirements: 4.5
     */
    it('should provide valid navigation URLs for all menu items', () => {
      const menu = generateSettingsMenu('test-project', mockProject, mockOrganization, {
        legacyJwtKeys: true,
        logDrains: true
      })

      // Collect all URLs from the menu
      const allUrls = menu.flatMap(group => 
        group.items.map(item => item.url)
      )

      // Verify that essential URLs are present and valid
      const expectedUrlPatterns = [
        '/project/test-project/settings/api-keys/new',
        '/project/test-project/settings/jwt',
        '/project/test-project/settings/log-drains'
      ]

      expectedUrlPatterns.forEach(expectedUrl => {
        expect(allUrls, `URL ${expectedUrl} should be accessible`).toContain(expectedUrl)
      })

      // Verify all URLs are properly formatted
      allUrls.forEach(url => {
        expect(url).toMatch(/^\/project\/test-project\//)
        expect(url).not.toBe('')
      })
    })
  })

  describe('Functional Preservation', () => {
    /**
     * Test: Menu generation doesn't throw errors
     * 
     * Verifies that the menu generation function continues to work
     * without throwing errors under various conditions.
     * 
     * Requirements: 4.5
     */
    it('should generate menu without errors under various conditions', () => {
      // Test with minimal parameters
      expect(() => {
        generateSettingsMenu('test-project')
      }).not.toThrow()

      // Test with project but no organization
      expect(() => {
        generateSettingsMenu('test-project', mockProject)
      }).not.toThrow()

      // Test with all parameters
      expect(() => {
        generateSettingsMenu('test-project', mockProject, mockOrganization)
      }).not.toThrow()

      // Test with features
      expect(() => {
        generateSettingsMenu('test-project', mockProject, mockOrganization, {
          legacyJwtKeys: true,
          logDrains: true
        })
      }).not.toThrow()
    })

    /**
     * Test: Menu items maintain expected properties
     * 
     * Verifies that all menu items have the required properties
     * and maintain the expected structure.
     * 
     * Requirements: 4.5
     */
    it('should maintain expected menu item properties', () => {
      const menu = generateSettingsMenu('test-project', mockProject, mockOrganization)

      menu.forEach(group => {
        group.items.forEach(item => {
          // Verify required properties exist
          expect(item.name).toBeDefined()
          expect(item.key).toBeDefined()
          expect(item.url).toBeDefined()
          expect(item.items).toBeDefined()

          // Verify property types
          expect(typeof item.name).toBe('string')
          expect(typeof item.key).toBe('string')
          expect(typeof item.url).toBe('string')
          expect(Array.isArray(item.items)).toBe(true)

          // Verify values are not empty
          expect(item.name.length).toBeGreaterThan(0)
          expect(item.key.length).toBeGreaterThan(0)
          expect(item.url.length).toBeGreaterThan(0)
        })
      })
    })

    /**
     * Test: JWT Keys URL handling with feature flags
     * 
     * Verifies that JWT Keys URL changes correctly based on
     * the legacyJwtKeys feature flag.
     * 
     * Requirements: 4.5
     */
    it('should handle JWT Keys URL correctly with feature flags', () => {
      // Test with legacy JWT keys enabled
      const menuWithLegacy = generateSettingsMenu('test-project', mockProject, mockOrganization, {
        legacyJwtKeys: true
      })

      const jwtItemWithLegacy = menuWithLegacy
        .find(group => group.title === 'Project Settings')
        ?.items.find(item => item.name === 'JWT Keys')

      expect(jwtItemWithLegacy?.url).toBe('/project/test-project/settings/jwt')

      // Test with legacy JWT keys disabled
      const menuWithoutLegacy = generateSettingsMenu('test-project', mockProject, mockOrganization, {
        legacyJwtKeys: false
      })

      const jwtItemWithoutLegacy = menuWithoutLegacy
        .find(group => group.title === 'Project Settings')
        ?.items.find(item => item.name === 'JWT Keys')

      expect(jwtItemWithoutLegacy?.url).toBe('/project/test-project/settings/jwt/signing-keys')
    })
  })
})