import { z } from 'zod';

export const loginSchema = z.object({
  // 这层负责表单即时反馈；Electron IPC 和 Nest DTO 还会再次校验。
  email: z.string().trim().email('请输入有效邮箱'),
  password: z.string().min(8, '密码至少 8 位').max(128, '密码最多 128 位'),
});

export const registerSchema = z.object({
  email: z.string().trim().email('请输入有效邮箱'),
  password: z.string().min(8, '密码至少 8 位').max(128, '密码最多 128 位'),
  username: z.string().trim().min(2, '用户名至少 2 位').max(32, '用户名最多 32 位'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
