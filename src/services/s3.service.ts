import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class S3Service {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({});
  }

  async presignPutObject(params: {
    bucket: string;
    key: string;
    expiresSeconds: number;
    contentType?: string;
  }) {
    const cmd = new PutObjectCommand({
      Bucket: params.bucket,
      Key: params.key,
      ContentType: params.contentType,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: params.expiresSeconds });
  }

  async headObject(bucket: string, key: string) {
    return this.client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    );
  }

  async getObjectStream(bucket: string, key: string) {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    return res.Body as NodeJS.ReadableStream;
  }
}

export default new S3Service();