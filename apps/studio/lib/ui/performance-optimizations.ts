/**
 * UI performance optimizations
 * 
 * This module provides:
 * - Lazy loading utilities for components and data
 * - Debouncing and throttling for user interactions
 * - Virtual scrolling for large lists
 * - Memoization and caching for expensive computations
 * 
 * Requirements: Security and performance considerations
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { debounce, throttle } from 'lodash'

/**
 * Debounced input hook for search and form inputs
 * 
 * @param value - Input value to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns Debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Debounced callback hook for expensive operations
 * 
 * @param callback - Function to debounce
 * @param delay - Debounce delay in milliseconds
 * @param deps - Dependencies array
 * @returns Debounced callback function
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  const debouncedCallback = useMemo(
    () => debounce(callback, delay),
    [callback, delay, ...deps]
  )

  useEffect(() => {
    return () => {
      debouncedCallback.cancel()
    }
  }, [debouncedCallback])

  return debouncedCallback as T
}

/**
 * Throttled callback hook for high-frequency events
 * 
 * @param callback - Function to throttle
 * @param delay - Throttle delay in milliseconds
 * @param deps - Dependencies array
 * @returns Throttled callback function
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  const throttledCallback = useMemo(
    () => throttle(callback, delay),
    [callback, delay, ...deps]
  )

  useEffect(() => {
    return () => {
      throttledCallback.cancel()
    }
  }, [throttledCallback])

  return throttledCallback as T
}

/**
 * Lazy loading hook for components
 * 
 * @param importFn - Dynamic import function
 * @returns Component loading state and loaded component
 */
export function useLazyComponent<T>(
  importFn: () => Promise<{ default: T }>
): {
  Component: T | null
  loading: boolean
  error: Error | null
} {
  const [state, setState] = useState<{
    Component: T | null
    loading: boolean
    error: Error | null
  }>({
    Component: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    let cancelled = false

    importFn()
      .then((module) => {
        if (!cancelled) {
          setState({
            Component: module.default,
            loading: false,
            error: null
          })
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            Component: null,
            loading: false,
            error
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [importFn])

  return state
}

/**
 * Intersection observer hook for lazy loading
 * 
 * @param options - Intersection observer options
 * @returns Ref and intersection state
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLElement>, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
      },
      {
        threshold: 0.1,
        ...options
      }
    )

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [options])

  return [ref, isIntersecting]
}

/**
 * Virtual scrolling hook for large lists
 * 
 * @param items - Array of items to virtualize
 * @param itemHeight - Height of each item in pixels
 * @param containerHeight - Height of the container in pixels
 * @returns Virtual scrolling state and handlers
 */
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
): {
  visibleItems: Array<{ item: T; index: number }>
  scrollTop: number
  totalHeight: number
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void
  containerRef: React.RefObject<HTMLDivElement>
} {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 // Buffer items
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 1)
  const endIndex = Math.min(items.length, startIndex + visibleCount)

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index
    }))
  }, [items, startIndex, endIndex])

  const totalHeight = items.length * itemHeight

  const onScroll = useThrottledCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop)
    },
    16 // ~60fps
  )

  return {
    visibleItems,
    scrollTop,
    totalHeight,
    onScroll,
    containerRef
  }
}

/**
 * Memoized computation hook
 * 
 * @param computeFn - Expensive computation function
 * @param deps - Dependencies array
 * @returns Memoized result
 */
export function useMemoizedComputation<T>(
  computeFn: () => T,
  deps: React.DependencyList
): T {
  return useMemo(computeFn, deps)
}

/**
 * Async data loading hook with caching
 * 
 * @param fetchFn - Async function to fetch data
 * @param cacheKey - Unique cache key
 * @param deps - Dependencies array
 * @returns Data loading state
 */
export function useCachedAsyncData<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
  deps: React.DependencyList = []
): {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [state, setState] = useState<{
    data: T | null
    loading: boolean
    error: Error | null
  }>({
    data: null,
    loading: true,
    error: null
  })

  const cache = useRef(new Map<string, T>())

  const fetchData = useCallback(async () => {
    // Check cache first
    if (cache.current.has(cacheKey)) {
      setState({
        data: cache.current.get(cacheKey)!,
        loading: false,
        error: null
      })
      return
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await fetchFn()
      cache.current.set(cacheKey, result)
      setState({
        data: result,
        loading: false,
        error: null
      })
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error as Error
      })
    }
  }, [fetchFn, cacheKey])

  useEffect(() => {
    fetchData()
  }, [fetchData, ...deps])

  const refetch = useCallback(() => {
    cache.current.delete(cacheKey)
    fetchData()
  }, [cacheKey, fetchData])

  return {
    ...state,
    refetch
  }
}

/**
 * Image lazy loading hook
 * 
 * @param src - Image source URL
 * @param placeholder - Placeholder image URL
 * @returns Image loading state and props
 */
export function useLazyImage(
  src: string,
  placeholder?: string
): {
  imageSrc: string
  loading: boolean
  error: boolean
  imageProps: {
    src: string
    onLoad: () => void
    onError: () => void
  }
} {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [loadedSrc, setLoadedSrc] = useState(placeholder || '')

  useEffect(() => {
    setLoading(true)
    setError(false)

    const img = new Image()
    img.onload = () => {
      setLoadedSrc(src)
      setLoading(false)
    }
    img.onerror = () => {
      setError(true)
      setLoading(false)
    }
    img.src = src
  }, [src])

  const imageProps = {
    src: loadedSrc,
    onLoad: () => setLoading(false),
    onError: () => setError(true)
  }

  return {
    imageSrc: loadedSrc,
    loading,
    error,
    imageProps
  }
}

/**
 * Performance monitoring hook
 * 
 * @param name - Performance mark name
 * @returns Performance measurement utilities
 */
export function usePerformanceMonitoring(name: string): {
  startMeasurement: () => void
  endMeasurement: () => number | null
  measurements: number[]
} {
  const [measurements, setMeasurements] = useState<number[]>([])
  const startTimeRef = useRef<number | null>(null)

  const startMeasurement = useCallback(() => {
    startTimeRef.current = performance.now()
    performance.mark(`${name}-start`)
  }, [name])

  const endMeasurement = useCallback(() => {
    if (startTimeRef.current === null) return null

    const endTime = performance.now()
    const duration = endTime - startTimeRef.current
    
    performance.mark(`${name}-end`)
    performance.measure(name, `${name}-start`, `${name}-end`)
    
    setMeasurements(prev => [...prev.slice(-9), duration]) // Keep last 10 measurements
    
    startTimeRef.current = null
    return duration
  }, [name])

  return {
    startMeasurement,
    endMeasurement,
    measurements
  }
}

/**
 * Batch updates hook for reducing re-renders
 * 
 * @param initialState - Initial state value
 * @returns State and batched update function
 */
export function useBatchedUpdates<T>(
  initialState: T
): [T, (updates: Partial<T>) => void] {
  const [state, setState] = useState<T>(initialState)
  const pendingUpdatesRef = useRef<Partial<T>>({})
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const batchUpdate = useCallback((updates: Partial<T>) => {
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, ...pendingUpdatesRef.current }))
      pendingUpdatesRef.current = {}
      timeoutRef.current = null
    }, 0)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return [state, batchUpdate]
}

/**
 * Component size observer hook
 * 
 * @returns Ref and size information
 */
export function useResizeObserver(): [
  React.RefObject<HTMLElement>,
  { width: number; height: number }
] {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setSize({ width, height })
      }
    })

    resizeObserver.observe(element)

    return () => {
      resizeObserver.unobserve(element)
    }
  }, [])

  return [ref, size]
}

/**
 * Optimized search hook with debouncing and caching
 * 
 * @param searchFn - Search function
 * @param debounceMs - Debounce delay in milliseconds
 * @returns Search state and handlers
 */
export function useOptimizedSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  debounceMs = 300
): {
  query: string
  results: T[]
  loading: boolean
  error: Error | null
  setQuery: (query: string) => void
  clearResults: () => void
} {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const debouncedQuery = useDebouncedValue(query, debounceMs)
  const cache = useRef(new Map<string, T[]>())

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    // Check cache first
    if (cache.current.has(debouncedQuery)) {
      setResults(cache.current.get(debouncedQuery)!)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    searchFn(debouncedQuery)
      .then(searchResults => {
        cache.current.set(debouncedQuery, searchResults)
        setResults(searchResults)
        setLoading(false)
      })
      .catch(err => {
        setError(err)
        setLoading(false)
      })
  }, [debouncedQuery, searchFn])

  const clearResults = useCallback(() => {
    setQuery('')
    setResults([])
    setError(null)
    cache.current.clear()
  }, [])

  return {
    query,
    results,
    loading,
    error,
    setQuery,
    clearResults
  }
}