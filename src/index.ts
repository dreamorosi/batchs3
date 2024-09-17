import middy from '@middy/core';
import { IdempotencyConfig } from '@aws-lambda-powertools/idempotency';
import { makeHandlerIdempotent } from '@aws-lambda-powertools/idempotency/middleware';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import type { S3Event } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import assert from 'tiny-invariant';

const logger = new Logger();
const idempotencyTableName = process.env.IDEMPOTENCY_TABLE_NAME;
assert(
  typeof idempotencyTableName === 'string',
  'IDEMPOTENCY_TABLE_NAME env var is required'
);
const queueUrl = process.env.QUEUE_URL;
assert(typeof queueUrl === 'string', 'QUEUE_URL env var is required');
const sqsClient = new SQSClient({});

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: idempotencyTableName,
});
const idempotencyConfig = new IdempotencyConfig({
  eventKeyJmesPath: 'Records[0].s3.object.eTag',
  throwOnNoIdempotencyKey: true,
  expiresAfterSeconds: 60 * 60 * 2, // 2 hours
});

export const handler = middy(async (event: S3Event) => {
  logger.logEventIfEnabled(event);

  const { Records: records } = event;
  const record = records[0];

  logger.info('Processing record', { record });

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(record.s3),
    })
  );

  return true;
}).use(
  makeHandlerIdempotent({
    persistenceStore,
    config: idempotencyConfig,
  })
);
