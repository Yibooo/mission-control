/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as memories from "../memories.js";
import type * as messages from "../messages.js";
import type * as sales from "../sales.js";
import type * as salesAgent from "../salesAgent.js";
import type * as schedules from "../schedules.js";
import type * as tasks from "../tasks.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  ai: typeof ai;
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  memories: typeof memories;
  messages: typeof messages;
  sales: typeof sales;
  salesAgent: typeof salesAgent;
  schedules: typeof schedules;
  tasks: typeof tasks;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
