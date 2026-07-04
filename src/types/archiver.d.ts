// Minimal typings for archiver v8 (ESM, ships without types). Only the
// surface used by the folder-zip download route is declared.
declare module "archiver" {
  import { Transform } from "node:stream";

  export class Archiver extends Transform {
    append(
      source: NodeJS.ReadableStream | Buffer | string,
      data: { name: string; store?: boolean },
    ): this;
    finalize(): Promise<void>;
    abort(): this;
  }

  export class ZipArchive extends Archiver {
    constructor(options?: {
      store?: boolean;
      zlib?: Record<string, unknown>;
      highWaterMark?: number;
      statConcurrency?: number;
    });
  }
}
