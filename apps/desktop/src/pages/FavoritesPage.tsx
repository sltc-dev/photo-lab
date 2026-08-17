import { Box, Group, Stack, Tabs, Text, Title } from '@mantine/core';
import { Star } from 'lucide-react';
import { useState } from 'react';
import { MaterialPhotoGrid } from '../components/materials/MaterialPhotoGrid';
import styles from '../styles/pages/ProjectPhotosPage.module.css';

export function FavoritesPage() {
  const [activePhotoTab, setActivePhotoTab] = useState<'edited' | 'original'>('original');

  return (
    <Stack className={styles.page} gap="lg">
      <Box className={styles.pageHeader}>
        <Group align="center" gap="sm">
          <Star aria-hidden color="var(--pl-accent)" size={24} />
          <Box>
            <Title className={styles.title} order={2}>
              我的收藏
            </Title>
            <Text c="dimmed" mt={5} size="sm">
              集中查看你从素材库收藏的照片。
            </Text>
          </Box>
        </Group>
      </Box>

      <section aria-label="收藏照片" className={styles.gallerySection}>
        <Tabs
          classNames={{ list: styles.photoTabList, tab: styles.photoTab }}
          keepMounted={false}
          onChange={(value) => setActivePhotoTab(value === 'edited' ? 'edited' : 'original')}
          value={activePhotoTab}
        >
          <Group align="flex-end" className={styles.galleryHeader} justify="space-between">
            <Tabs.List aria-label="收藏照片类型">
              <Tabs.Tab value="original">原图</Tabs.Tab>
              <Tabs.Tab value="edited">效果图</Tabs.Tab>
            </Tabs.List>
            <Text c="dimmed" size="sm">
              按上传时间从新到旧排列
            </Text>
          </Group>
          <Tabs.Panel value="original">
            <MaterialPhotoGrid favoritesOnly kind="ORIGINAL" />
          </Tabs.Panel>
          <Tabs.Panel value="edited">
            <MaterialPhotoGrid favoritesOnly kind="EDITED" />
          </Tabs.Panel>
        </Tabs>
      </section>
    </Stack>
  );
}
