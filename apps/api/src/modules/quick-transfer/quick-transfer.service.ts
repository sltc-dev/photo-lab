import { randomBytes, randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { UploadedPhotoFile } from '../photos/photo-upload.validator';
import { PhotosService } from '../photos/photos.service';
import type {
  QuickTransferSessionDto,
  QuickTransferStatusDto,
  QuickTransferUploadResultDto,
} from './dto/quick-transfer-session.dto';

const SESSION_TTL_MS = 30 * 60 * 1000;
const MOBILE_CARD_PAGE_STYLES = `
      :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; background: #f4f7fb; color: #172033; }
      main { box-sizing: border-box; min-height: 100vh; padding: 28px 18px; display: grid; place-items: center; }
      section { width: min(100%, 420px); background: #fff; border: 1px solid #d9e1ec; border-radius: 14px; box-shadow: 0 16px 40px rgb(23 32 51 / 10%); padding: 24px; }
      h1 { font-size: 24px; line-height: 1.25; margin: 0 0 8px; }
      p { color: #667085; line-height: 1.6; margin: 0 0 20px; }
`;

type QuickTransferSession = {
  expiresAt: Date;
  id: string;
  lastUploadedPhotoId: string | null;
  projectId: string;
  token: string;
  uploadedCount: number;
  userId: string;
};

@Injectable()
export class QuickTransferService {
  private readonly sessions = new Map<string, QuickTransferSession>();

  constructor(
    private readonly photosService: PhotosService,
    private readonly prisma: PrismaService,
  ) {}

  async createSession(userId: string, projectId: string): Promise<QuickTransferSessionDto> {
    // 清理过期会话
    this.cleanupExpiredSessions();
    // 校验项目是不是当前用户的
    await this.ensureOwnedProject(userId, projectId);

    // 生成会话id、token，设置过期时间
    const id = randomUUID();
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    // 存入会话信息
    this.sessions.set(id, {
      expiresAt,
      id,
      lastUploadedPhotoId: null,
      projectId,
      token,
      uploadedCount: 0,
      userId,
    });

    // 返回路径给前端
    return {
      expiresAt: expiresAt.toISOString(),
      id,
      mobilePath: `/quick-transfer/mobile/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`,
      token,
    };
  }

  getStatus(userId: string, sessionId: string): QuickTransferStatusDto {
    const session = this.getOwnedSession(userId, sessionId);

    return {
      expiresAt: session.expiresAt.toISOString(),
      id: session.id,
      lastUploadedPhotoId: session.lastUploadedPhotoId,
      uploadedCount: session.uploadedCount,
    };
  }

  async uploadPhoto(
    sessionId: string,
    token: string,
    file: UploadedPhotoFile | undefined,
  ): Promise<QuickTransferUploadResultDto> {
    const session = this.getValidSession(sessionId, token);
    // 复用之前的普通图片上传逻辑
    const photo = await this.photosService.uploadPhoto(session.userId, session.projectId, file);

    // 更新上传图片数量
    session.uploadedCount += 1;
    session.lastUploadedPhotoId = photo.id;

    return {
      ok: true,
      photoId: photo.id,
    };
  }

  getMobilePage(sessionId: string, token: string): string {
    // 先校验二维码是否有效
    const session = this.getValidSessionOrNull(sessionId, token);
    if (!session) {
      // 如果不合法则返回失效页面
      return this.getExpiredSessionPage();
    }

    // 如果session合法，后端会生成上传表单，action为表单提交地址
    const action = `/quick-transfer/sessions/${encodeURIComponent(session.id)}/upload?token=${encodeURIComponent(session.token)}`;

    // 之前尝试过使用js上传，但是因为被拦截了，后来改成原生HTML表单
    return renderMobileCardPage({
      body: `
        <h1>面对面快传</h1>
        <p>选择手机里的 JPEG、PNG 或 WebP 图片，上传到当前 Photo Lab 项目。</p>
        <form action="${escapeHtml(action)}" enctype="multipart/form-data" method="post">
          <input accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" name="file" required type="file" />
          <input type="submit" value="上传图片" />
        </form>`,
      extraStyles: `
      input { box-sizing: border-box; width: 100%; font: inherit; }
      input { border: 1px solid #c9d3e2; border-radius: 10px; padding: 13px; }
      input[type="submit"] { margin-top: 16px; border: 0; border-radius: 10px; background: #2f68c4; color: #fff; font-weight: 700; padding: 14px 16px; }`,
      title: 'Photo Lab 面对面快传',
    });
  }

  getUploadSuccessPage(sessionId: string, token: string): string {
    const nextUploadPath = `/quick-transfer/mobile/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`;

    return renderMobileCardPage({
      body: `
        <h1>上传完成</h1>
        <p>图片已经上传到 Photo Lab，电脑端相册会自动刷新。</p>
        <a href="${escapeHtml(nextUploadPath)}">继续上传</a>`,
      extraStyles: `
      a { color: #2f68c4; font-weight: 700; text-decoration: none; }`,
      title: '上传完成',
    });
  }

  getExpiredSessionPage(): string {
    return getMobileMessagePage({
      message: '这个二维码已经失效，请回到电脑端重新打开面对面快传。',
      title: '快传已失效',
    });
  }

  getUploadFailedPage(): string {
    return getMobileMessagePage({
      message: '请确认二维码没有过期，并且选择的是 JPEG、PNG 或 WebP 图片。',
      title: '上传失败',
    });
  }

  private getOwnedSession(userId: string, sessionId: string): QuickTransferSession {
    const session = this.sessions.get(sessionId);

    if (!session || session.userId !== userId || session.expiresAt.getTime() <= Date.now()) {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '快传会话不存在');
    }

    return session;
  }

  private getValidSession(sessionId: string, token: string): QuickTransferSession {
    const session = this.getValidSessionOrNull(sessionId, token);

    if (!session) {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '快传会话不存在');
    }

    return session;
  }

  private getValidSessionOrNull(sessionId: string, token: string): QuickTransferSession | null {
    const session = this.sessions.get(sessionId);

    if (!session || session.token !== token || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return session;
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();

    for (const [id, session] of this.sessions) {
      if (session.expiresAt.getTime() <= now) {
        this.sessions.delete(id);
      }
    }
  }

  private async ensureOwnedProject(userId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      select: { id: true },
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      throw new AppException(HttpStatus.NOT_FOUND, 'PROJECT_NOT_FOUND', '项目不存在');
    }
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function getMobileMessagePage({ message, title }: { message: string; title: string }): string {
  return renderMobileCardPage({
    body: `
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>`,
    extraStyles: `
      p { margin: 0; }`,
    title,
  });
}

function renderMobileCardPage({
  body,
  extraStyles = '',
  title,
}: {
  body: string;
  extraStyles?: string;
  title: string;
}): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
${MOBILE_CARD_PAGE_STYLES}${extraStyles}
    </style>
  </head>
  <body>
    <main>
      <section>${body}
      </section>
    </main>
  </body>
</html>`;
}
