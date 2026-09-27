#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { KageBunshinLiteStack } from "../lib/kage-bunshin-lite-stack";

// 스택 하나: KageBunshinLite. 계정·리전은 CDK 기본 자격증명(CDK_DEFAULT_*)을 따르고, AWS_REGION으로 덮어쓸 수 있다.
const app = new cdk.App();
new KageBunshinLiteStack(app, "KageBunshinLite", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION },
});
