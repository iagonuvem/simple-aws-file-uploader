import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { StoredItem, UserMetadata } from '../types.js';

export class DynamoService {
  private ddb: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const table = process.env.TABLE_NAME;
    if (!table) throw new Error('TABLE_NAME env var is required');
    this.tableName = table;
    this.ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async putPendingItem(item: {
    file_id: string;
    bucket: string;
    key: string;
    userMetadata?: UserMetadata;
  }) {
    const now = new Date().toISOString();
    const data: StoredItem = {
      file_id: item.file_id,
      bucket: item.bucket,
      key: item.key,
      status: 'PENDING_UPLOAD',
      userMetadata: item.userMetadata,
      createdAt: now,
      updatedAt: now,
    };
    await this.ddb.send(
      new PutCommand({ TableName: this.tableName, Item: data }),
    );
    return data;
  }

  async getItem(file_id: string) {
    const res = await this.ddb.send(
      new GetCommand({ TableName: this.tableName, Key: { file_id } }),
    );
    return res.Item as StoredItem | undefined;
  }

  async markUploaded(file_id: string) {
    const now = new Date().toISOString();
    await this.ddb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { file_id },
        UpdateExpression: 'SET #s = :s, updatedAt = :u',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':s': 'UPLOADED', ':u': now },
      }),
    );
  }

  async setExtracted(
    file_id: string,
    systemMetadata: StoredItem['systemMetadata'],
  ) {
    const now = new Date().toISOString();
    await this.ddb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { file_id },
        UpdateExpression: 'SET #s = :s, systemMetadata = :m, updatedAt = :u',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':s': 'EXTRACTED', ':m': systemMetadata, ':u': now },
      }),
    );
  }

  async setError(file_id: string, message: string) {
    const now = new Date().toISOString();
    await this.ddb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { file_id },
        UpdateExpression: 'SET #s = :s, #err = :e, updatedAt = :u',
        ExpressionAttributeNames: { '#s': 'status', '#err': 'error' },
        ExpressionAttributeValues: { ':s': 'ERROR', ':e': message, ':u': now },
      }),
    );
  }
}

export default new DynamoService();
