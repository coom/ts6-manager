import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { musicLibraryApi } from '../api/music.api';

export function useSongs(configId: number | null) {
  return useQuery({
    queryKey: ['songs', configId],
    queryFn: () => musicLibraryApi.songs(configId!),
    enabled: !!configId,
  });
}

export function useUploadSong() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, formData }: { configId: number; formData: FormData }) =>
      musicLibraryApi.upload(configId, formData),
    onSuccess: (_, { configId }) => qc.invalidateQueries({ queryKey: ['songs', configId] }),
  });
}

export function useDeleteSong() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, songId }: { configId: number; songId: number }) =>
      musicLibraryApi.deleteSong(configId, songId),
    onSuccess: (_, { configId }) => qc.invalidateQueries({ queryKey: ['songs', configId] }),
  });
}

export function useYouTubeSearch() {
  return useMutation({
    mutationFn: ({ configId, query }: { configId: number; query: string }) =>
      musicLibraryApi.youtubeSearch(configId, query),
  });
}

export function useYouTubeDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, url }: { configId: number; url: string }) =>
      musicLibraryApi.youtubeDownload(configId, url),
    onSuccess: (_, { configId }) => qc.invalidateQueries({ queryKey: ['songs', configId] }),
  });
}

export function useYouTubeInfo() {
  return useMutation({
    mutationFn: ({ configId, url }: { configId: number; url: string }) =>
      musicLibraryApi.youtubeInfo(configId, url),
  });
}

export function useYouTubeDownloadBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, urls }: { configId: number; urls: string[] }) =>
      musicLibraryApi.youtubeDownloadBatch(configId, urls),
    onSuccess: (_, { configId }) => qc.invalidateQueries({ queryKey: ['songs', configId] }),
  });
}

export function useImportPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, url, musicBotId }: { configId: number; url: string; musicBotId?: number }) =>
      musicLibraryApi.importPlaylist(configId, url, musicBotId),
    onSuccess: (_, { configId }) => {
      qc.invalidateQueries({ queryKey: ['songs', configId] });
      qc.invalidateQueries({ queryKey: ['playlists'] });
    },
  });
}

export function useImportPlaylistStatus(configId: number | null, jobId: string | null) {
  return useQuery({
    queryKey: ['playlist-import', configId, jobId],
    queryFn: () => musicLibraryApi.importPlaylistStatus(configId!, jobId!),
    enabled: !!configId && !!jobId,
    // Poll while the job runs, then stop. Also stop on a query error (e.g. the
    // job expired from the backend's in-memory map and the endpoint 404s) —
    // v5 doesn't clear `data` when a refetch errors, so `data.status` alone
    // would stay 'running' forever and poll indefinitely.
    refetchInterval: (q) => (q.state.status !== 'error' && q.state.data?.status === 'running' ? 2000 : false),
  });
}
