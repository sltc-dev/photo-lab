import { fetchWithAuth, getResponseError, resolveApiUrl } from './http';

export type QuickTransferSession = {
  expiresAt: string;
  id: string;
  mobilePath: string;
  token: string;
};

export type QuickTransferStatus = {
  expiresAt: string;
  id: string;
  lastUploadedPhotoId: string | null;
  uploadedCount: number;
};

export async function createQuickTransferSession(projectId: string): Promise<QuickTransferSession> {
  const response = await fetchWithAuth(
    resolveApiUrl(`/quick-transfer/projects/${encodeURIComponent(projectId)}/sessions`),
    {
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw await getResponseError(response);
  }

  return (await response.json()) as QuickTransferSession;
}

export async function getQuickTransferStatus(sessionId: string): Promise<QuickTransferStatus> {
  const response = await fetchWithAuth(
    resolveApiUrl(`/quick-transfer/sessions/${encodeURIComponent(sessionId)}/status`),
  );

  if (!response.ok) {
    throw await getResponseError(response);
  }

  return (await response.json()) as QuickTransferStatus;
}

export function buildQuickTransferMobileUrl(session: QuickTransferSession): string {
  return resolveApiUrl(session.mobilePath);
}
