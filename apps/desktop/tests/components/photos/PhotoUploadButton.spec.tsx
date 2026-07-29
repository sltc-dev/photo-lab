import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhotoUploadButton } from '../../../src/components/photos/PhotoUploadButton';

function renderButton({
  onSelectFile = vi.fn(),
  onValidationError = vi.fn(),
}: {
  onSelectFile?: (file: File) => void;
  onValidationError?: (message: string) => void;
} = {}) {
  render(
    <MantineProvider>
      <PhotoUploadButton
        isUploading={false}
        onSelectFile={onSelectFile}
        onValidationError={onValidationError}
      />
    </MantineProvider>,
  );

  return {
    onSelectFile,
    onValidationError,
  };
}

describe('PhotoUploadButton', () => {
  it('opens the native file input and submits a supported photo immediately', async () => {
    const user = userEvent.setup();
    const { onSelectFile } = renderButton();
    const input = screen.getByLabelText('选择照片');
    const clickSpy = vi.spyOn(input, 'click');
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], 'holiday.jpg', {
      type: 'image/jpeg',
    });

    await user.click(screen.getByRole('button', { name: '上传照片' }));
    expect(clickSpy).toHaveBeenCalledOnce();

    await user.upload(input, file);
    expect(onSelectFile).toHaveBeenCalledWith(file);
  });

  it('rejects an unsupported file before uploading', async () => {
    const user = userEvent.setup({
      applyAccept: false,
    });
    const { onSelectFile, onValidationError } = renderButton();
    const file = new File(['plain text'], 'notes.txt', {
      type: 'text/plain',
    });

    await user.upload(screen.getByLabelText('选择照片'), file);

    expect(onValidationError).toHaveBeenCalledWith('仅支持 JPEG、PNG 和 WebP 图片');
    expect(onSelectFile).not.toHaveBeenCalled();
  });
});
