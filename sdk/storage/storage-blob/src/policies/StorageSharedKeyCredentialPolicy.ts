// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type {
  RequestPolicy,
  RequestPolicyOptionsLike as RequestPolicyOptions,
  WebResourceLike as WebResource,
} from "@azure/core-http-compat";
import type { StorageSharedKeyCredential } from "../credentials/StorageSharedKeyCredential.js";
import { HeaderConstants } from "../utils/constants.js";
import { getURLPath, getURLQueries } from "../utils/utils.common.js";
import { CredentialPolicy } from "./CredentialPolicy.js";
import { compareHeader } from "../utils/SharedKeyComparator.js";

/**
 * StorageSharedKeyCredentialPolicy is a policy used to sign HTTP request with a shared key.
 */
export class StorageSharedKeyCredentialPolicy extends CredentialPolicy {
  /**
   * Reference to StorageSharedKeyCredential which generates StorageSharedKeyCredentialPolicy
   */
  private readonly factory: StorageSharedKeyCredential;

  /**
   * Creates an instance of StorageSharedKeyCredentialPolicy.
   * @param nextPolicy -
   * @param options -
   * @param factory -
   */
  constructor(
    nextPolicy: RequestPolicy,
    options: RequestPolicyOptions,
    factory: StorageSharedKeyCredential,
  ) {
    super(nextPolicy, options);
    this.factory = factory;
  }

  /**
   * Signs request.
   *
   * @param request -
   */
  protected signRequest(request: WebResource): WebResource {
    request.headers.set(HeaderConstants.X_MS_DATE, new Date().toUTCString());

    if (
      request.body &&
      (typeof request.body === "string" || (request.body as Buffer) !== undefined) &&
      request.body.length > 0
    ) {
      request.headers.set(HeaderConstants.CONTENT_LENGTH, Buffer.byteLength(request.body));
    }

    const stringToSign: string =
      [
        request.method.toUpperCase(),
        this.getHeaderValueToSign(request, HeaderConstants.CONTENT_LANGUAGE),
        this.getHeaderValueToSign(request, HeaderConstants.CONTENT_ENCODING),
        this.getHeaderValueToSign(request, HeaderConstants.CONTENT_LENGTH),
        this.getHeaderValueToSign(request, HeaderConstants.CONTENT_MD5),
        this.getHeaderValueToSign(request, HeaderConstants.CONTENT_TYPE),
        this.getHeaderValueToSign(request, HeaderConstants.DATE),
        this.getHeaderValueToSign(request, HeaderConstants.IF_MODIFIED_SINCE),
        this.getHeaderValueToSign(request, HeaderConstants.IF_MATCH),
        this.getHeaderValueToSign(request, HeaderConstants.IF_NONE_MATCH),
        this.getHeaderValueToSign(request, HeaderConstants.IF_UNMODIFIED_SINCE),
        this.getHeaderValueToSign(request, HeaderConstants.RANGE),
      ].join("\n") +
      "\n" +
      this.getCanonicalizedHeadersString(request) +
      this.getCanonicalizedResourceString(request);

    const signature: string = this.factory.computeHMACSHA256(stringToSign);
    request.headers.set(
      HeaderConstants.AUTHORIZATION,
      `SharedKey ${this.factory.accountName}:${signature}`,
    );

    // console.log(`[URL]:${request.url}`);
    // console.log(`[HEADERS]:${request.headers.toString()}`);
    // console.log(`[STRING TO SIGN]:${JSON.stringify(stringToSign)}`);
    // console.log(`[KEY]: ${request.headers.get(HeaderConstants.AUTHORIZATION)}`);
    return request;
  }

  /**
   * Retrieve header value according to shared key sign rules.
   * @see https://learn.microsoft.com/rest/api/storageservices/authenticate-with-shared-key
   *
   * @param request -
   * @param headerName -
   */
  private getHeaderValueToSign(request: WebResource, headerName: string): string {
    const value = request.headers.get(headerName);

    if (!value) {
      return "";
    }

    // When using version 2015-02-21 or later, if Content-Length is zero, then
    // set the Content-Length part of the StringToSign to an empty string.
    // https://learn.microsoft.com/rest/api/storageservices/authenticate-with-shared-key
    if (headerName === HeaderConstants.CONTENT_LENGTH && value === "0") {
      return "";
    }

    return value;
  }

  /**
   * To construct the CanonicalizedHeaders portion of the signature string, follow these steps:
   * 1. Retrieve all headers for the resource that begin with x-ms-, including the x-ms-date header.
   * 2. Convert each HTTP header name to lowercase.
   * 3. Sort the headers lexicographically by header name, in ascending order.
   *    Each header may appear only once in the string.
   * 4. Replace any linear whitespace in the header value with a single space.
   * 5. Trim any whitespace around the colon in the header.
   * 6. Finally, append a new-line character to each canonicalized header in the resulting list.
   *    Construct the CanonicalizedHeaders string by concatenating all headers in this list into a single string.
   *
   * @param request -
   */
  private getCanonicalizedHeadersString(request: WebResource): string {
    let headersArray = request.headers.headersArray().filter((value) => {
      return value.name.toLowerCase().startsWith(HeaderConstants.PREFIX_FOR_STORAGE);
    });

    headersArray.sort((a, b): number => {
      return compareHeader(a.name.toLowerCase(), b.name.toLowerCase());
    });

    // Remove duplicate headers
    headersArray = headersArray.filter((value, index, array) => {
      if (index > 0 && value.name.toLowerCase() === array[index - 1].name.toLowerCase()) {
        return false;
      }
      return true;
    });

    let canonicalizedHeadersStringToSign: string = "";
    headersArray.forEach((header) => {
      canonicalizedHeadersStringToSign += `${header.name
        .toLowerCase()
        .trimRight()}:${header.value.trimLeft()}\n`;
    });

    return canonicalizedHeadersStringToSign;
  }

  /**
   * Retrieves the webResource canonicalized resource string.
   *
   * @param request -
   */
  private getCanonicalizedResourceString(request: WebResource): string {
    const path = getURLPath(request.url) || "/";

    let canonicalizedResourceString: string = "";
    canonicalizedResourceString += `/${this.factory.accountName}${path}`;

    const queries = getURLQueries(request.url);
    const lowercaseQueries: { [key: string]: string } = {};
    if (queries) {
      const queryKeys: string[] = [];
      for (const key in queries) {
        if (Object.prototype.hasOwnProperty.call(queries, key)) {
          const lowercaseKey = key.toLowerCase();
          lowercaseQueries[lowercaseKey] = queries[key];
          queryKeys.push(lowercaseKey);
        }
      }

      queryKeys.sort();
      for (const key of queryKeys) {
        canonicalizedResourceString += `\n${key}:${decodeURIComponent(lowercaseQueries[key])}`;
      }
    }

    return canonicalizedResourceString;
  }
}
