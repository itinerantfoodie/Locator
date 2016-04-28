# Locator - AWS Lambda
## About
This is a microservice for caching the users foursquare location (to DynamoDB), as well as returning it online.

The service currently requires an active foursquare token.

## Type
This is a HTTP web service that returns JSON responses.

## TODO
* Actually modularize some of this so we can do tests :P
* Auto-deployment to AWS Lambda upon passing of tests

## AWS IAM permissions
* Requires DynamoDB access to the microservice

## Setup API Gateway information
* Set up API action
* Set up API method
* Go to integration request and under  "Body Mapping Templates" enter in
```text
{
    "oauth": "$input.params('oauth')",
    "action": "$input.params('action')",
    "version": "$stageVariables.get('version')",
    "identifier": "$input.params('identifier')",
    "tablename": "$stageVariables.get('tablename')",
    "refreshtime": "$stageVariables.get('refreshtime')"
}
```
This should map oauth to an input parameter so that you can receive this from an event.

## The deployed URL
* https://k44y2euhaf.execute-api.us-east-1.amazonaws.com/prod/GeoBeacon

## Deploying
### How to create
Replace the function name, role and profile name with your profile

```bash
rm ../locatorV2.zip
zip -r ../locatorV2.zip *
aws lambda create-function --function-name GeoBeacon \
--runtime nodejs \
--handler index.handler \
--description "Where am I, and when" \
--role arn:aws:iam::859150883574:role/lambda_s3_exec_role \
--zip-file fileb://../locatorV2.zip \
--profile=perceptionz
```

### How to update
Replace the function name and profile name with your profile

```bash
rm ../locatorV2.zip ; zip -r ../locatorV2.zip * ; aws lambda update-function-code --function-name GeoBeacon   --zip-file fileb://../locatorV2.zip --profile=perceptionz
```
