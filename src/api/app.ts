import express from 'express';
import serverless from 'serverless-http';
import { z } from 'zod';
import s3Service from '../services/s3.service.js';
import dynamoService from '../services/dynamo.service.js';
import idService from '../services/id.service.js';

const app = express();
app.use(express.json());

const uploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().optional(),
  userMetadata: z.object({
    author: z.string().optional(),
    expiresAt: z.string().datetime().optional(),
  }).catchall(z.any()).optional(),
});

app.post('/upload', async (req, res) => {
  try {
    const body = uploadSchema.parse(req.body);
    const file_id = idService.newFileId();
    const bucket = process.env.FILES_BUCKET!;
    const key = idService.keyFor(file_id, body.filename);

    await dynamoService.putPendingItem({
      file_id,
      bucket,
      key,
      userMetadata: body.userMetadata,
    });

    const url = await s3Service.presignPutObject({
      bucket,
      key,
      contentType: body.contentType,
      expiresSeconds: parseInt(process.env.PRESIGN_EXPIRES_SECONDS || '900', 10),
    });

    return res.json({
      file_id,
      upload_url: url,
      bucket,
      key,
      instructions:
        'Faça um HTTP PUT do arquivo completo para "upload_url" com o Content-Type informado.',
    });
  } catch (err: any) {
    console.error(err);
    return res.status(400).json({ error: err.message ?? 'Bad Request' });
  }
});

app.get('/metadata/:file_id', async (req, res) => {
  try {
    const { file_id } = req.params;
    const item = await dynamoService.getItem(file_id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    return res.json(item);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export const handler = serverless(app);
