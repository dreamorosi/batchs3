# Repro idempotency

## Instructions to deploy

1. Clone the repository
2. Run `npm ci` to install the dependencies
3. Run `npm run deploy` to deploy the stack to your AWS account
4. Take note of the bucket name in the stack output

## Instructions to test

Upload multiple files to the S3 bucket, files are provided in the `test_images` folder (replace the bucket name):

```sh
aws s3 sync test_images s3://<bucket-name>/uploads/images/
```

## Expected behavior

The function publishes a message to a SQS queue for each unique file uploaded to the S3 bucket. Files are considered unique if they have a different `eTag` field.

When a file is considered unique, the entire `handler` function is skipped and you should not see any function logs for that request, besides the Lambda ones (`START`, `END`, `REPORT`).

Additionally, you should see an idempotency record in the DynamoDB table for each unique file uploaded. The duration of this record is 2 hrs.

## Additional details

Note that the function handler must return a value different than `undefined` for the Middy.js middleware to work correctly. This is a Middy.js limitation as detailed in [Middy.js documentation](https://middy.js.org/docs/intro/early-interrupt/) (see second paragraph). If you don't return a value from the handler, or from the function you want to make idempotent, the middleware will not work as expected and you should use one of the other methods mentioned in the [Powertools for AWS documentation](https://docs.powertools.aws.dev/lambda/typescript/latest/utilities/idempotency/#makeidempotent-function-wrapper).

Note also that the function has been given the correct IAM permissions to interact with SQS and DynamoDB. For both the function also has corresponding environment variables to specify the queue url and table name. For the DynamoDB table, the primary key is `id`, which is the default for the Idempotency utility in Powertools for AWS Lambda. If you want to use a different primary key for your table, you can do so but you'll also have to specify it in the `DynamoDBPersistenceLayer` constructor as described [in the docs](https://docs.powertools.aws.dev/lambda/typescript/latest/utilities/idempotency/#dynamodbpersistencelayer).

Finally, note that in the `IdempotencyConfig` constructor we are specifying a `eventKeyJmesPath` property. This is the [JMESPath expression](https://jmespath.org) used to extract one or more keys from the event object that will be used to identify the request. In this case, we are using the `Records` array from the S3 event to extract the `s3.object.eTag` field from the first and only record. This is the field that will be used to determine if a file is unique or not. If you want to use a different field, you can do so by changing the JMESPath expression accordingly.

## Cleanup

1. Run `npm run cdk destroy` to delete the stack from your AWS account.

## License

MIT-0
