// Copyright 2023 Shun Ueda. All rights reserved. MIT license.

/**
 * A module to bump version strings in import specifiers.
 *
 * ### Examples
 *
 * To update all dependencies in a module and write the changes to files:
 *
 * ```ts
 * import { collect, write } from "https://deno.land/x/molt@{VERSION}/mod.ts";
 *
 * const result = await collect("./mod.ts");
 * await write(result);
 * ```
 *
 * To update all dependencies in a module and commit the changes to local git repository:
 *
 * ```ts
 * import { collect, commit } from "https://deno.land/x/molt@{VERSION}/mod.ts";
 *
 * const result = await collect("./mod.ts");
 *
 * await commit(result, {
 *   groupBy: (dependency) => dependency.name,
 *   composeCommitMessage: ({ group, version }) =>
 *     `build(deps): bump ${group} to ${version!.to}`,
 * });
 * ```
 *
 * @module
 */

export * from "./core/mod.ts";
