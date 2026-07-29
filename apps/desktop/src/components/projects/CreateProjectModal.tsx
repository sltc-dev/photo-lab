import { Button, Group, Modal, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { FolderPlus } from 'lucide-react';
import { projectSchema, type ProjectFormValues } from '../../schemas/project.schema';
import { validateWithZod } from '../../schemas/form-validation';
import styles from '../../styles/components/projects/CreateProjectModal.module.css';

type CreateProjectModalProps = {
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ProjectFormValues) => void;
};

export function CreateProjectModal({ isSubmitting, onClose, onSubmit }: CreateProjectModalProps) {
  const form = useForm<ProjectFormValues>({
    initialValues: {
      description: '',
      name: '',
    },
    transformValues: (values) => projectSchema.parse(values),
    validate: validateWithZod(projectSchema),
  });

  return (
    <Modal
      centered
      closeOnClickOutside={!isSubmitting}
      closeOnEscape={!isSubmitting}
      onClose={onClose}
      opened
      radius="md"
      size="lg"
      title="新建图库项目"
      withCloseButton={!isSubmitting}
    >
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <Text c="dimmed" size="sm">
            创建一个独立项目来整理同一主题或任务中的照片。
          </Text>
          <TextInput
            autoFocus
            className={styles.input}
            label="项目名称"
            maxLength={100}
            placeholder="例如：2026 夏季旅行"
            required
            size="md"
            {...form.getInputProps('name')}
          />
          <Textarea
            autosize
            className={styles.input}
            label="项目描述"
            maxLength={500}
            minRows={4}
            placeholder="简单说明这个项目的内容（可选）"
            size="md"
            {...form.getInputProps('description')}
          />
          <Group className={styles.actions} justify="flex-end" mt="xs">
            <Button disabled={isSubmitting} onClick={onClose} variant="default">
              取消
            </Button>
            <Button
              leftSection={<FolderPlus aria-hidden size={17} />}
              loading={isSubmitting}
              type="submit"
            >
              创建项目
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
