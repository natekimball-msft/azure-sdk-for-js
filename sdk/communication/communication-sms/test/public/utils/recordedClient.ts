// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import type { RecorderStartOptions, SanitizerOptions, TestInfo } from "@azure-tools/test-recorder";
import { Recorder, env, isPlaybackMode } from "@azure-tools/test-recorder";
import { SmsClient } from "../../../src/index.js";
import { parseConnectionString } from "@azure/communication-common";
import type { TokenCredential } from "@azure/core-auth";
import { createTestCredential } from "@azure-tools/test-credential";

export interface RecordedClient<T> {
  client: T;
  recorder: Recorder;
}

const envSetupForPlayback: { [k: string]: string } = {
  COMMUNICATION_LIVETEST_STATIC_CONNECTION_STRING: "endpoint=https://endpoint/;accesskey=banana",
  AZURE_PHONE_NUMBER: "+14255550123",
  AZURE_CLIENT_ID: "SomeClientId",
  AZURE_CLIENT_SECRET: "azure_client_secret",
  AZURE_TENANT_ID: "SomeTenantId",
  COMMUNICATION_SKIP_INT_SMS_TEST: "false",
};

const sanitizerOptions: SanitizerOptions = {
  connectionStringSanitizers: [
    {
      actualConnString: env.COMMUNICATION_LIVETEST_STATIC_CONNECTION_STRING,
      fakeConnString: envSetupForPlayback["COMMUNICATION_LIVETEST_STATIC_CONNECTION_STRING"],
    },
  ],
  uriSanitizers: [
    {
      regex: true,
      target: `https://(.*).communication.azure.com`,
      value: "sanitized",
    },
  ],
  generalSanitizers: [
    { regex: true, target: `"access_token"\\s?:\\s?"[^"]*"`, value: `"access_token":"sanitized"` },
    {
      regex: true,
      target: `"repeatabilityRequestId"\\s?:\\s?"[^"]*"`,
      value: `"repeatabilityRequestId":"sanitized"`,
    },
    {
      regex: true,
      target: `"repeatabilityFirstSent"\\s?:\\s?"[^"]*"`,
      value: `"repeatabilityFirstSent":"Thu, 01 Jan 1970 00:00:00 GMT"`,
    },
  ],
};

const recorderOptions: RecorderStartOptions = {
  envSetupForPlayback,
  sanitizerOptions: sanitizerOptions,
  removeCentralSanitizers: [
    "AZSDK3430", // .id in the body is not a secret and is listed below in the beforeEach section
    "AZSDK3424", // .to in the body is not a secret and is listed below in the beforeEach section
  ],
};

export async function createRecorder(context: TestInfo | undefined): Promise<Recorder> {
  const recorder = new Recorder(context);
  await recorder.start(recorderOptions);
  await recorder.setMatcher("CustomDefaultMatcher", {
    excludedHeaders: [
      "Accept-Language", // This is env-dependent
      "x-ms-content-sha256", // This is dependent on the current datetime
      "sec-ch-ua", // This is browser dependent
      // https://developer.mozilla.org/docs/Web/HTTP/Headers/Sec-CH-UA
    ],
  });
  return recorder;
}

export async function createRecordedSmsClient(
  context: TestInfo,
): Promise<RecordedClient<SmsClient>> {
  const recorder = await createRecorder(context);

  const client = new SmsClient(
    env.COMMUNICATION_LIVETEST_STATIC_CONNECTION_STRING ?? "",
    recorder.configureClientOptions({}),
  );
  return {
    client,
    recorder,
  };
}

export async function createRecordedSmsClientWithToken(
  context: TestInfo,
): Promise<RecordedClient<SmsClient>> {
  const recorder = await createRecorder(context);

  let credential: TokenCredential;
  const endpoint = parseConnectionString(
    env.COMMUNICATION_LIVETEST_STATIC_CONNECTION_STRING ?? "",
  ).endpoint;

  if (isPlaybackMode()) {
    credential = {
      getToken: async (_scopes: any) => {
        return { token: "testToken", expiresOnTimestamp: 11111 };
      },
    };
  } else {
    credential = createTestCredential();
  }

  const client = new SmsClient(endpoint, credential, recorder.configureClientOptions({}));

  return { client, recorder };
}
