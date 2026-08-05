import { Button } from '@mantine/core';
import { Upload } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';

const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const acceptedPhotoTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

type PhotoUploadButtonProps = {
  className?: string;
  isUploading: boolean;
  onSelectFile: (file: File) => void;
  onValidationError: (message: string) => void;
};

export function PhotoUploadButton({
  className,
  isUploading,
  onSelectFile,
  onValidationError,
}: PhotoUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';

    if (!file) {
      return;
    }

    const validationError = validatePhoto(file);

    if (validationError) {
      onValidationError(validationError);
      return;
    }

    onSelectFile(file);
  };

  return (
    <>
      <Button
        className={className}
        leftSection={<Upload aria-hidden size={18} />}
        loading={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        上传照片
      </Button>
      <input
        ref={inputRef}
        accept=".jpg,.jpeg,.png,.webp"
        aria-label="选择照片"
        disabled={isUploading}
        hidden
        onChange={handleFileChange}
        type="file"
      />
    </>
  );
}

function validatePhoto(file: File): string | null {
  if (!acceptedPhotoTypes.has(file.type)) {
    return '仅支持 JPEG、PNG 和 WebP 图片';
  }

  if (file.size <= 0) {
    return '图片不能为空';
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return '图片大小不能超过 25 MB';
  }

  return null;
}
