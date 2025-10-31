import s3Service from '../services/s3.service.js';
import dynamoService from '../services/dynamo.service.js';
import crypto from 'crypto';
import { fileTypeFromStream } from 'file-type';
import pdfParse from 'pdf-parse';
import { imageSize } from 'image-size';
import { Readable } from 'stream';

// converte Buffer em Readable
function readableFromBuffer(buf: Buffer) {
  const r = new Readable();
  r.push(buf);
  r.push(null);
  return r;
}

async function bufferFromStream(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function extractAndSave(file_id: string, bucket: string, key: string) {
  const head = await s3Service.headObject(bucket, key);
  await dynamoService.markUploaded(file_id);

  const stream = await s3Service.getObjectStream(bucket, key);
  const buffer = await bufferFromStream(stream);

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  let mimeType = head.ContentType || undefined;

  if (!mimeType) {
    const ft = await fileTypeFromStream(readableFromBuffer(buffer));
    mimeType = ft?.mime;
  }

  let pages: number | undefined;
  let width: number | undefined;
  let height: number | undefined;

  if ((mimeType && mimeType.includes('pdf')) || key.toLowerCase().endsWith('.pdf')) {
    const parsed = await pdfParse(buffer);
    pages = parsed.numpages;
  }

  if (mimeType?.startsWith('image/')) {
    const dim = imageSize(buffer);
    width = dim.width;
    height = dim.height;
  }

  await dynamoService.setExtracted(file_id, {
    size: head.ContentLength,
    mimeType,
    pages,
    width,
    height,
    sha256,
  });
}
