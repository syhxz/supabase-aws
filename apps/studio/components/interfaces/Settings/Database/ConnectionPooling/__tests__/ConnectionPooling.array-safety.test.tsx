/**
 * Test file specifically for array safety in ConnectionPooling component
 * Tests the fixes for "TypeError: n.find is not a function" error
 */

import { safeFind, ensureArray } from 'lib/array-validation'

describe('ConnectionPooling Array Safety', () => {
  describe('safe array operations', () => {
    it('should handle null values safely with safeFind', () => {
      const result = safeFind(null, (item: any) => item.type === 'ipv4')
      expect(result).toBeUndefined()
    })

    it('should handle undefined values safely with safeFind', () => {
      const result = safeFind(undefined, (item: any) => item.type === 'ipv4')
      expect(result).toBeUndefined()
    })

    it('should handle non-array values safely with safeFind', () => {
      const result = safeFind('not-an-array', (item: any) => item.type === 'ipv4')
      expect(result).toBeUndefined()
    })

    it('should handle object values safely with safeFind', () => {
      const result = safeFind({ type: 'ipv4' }, (item: any) => item.type === 'ipv4')
      expect(result).toBeUndefined()
    })

    it('should work correctly with valid arrays', () => {
      const addons = [
        { type: 'ipv4' },
        { type: 'compute_instance', variant: { name: 'Small' } }
      ]
      const result = safeFind(addons, (item: any) => item.type === 'ipv4')
      expect(result).toEqual({ type: 'ipv4' })
    })

    it('should handle null values safely with ensureArray', () => {
      const result = ensureArray(null)
      expect(result).toEqual([])
    })

    it('should handle undefined values safely with ensureArray', () => {
      const result = ensureArray(undefined)
      expect(result).toEqual([])
    })

    it('should handle non-array values safely with ensureArray', () => {
      const result = ensureArray('not-an-array')
      expect(result).toEqual([])
    })

    it('should handle object values safely with ensureArray', () => {
      const result = ensureArray({ type: 'ipv4' })
      expect(result).toEqual([])
    })

    it('should return the array unchanged when given a valid array', () => {
      const addons = [{ type: 'ipv4' }]
      const result = ensureArray(addons)
      expect(result).toBe(addons)
    })
  })

  describe('addon data processing simulation', () => {
    // Simulate the logic used in ConnectionPooling component
    const processAddonsData = (addons: any) => {
      const selectedAddons = ensureArray(addons?.selected_addons)
      const hasIpv4Addon = !!safeFind(selectedAddons, (addon: any) => addon?.type === 'ipv4')
      const computeInstance = safeFind(selectedAddons, (addon: any) => addon?.type === 'compute_instance')
      
      return {
        selectedAddons,
        hasIpv4Addon,
        computeInstance,
        computeSize: computeInstance?.variant?.name ?? 'Nano'
      }
    }

    it('should handle null addons data', () => {
      const result = processAddonsData({ selected_addons: null })
      expect(result.selectedAddons).toEqual([])
      expect(result.hasIpv4Addon).toBe(false)
      expect(result.computeInstance).toBeUndefined()
      expect(result.computeSize).toBe('Nano')
    })

    it('should handle undefined addons data', () => {
      const result = processAddonsData({ selected_addons: undefined })
      expect(result.selectedAddons).toEqual([])
      expect(result.hasIpv4Addon).toBe(false)
      expect(result.computeInstance).toBeUndefined()
      expect(result.computeSize).toBe('Nano')
    })

    it('should handle non-array addons data', () => {
      const result = processAddonsData({ selected_addons: 'not-an-array' })
      expect(result.selectedAddons).toEqual([])
      expect(result.hasIpv4Addon).toBe(false)
      expect(result.computeInstance).toBeUndefined()
      expect(result.computeSize).toBe('Nano')
    })

    it('should handle object addons data', () => {
      const result = processAddonsData({ selected_addons: { type: 'ipv4' } })
      expect(result.selectedAddons).toEqual([])
      expect(result.hasIpv4Addon).toBe(false)
      expect(result.computeInstance).toBeUndefined()
      expect(result.computeSize).toBe('Nano')
    })

    it('should handle valid addons data correctly', () => {
      const addonsData = {
        selected_addons: [
          { type: 'ipv4' },
          { 
            type: 'compute_instance',
            variant: {
              name: 'Small',
              identifier: 'ci_small'
            }
          }
        ]
      }
      
      const result = processAddonsData(addonsData)
      expect(result.selectedAddons).toHaveLength(2)
      expect(result.hasIpv4Addon).toBe(true)
      expect(result.computeInstance).toEqual({
        type: 'compute_instance',
        variant: {
          name: 'Small',
          identifier: 'ci_small'
        }
      })
      expect(result.computeSize).toBe('Small')
    })

    it('should handle malformed addon objects', () => {
      const addonsData = {
        selected_addons: [
          null,
          undefined,
          { type: null },
          { variant: null },
          { 
            type: 'compute_instance',
            variant: {} // Empty variant object
          }
        ]
      }
      
      const result = processAddonsData(addonsData)
      expect(result.selectedAddons).toHaveLength(5)
      expect(result.hasIpv4Addon).toBe(false)
      expect(result.computeInstance?.type).toBe('compute_instance')
      expect(result.computeSize).toBe('Nano') // Falls back to default since variant.name is undefined
    })
  })
})