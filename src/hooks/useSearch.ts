import { useState, useCallback } from 'react'
import { search, type SearchResult } from '@/engine/data/searchIndex'

export function useSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])

  const handleQuery = useCallback((q: string) => {
    setQuery(q)
    setResults(q.trim() ? search(q) : [])
  }, [])

  const clear = useCallback(() => {
    setQuery('')
    setResults([])
  }, [])

  return { query, results, handleQuery, clear }
}
