import { Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { LockKeyhole, Mail, User, UserPlus } from 'lucide-react';
import { registerSchema, type RegisterFormValues } from '../../schemas/auth.schema';
import { validateWithZod } from '../../schemas/form-validation';
import styles from '../../styles/components/auth/AuthForm.module.css';

type RegisterFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: RegisterFormValues) => void;
};

export function RegisterForm({ isSubmitting = false, onSubmit }: RegisterFormProps) {
  // 与后端规则保持一致可以减少无效请求，但前端校验不能替代后端 DTO。
  const form = useForm<RegisterFormValues>({
    initialValues: {
      email: '',
      password: '',
      username: '',
    },
    transformValues: (values) => registerSchema.parse(values),
    validate: validateWithZod(registerSchema),
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
        <TextInput
          autoComplete="username"
          className={styles.input}
          label="用户名"
          leftSection={<User aria-hidden size={16} />}
          radius="sm"
          size="md"
          {...form.getInputProps('username')}
        />
        <PasswordInput
          autoComplete="new-password"
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
          leftSection={<UserPlus size={18} />}
          loading={isSubmitting}
          radius="sm"
          type="submit"
        >
          注册
        </Button>
      </Stack>
    </form>
  );
}
