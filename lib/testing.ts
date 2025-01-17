import { spy, type Stub, stub } from "@std/testing/mock";
import { format, LF } from "@std/fs/eol";
import { dirname } from "@std/path";

export const CommandStub = {
  create(pattern = "") {
    return class CommandStub extends spy(Deno.Command) {
      #cmd: string;
      constructor(
        command: string | URL,
        options?: Deno.CommandOptions,
      ) {
        super(command, options);
        this.#cmd = command.toString();
      }
      #output: Deno.CommandOutput = {
        code: 0,
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
        success: true,
        signal: null,
      };
      outputSync() {
        return this.#cmd.toString().includes(pattern)
          ? this.#output
          : super.outputSync();
      }
      output() {
        return this.#cmd.includes(pattern)
          ? Promise.resolve(this.#output)
          : super.output();
      }
      spawn() {
        return this.#cmd.includes(pattern)
          ? new Deno.ChildProcess()
          : super.spawn();
      }
      static clear() {
        this.calls = [];
      }
    };
  },
};
export type CommandStub = ReturnType<typeof CommandStub.create>;

export class FileSystemFake extends Map<string | URL, string> {}

export const ReadTextFileStub = {
  create(
    fs: FileSystemFake,
    options?: {
      readThrough?: boolean;
    },
  ): Stub {
    const original = Deno.readTextFile;
    return stub(
      Deno,
      "readTextFile",
      async (path) => {
        return fs.get(path.toString()) ??
          (path.toString().startsWith("/tmp") || options?.readThrough
            ? await original(path)
            : _throw(new Deno.errors.NotFound(`File not found: ${path}`)));
      },
    );
  },
};
export type ReadTextFileStub = ReturnType<typeof ReadTextFileStub.create>;

export const WriteTextFileStub = {
  create(
    fs: FileSystemFake,
  ) {
    const original = Deno.writeTextFile;
    const tmp = getTempDir();
    return stub(
      Deno,
      "writeTextFile",
      (path, data) => {
        if (path.toString().startsWith(tmp)) {
          return original(path, data);
        } else {
          fs.set(path.toString(), format(data.toString(), LF));
          return Promise.resolve();
        }
      },
    );
  },
};
export type WriteTextFileStub = ReturnType<typeof WriteTextFileStub.create>;

function getTempDir() {
  const temp = Deno.makeTempFileSync();
  const tempDir = dirname(temp);
  Deno.removeSync(temp);
  return tempDir;
}

export const FetchStub = {
  create(
    createResponse: (
      request: string | URL | Request,
      init: RequestInit & { original: typeof fetch },
    ) => Response | Promise<Response>,
  ) {
    const original = globalThis.fetch;
    return stub(
      globalThis,
      "fetch",
      (request, init) =>
        Promise.resolve(createResponse(request, { ...init, original })),
    );
  },
};
export type FetchStub = ReturnType<typeof FetchStub.create>;

export const LatestVersionStub = {
  create(
    replacer: string | Record<string, string | undefined>,
  ): FetchStub {
    return FetchStub.create((request, init) => {
      request = (request instanceof Request)
        ? request
        : new Request(request, init);
      const url = new URL(request.url);
      const latest = typeof replacer === "string"
        ? replacer
        : Object.entries(replacer)
          .find(([pattern]) => url.href.includes(pattern))?.[1] ??
          replacer["_"];
      if (!latest) {
        return init.original(request, init);
      }
      switch (url.hostname) {
        case "registry.npmjs.org":
          return new Response(
            JSON.stringify({ "dist-tags": { latest } }),
            { status: 200 },
          );
        case "jsr.io":
          if (!url.pathname.endsWith("meta.json")) {
            return init.original(request, init);
          }
          return new Response(
            JSON.stringify({
              versions: {
                [latest]: {},
              },
            }),
            { status: 200 },
          );
        case "deno.land": {
          if (request.method !== "HEAD") {
            return init.original(request);
          }
          const { name, path } = parseDenoLandUrl(url);
          return {
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
            redirected: true,
            status: 302,
            url: `https://${name}@${latest}${path}`,
          } as Response;
        }
        default:
          return init.original(request, init);
      }
    });
  },
};
export type LatestVersionStub = ReturnType<typeof LatestVersionStub.create>;

function parseDenoLandUrl(url: URL) {
  const std = url.pathname.startsWith("/std");
  const matched = std
    ? url.pathname.match(
      /^\/std(?:@(?<version>[^/]+))?(?<path>\/(.*)$)/,
    )
    : url.pathname.match(
      /^\/x\/(?<name>[^/]+)(?:@(?<version>[^/]+))?(?<path>\/(.*)$)/,
    );
  if (!matched) {
    throw new Error(`Unexpected URL: ${url}`);
  }
  const { name, version, path } = matched.groups!;
  return {
    name: std ? "deno.land/std" : `deno.land/x/${name}`,
    version,
    // Remove a trailing slash if it exists to imitate the behavior of typical
    // Web servers.
    path: path.replace(/\/$/, ""),
  };
}

/** Utility function to throw an error. */
function _throw(error: Error): never {
  throw error;
}
