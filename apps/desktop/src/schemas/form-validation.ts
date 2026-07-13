import { z } from 'zod';

export function validateWithZod<TValues extends Record<string, unknown>>(
  schema: z.ZodType<TValues>,
) {
  // 把 Zod 的字段路径转换成 Mantine Form 能直接显示的错误对象。
  return (values: TValues): Partial<Record<keyof TValues, string>> => {
    const result = schema.safeParse(values);

    if (result.success) {
      return {};
    }

    return result.error.issues.reduce<Partial<Record<keyof TValues, string>>>((errors, issue) => {
      const [field] = issue.path;

      if (typeof field === 'string' && !(field in errors)) {
        errors[field as keyof TValues] = issue.message;
      }

      return errors;
    }, {});
  };
}
