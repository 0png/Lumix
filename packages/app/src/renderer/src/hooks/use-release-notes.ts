import { useCallback, useState } from 'react';
import type { ReleaseNotesResult } from '../../../shared/ipc-types';

interface ReleaseNotesState {
  data: ReleaseNotesResult | null;
  loading: boolean;
  error: string | null;
}

export function useReleaseNotes() {
  const [state, setState] = useState<ReleaseNotesState>({
    data: null,
    loading: false,
    error: null,
  });

  const loadReleaseNotes = useCallback(async (): Promise<ReleaseNotesResult | null> => {
    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const result = await window.electronAPI.update.getReleaseNotes();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to load release notes');
      }

      setState({ data: result.data, loading: false, error: null });
      return result.data;
    } catch (error) {
      setState((previous) => ({
        ...previous,
        loading: false,
        error: (error as Error).message,
      }));
      return null;
    }
  }, []);

  return { ...state, loadReleaseNotes };
}
