import type { Request } from 'express';

export type RequestUser = {
  id: string;
};

export type AuthenticatedRequest = Request & {
  requestId?: string;
  user?: RequestUser;
};
