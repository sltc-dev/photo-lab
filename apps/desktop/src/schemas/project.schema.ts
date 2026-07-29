import { z } from 'zod';

export const projectSchema = z.object({
  description: z.string().trim().max(500, '项目描述不能超过 500 个字符'),
  name: z.string().trim().min(1, '请输入项目名称').max(100, '项目名称不能超过 100 个字符'),
});

export type ProjectFormValues = z.input<typeof projectSchema>;
