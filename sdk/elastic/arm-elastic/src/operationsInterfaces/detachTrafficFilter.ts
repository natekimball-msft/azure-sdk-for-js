/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * Code generated by Microsoft (R) AutoRest Code Generator.
 * Changes may cause incorrect behavior and will be lost if the code is regenerated.
 */

import { PollerLike, PollOperationState } from "@azure/core-lro";
import { DetachTrafficFilterUpdateOptionalParams } from "../models";

/** Interface representing a DetachTrafficFilter. */
export interface DetachTrafficFilter {
  /**
   * Detach traffic filter for the given deployment.
   * @param resourceGroupName The name of the resource group to which the Elastic resource belongs.
   * @param monitorName Monitor resource name
   * @param options The options parameters.
   */
  beginUpdate(
    resourceGroupName: string,
    monitorName: string,
    options?: DetachTrafficFilterUpdateOptionalParams
  ): Promise<PollerLike<PollOperationState<void>, void>>;
  /**
   * Detach traffic filter for the given deployment.
   * @param resourceGroupName The name of the resource group to which the Elastic resource belongs.
   * @param monitorName Monitor resource name
   * @param options The options parameters.
   */
  beginUpdateAndWait(
    resourceGroupName: string,
    monitorName: string,
    options?: DetachTrafficFilterUpdateOptionalParams
  ): Promise<void>;
}