import { Button, Group, Modal, Select, Stack, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { Mail } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { sendFeedback, type FeedbackCategory } from '../../api/feedback';
import { getApiErrorMessage } from '../../api/http';
import { notificationsQueryKey } from '../../api/notifications';

type ContactAdminModalProps = {
  onClose: () => void;
  opened: boolean;
};

const categoryOptions = [
  { label: '问题反馈', value: 'BUG' },
  { label: '功能建议', value: 'FEATURE' },
  { label: '其他留言', value: 'OTHER' },
];

export function ContactAdminModal({ onClose, opened }: ContactAdminModalProps) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<FeedbackCategory>('BUG');
  const [message, setMessage] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) return;

    setError(null);
    setIsOpening(true);
    try {
      const feedback = await sendFeedback({
        category,
        message: normalizedMessage,
      });
      await queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      setMessage('');
      onClose();
      notifications.show({
        color: 'green',
        message: `反馈 ${feedback.referenceId} 已成功发送，正在等待管理员处理。`,
        title: '反馈已提交',
      });
    } catch (submitError) {
      setError(await getApiErrorMessage(submitError));
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Modal centered onClose={onClose} opened={opened} title="联系系统管理员">
      <Stack>
        <Text c="dimmed" size="sm">
          留言将提交给系统管理员，提交后可以在通知中心查看处理状态。
        </Text>
        <Select
          allowDeselect={false}
          data={categoryOptions}
          label="反馈类型"
          onChange={(value) => setCategory(value as FeedbackCategory)}
          value={category}
        />
        <Textarea
          autosize
          data-autofocus
          label="留言内容"
          maxLength={2000}
          minRows={5}
          onChange={(event) => setMessage(event.currentTarget.value)}
          placeholder="请描述你遇到的问题或建议…"
          required
          value={message}
        />
        {error ? (
          <Text c="red" size="sm">
            {error}
          </Text>
        ) : null}
        <Group justify="flex-end">
          <Button onClick={onClose} variant="default">
            取消
          </Button>
          <Button
            leftSection={<Mail aria-hidden size={16} />}
            loading={isOpening}
            onClick={() => void handleSubmit()}
            disabled={!message.trim()}
          >
            发送留言
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
