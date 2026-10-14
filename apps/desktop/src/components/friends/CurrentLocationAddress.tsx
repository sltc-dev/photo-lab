import { ActionIcon, Badge, Group, Stack, Text, Tooltip } from '@mantine/core';
import { MapPin } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { readLocationAddress, type LocationSample } from '../../api/location-address';

type Props = {
  location: LocationSample & { accuracyMeters: number };
  userId: string;
  uploaded: boolean;
};

export function CurrentLocationAddress({ location, userId, uploaded }: Props) {
  const address = useQuery({
    queryKey: ['locations', 'address', userId, location.latitude, location.longitude],
    queryFn: ({ signal }) => readLocationAddress(location, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return (
    <Stack gap={4} role="status" aria-live="polite">
      <Group gap="xs" align="center">
        <Text fw={500} style={{ overflowWrap: 'anywhere' }}>
          {address.isPending ? '正在解析位置…' : (address.data?.label ?? '暂时无法解析')}
        </Text>
        <Badge color={uploaded ? 'teal' : 'orange'} variant="light">
          {uploaded ? '已同步' : '待同步'}
        </Badge>
        <Tooltip
          events={{ hover: true, focus: true, touch: false }}
          label={
            <Stack gap={2}>
              <Text size="xs">经度：{location.longitude.toFixed(6)}</Text>
              <Text size="xs">纬度：{location.latitude.toFixed(6)}</Text>
              <Text size="xs">定位精度：约 {Math.ceil(location.accuracyMeters)} 米</Text>
              <Text size="xs">
                更新于 {new Date(location.capturedAt).toLocaleTimeString('zh-CN')}
              </Text>
            </Stack>
          }
          withArrow
        >
          <ActionIcon
            aria-label="查看经纬度、定位精度和更新时间"
            variant="subtle"
            color="gray"
            size="sm"
          >
            <MapPin aria-hidden size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {address.isError ? (
        <Text size="sm" c="dimmed">
          位置名称解析失败，经纬度仍可使用。
        </Text>
      ) : null}
    </Stack>
  );
}
