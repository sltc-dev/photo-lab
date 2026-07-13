import type { ReactNode } from 'react';
import { Box, Divider, Stack, Text, Title } from '@mantine/core';
import { Aperture } from 'lucide-react';
import styles from '../../styles/components/auth/AuthShell.module.css';

type AuthShellProps = {
  children: ReactNode;
  subtitle: string;
  title: string;
};

export function AuthShell({ children, subtitle, title }: AuthShellProps) {
  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <aside className={styles.contextPane}>
          <div className={styles.brandRow}>
            <div className={styles.brandMark}>
              <Aperture aria-hidden size={22} strokeWidth={2.2} />
            </div>
            <Box>
              <Text className={styles.brandName}>Photo Lab</Text>
              <Text className={styles.brandMeta}>Internal workspace</Text>
            </Box>
          </div>

          <div className={styles.contextCopy}>
            <Text className={styles.kicker}>Photo Lab</Text>
            <Title className={styles.contextTitle} order={2}>
              内部图片工作台
            </Title>
            <Text className={styles.contextText}>
              用于团队登录和图库项目管理。先保持入口清晰，后续能力逐步接进来。
            </Text>
          </div>

          <Text className={styles.contextFoot}>Desktop app · Internal</Text>
        </aside>

        <section className={styles.formPane}>
          <Stack gap="lg">
            <Box>
              <Text className={styles.formEyebrow}>{subtitle}</Text>
              <Title className={styles.title} order={1}>
                {title}
              </Title>
            </Box>
            <Divider color="var(--pl-line)" />
            {children}
          </Stack>
        </section>
      </section>
    </main>
  );
}
