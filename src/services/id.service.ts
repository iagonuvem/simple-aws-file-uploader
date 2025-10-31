import crypto from 'crypto';

export class IdService {
  newFileId(): string {
    return crypto.randomUUID();
  }

  keyFor(file_id: string, originalName?: string) {
    const safe = (originalName ?? 'file').replace(/[^\w.\-]/g, '_');
    return `${file_id}/${safe}`;
  }
}

export default new IdService();