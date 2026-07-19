import { useState, useEffect } from 'react'

interface UseApiOptions {
  immediate?: boolean
}

export function useApi<T>(
  fetchFn: () => Promise<{ data: T }>,
  options: UseApiOptions = { immediate: true }
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(options.immediate ?? true)
  const [error, setError] = useState<string | null>(null)

  const refetch = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchFn()
      setData(response.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (options.immediate !== false) {
      refetch()
    }
  }, [])

  return { data, loading, error, refetch }
}

export function useOrgId() {
  // For demo, hardcode the org ID. In production, get from auth context
  const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000001'
  return DEMO_ORG_ID
}
