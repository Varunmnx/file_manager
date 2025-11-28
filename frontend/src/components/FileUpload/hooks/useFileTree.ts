import { useState, useCallback } from 'react';

export function useFileTree() {
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  const toggleFolder = useCallback((index: number) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const isExpanded = useCallback((index: number) => {
    return expandedFolders.has(index);
  }, [expandedFolders]);

  return {
    toggleFolder,
    isExpanded,
  };
}