import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { join } from "node:path";

/**
 * kage-bunshin-lite — 필수만 남긴 플라이어 생성 웹앱.
 *
 *   CloudFront ─┬─ S3 (web/dist 정적 사이트)
 *               └─ /api/* → API Gateway HTTP API → Lambda
 *                    └ Bedrock Converse (Sonnet 4.6 → Haiku 4.5, IAM 역할 — API 키 없음)
 *                    └ DynamoDB (flyer# 초안만)
 *
 * 공개 관문은 Lambda Function URL 대신 API Gateway HTTP API(조직 정책으로 Function URL이 막힌 계정에서도 동작), 통합 상한 30초.
 * 일부러 없는 것: 비동기 잡·EventBridge sweep·업로드 버킷 권한·일일 상한·스냅샷 GSI.
 */
export class KageBunshinLiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const MODEL_ID = "global.anthropic.claude-sonnet-4-6";
    const FALLBACK_MODEL_ID = "global.anthropic.claude-haiku-4-5-20251001-v1:0";
    // global 추론 프로파일은 임의 상용 리전으로 라우팅 → 프로파일 ARN + 와일드카드 리전 FM ARN 둘 다 필요
    const modelArns = [MODEL_ID, FALLBACK_MODEL_ID].flatMap((m) => [
      `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${m}`,
      `arn:aws:bedrock:*::foundation-model/${m.replace(/^global\./, "")}`,
    ]);

    // --- DynamoDB: flyer#<id> 초안만 ---
    const table = new dynamodb.Table(this, "Data", {
      tableName: "kage-bunshin-lite",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // --- S3: 정적 사이트 (CloudFront OAC로만 읽음) ---
    const bucket = new s3.Bucket(this, "Site", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // SPA 라우팅 (/editor/:id 새로고침) — 확장자 없는 경로만 index.html로
    const spaRewrite = new cloudfront.Function(this, "SpaRewrite", {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  if (!request.uri.includes(".")) { request.uri = "/index.html"; }
  return request;
}`),
    });

    // --- API Lambda ---
    const logGroup = new logs.LogGroup(this, "ApiLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const fn = new lambda.Function(this, "Api", {
      functionName: "kage-bunshin-lite-api",
      runtime: lambda.Runtime.NODEJS_22_X, // AWS SDK v3 런타임 내장 — 번들 의존성 없음
      handler: "handler.handler",
      code: lambda.Code.fromAsset(join(__dirname, "..", "..", "lambda", "api")),
      timeout: cdk.Duration.seconds(60), // API Gateway가 30초에서 끊으므로 실제 상한은 GENERATE_BUDGET_MS
      memorySize: 512,
      logGroup,
      environment: {
        TABLE: table.tableName,
        MODEL_ID,
        FALLBACK_MODEL_ID,
        GENERATE_BUDGET_MS: "26000",
      },
    });
    fn.addToRolePolicy(new iam.PolicyStatement({
      sid: "InvokeBedrock",
      actions: ["bedrock:InvokeModel"],
      resources: modelArns,
    }));
    table.grantReadWriteData(fn);

    // 공개 관문: API Gateway HTTP API — $default 라우트가 전부 Lambda로
    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: "kage-bunshin-lite-api",
      defaultIntegration: new HttpLambdaIntegration("ApiIntegration", fn),
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ["content-type"],
        maxAge: cdk.Duration.hours(1),
      },
    });
    // https://xxx.execute-api.<리전>.amazonaws.com → 도메인만 추출해 오리진으로
    const apiDomain = cdk.Fn.select(2, cdk.Fn.split("/", httpApi.apiEndpoint));

    const distribution = new cloudfront.Distribution(this, "Dist", {
      comment: "kage-bunshin-lite flyer app",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [{
          function: spaRewrite,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new origins.HttpOrigin(apiDomain),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          // API GW는 자기 Host를 봐야 하므로 뷰어 Host는 전달하지 않는다
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200, // 아시아 포함
    });

    // --- 웹 배포: web/dist + 런타임 설정(config.json — API는 같은 도메인 /api) ---
    new s3deploy.BucketDeployment(this, "WebDeploy", {
      sources: [
        s3deploy.Source.asset(join(__dirname, "..", "..", "web", "dist")),
        s3deploy.Source.jsonData("config.json", { apiUrl: "/api" }),
      ],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ["/*"],
    });

    new cdk.CfnOutput(this, "AppUrl", { value: `https://${distribution.domainName}` });
    new cdk.CfnOutput(this, "ApiUrl", { value: `https://${distribution.domainName}/api` });
    new cdk.CfnOutput(this, "TableName", { value: table.tableName });
  }
}
