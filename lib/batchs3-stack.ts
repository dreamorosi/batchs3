import { Stack, type StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket, EventType } from 'aws-cdk-lib/aws-s3';
import { AttributeType, TableV2, Billing } from 'aws-cdk-lib/aws-dynamodb';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Queue } from 'aws-cdk-lib/aws-sqs';

export class Batchs3Stack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // #region Lambda Function processing S3 events

    const fnName = 'Batchs3Fn';
    const logGroup = new LogGroup(this, 'MyLogGroup', {
      logGroupName: `/aws/lambda/${fnName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.ONE_DAY,
    });
    const fn = new NodejsFunction(this, 'MyFunction', {
      functionName: fnName,
      logGroup,
      runtime: Runtime.NODEJS_20_X,
      entry: './src/index.ts',
      handler: 'handler',
      bundling: {
        minify: true,
        mainFields: ['module', 'main'],
        sourceMap: true,
        format: OutputFormat.ESM,
      },
      environment: {
        POWERTOOLS_LOGGER_LOG_EVENT: 'true',
      },
    });

    // #region Idempotency Table

    const table = new TableV2(this, 'idempotencyTable', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      timeToLiveAttribute: 'expiration',
      billing: Billing.onDemand(),
      removalPolicy: RemovalPolicy.DESTROY,
    });
    table.grantReadWriteData(fn);
    fn.addEnvironment('IDEMPOTENCY_TABLE_NAME', table.tableName);

    // #region S3 Bucket to put objects

    const bucket = new Bucket(this, 'MyBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      bucketName: `batchs3-bucket-${this.account}-${this.region}`,
    });

    bucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(fn),
      {
        prefix: 'uploads/images',
      }
    );

    new CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
    });

    // #region SQS Queue to send messages (for demo only)

    const queue = new Queue(this, 'MyQueue', {});
    queue.grantSendMessages(fn);
    fn.addEnvironment('QUEUE_URL', queue.queueUrl);
  }
}
