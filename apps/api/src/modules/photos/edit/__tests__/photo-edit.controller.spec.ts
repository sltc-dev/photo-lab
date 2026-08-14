import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../../../../common/types/authenticated-request';
import type { UploadedPhotoFile } from '../../photo-upload.validator';
import { PhotoEditController } from '../photo-edit.controller';
import { PhotoEditService } from '../photo-edit.service';

const user: RequestUser = { id: 'user-1' };
const uploadedFile: UploadedPhotoFile = {
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
  mimetype: 'image/jpeg',
  originalname: 'holiday.jpg',
  size: 4,
};

function createController() {
  const getEditedPhotoState = vi.fn().mockResolvedValue({
    editState: { annotations: {} },
  });
  const saveEditedPhoto = vi.fn().mockResolvedValue(undefined);
  const service = {
    getEditedPhotoState,
    saveEditedPhoto,
  } as unknown as PhotoEditService;

  return {
    controller: new PhotoEditController(service),
    getEditedPhotoState,
    saveEditedPhoto,
  };
}

describe('PhotoEditController', () => {
  it('returns the saved editor state', async () => {
    const { controller, getEditedPhotoState } = createController();

    await expect(controller.getEditedPhotoState(user, 'project-1', 'photo-1')).resolves.toEqual({
      editState: { annotations: {} },
    });
    expect(getEditedPhotoState).toHaveBeenCalledWith('user-1', 'project-1', 'photo-1');
  });

  it('passes save and finalize choices to the service', async () => {
    const { controller, saveEditedPhoto } = createController();

    await controller.saveEditedPhoto(user, 'project-1', 'photo-1', uploadedFile, {
      editState: '{"annotations":{}}',
      finalize: true,
    });

    expect(saveEditedPhoto).toHaveBeenCalledWith(
      'user-1',
      'project-1',
      'photo-1',
      uploadedFile,
      true,
      '{"annotations":{}}',
    );
  });
});
