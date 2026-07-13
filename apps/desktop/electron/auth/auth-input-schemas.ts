import { z } from 'zod';
import type { DesktopLoginInput, DesktopRegisterInput } from '../ipc/auth.channels';

export const loginInputSchema = z.object({
  // IPC 输入来自低权限渲染进程，主进程不能只依赖 TypeScript 类型。
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
}) satisfies z.ZodType<DesktopLoginInput>;

export const registerInputSchema = loginInputSchema.extend({
  username: z.string().trim().min(2).max(32),
}) satisfies z.ZodType<DesktopRegisterInput>;
