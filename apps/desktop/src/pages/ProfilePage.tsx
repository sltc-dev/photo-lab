import { Avatar, Box, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { CalendarDays, CheckCircle2, Mail, ShieldCheck, User } from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import styles from '../styles/pages/ProfilePage.module.css';

export function ProfilePage() {
  const currentUser = useAuthStore((state) => state.currentUser);

  if (!currentUser) {
    return null;
  }

  return (
    <Stack className={styles.page} gap="lg">
      <Box className={styles.pageHeading}>
        <Text className={styles.eyebrow}>账户</Text>
        <Title className={styles.pageTitle} order={2}>
          个人资料
        </Title>
        <Text c="dimmed" mt={6}>
          查看当前登录账户与会话信息。
        </Text>
      </Box>

      <Card className={styles.profileCard} padding="xl">
        <Group align="center" gap="lg" wrap="wrap">
          <Avatar className={styles.profileAvatar} radius="xl" size={72}>
            {currentUser.username.slice(0, 1).toUpperCase()}
          </Avatar>
          <Box className={styles.identity}>
            <Title className={styles.username} order={3}>
              {currentUser.username}
            </Title>
            <Group className={styles.status} gap={6} mt={7}>
              <CheckCircle2 aria-hidden size={15} />
              <Text size="sm">当前已登录</Text>
            </Group>
          </Box>
        </Group>
      </Card>

      <section aria-labelledby="account-details-title">
        <Title className={styles.sectionTitle} id="account-details-title" order={3}>
          账户详情
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }} mt="md">
          <ProfileField icon={User} label="用户名" value={currentUser.username} />
          <ProfileField icon={Mail} label="邮箱" value={currentUser.email} />
          <ProfileField
            icon={CalendarDays}
            label="注册时间"
            value={formatAccountDate(currentUser.createdAt)}
          />
          <ProfileField icon={ShieldCheck} label="账户状态" value="正常" />
        </SimpleGrid>
      </section>

      <Box className={styles.securityNote}>
        <ShieldCheck aria-hidden size={20} />
        <Box>
          <Text fw={650} size="sm">
            登录凭据受保护
          </Text>
          <Text c="dimmed" mt={3} size="sm">
            刷新凭据仅保存在本机安全存储中，不会暴露给页面。
          </Text>
        </Box>
      </Box>
    </Stack>
  );
}

type ProfileFieldProps = {
  icon: typeof User;
  label: string;
  value: string;
};

function ProfileField({ icon: Icon, label, value }: ProfileFieldProps) {
  return (
    <Card className={styles.fieldCard} padding="lg">
      <Group align="flex-start" gap="md" wrap="nowrap">
        <Box className={styles.fieldIcon}>
          <Icon aria-hidden size={18} />
        </Box>
        <Box className={styles.fieldContent}>
          <Text className={styles.fieldLabel}>{label}</Text>
          <Text className={styles.fieldValue}>{value}</Text>
        </Box>
      </Group>
    </Card>
  );
}

const accountDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

function formatAccountDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未知日期' : accountDateFormatter.format(date);
}
