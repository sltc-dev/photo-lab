import { Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { LogIn, LockKeyhole, Mail } from 'lucide-react';
import { loginSchema, type LoginFormValues } from '../../schemas/auth.schema';
import { validateWithZod } from '../../schemas/form-validation';
import styles from '../../styles/components/auth/AuthForm.module.css';

type LoginFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: LoginFormValues) => void;
};

export function LoginForm({ isSubmitting = false, onSubmit }: LoginFormProps) {
  // 前端校验用于即时提示；后端 LoginDto 仍会独立执行最终校验。
  const form = useForm<LoginFormValues>({
    initialValues: {
      email: '',
      password: '',
    },
    transformValues: (values) => loginSchema.parse(values),
    validate: validateWithZod(loginSchema),
  });

  return (
    <form className={styles.form} onSubmit={form.onSubmit(onSubmit)}>
      <Stack className={styles.stack}>
        <TextInput
          autoComplete="email"
          className={styles.input}
          label="邮箱"
          leftSection={<Mail aria-hidden size={16} />}
          placeholder="name@example.com"
          radius="sm"
          size="md"
          type="email"
          {...form.getInputProps('email')}
        />
        <PasswordInput
          autoComplete="current-password"
          className={styles.input}
          label="密码"
          leftSection={<LockKeyhole aria-hidden size={16} />}
          radius="sm"
          size="md"
          {...form.getInputProps('password')}
        />
        <Button
          className={styles.submit}
          fullWidth
          leftSection={<LogIn size={18} />}
          loading={isSubmitting}
          radius="sm"
          type="submit"
        >
          登录
        </Button>
      </Stack>
    </form>
  );
}
