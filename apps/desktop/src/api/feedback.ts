import { fetchWithAuth, getApiErrorMessage, resolveApiUrl } from './http';

export type FeedbackCategory = 'BUG' | 'FEATURE' | 'OTHER';

type FeedbackResponse = {
  category: FeedbackCategory;
  createdAt: string;
  referenceId: string;
};

export async function sendFeedback(input: {
  category: FeedbackCategory;
  message: string;
}): Promise<FeedbackResponse> {
  const response = await fetchWithAuth(resolveApiUrl('/feedback'), {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(await getApiErrorMessage(body));
  }

  return response.json() as Promise<FeedbackResponse>;
}
