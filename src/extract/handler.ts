import { S3Event } from 'aws-lambda';
import { extractAndSave } from './extractor.js';
import dynamoService from '../services/dynamo.service.js';

export const handleS3 = async (event: S3Event) => {
  for (const rec of event.Records) {
    const bucket = rec.s3.bucket.name;
    const key = decodeURIComponent(rec.s3.object.key.replace(/\+/g, ' '));
    const file_id = key.split('/')[0];
    try {
      await extractAndSave(file_id, bucket, key);
    } catch (e: any) {
      console.error('Extraction error', { file_id, bucket, key, error: e });
      await dynamoService.setError(file_id, e?.message || 'unknown');
    }
  }
};
