import { randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const EMPTY_CATALOG = { schemaVersion: 1, etag: null, config: null };
const MAX_CATALOG_FILE_BYTES = 1_100_000;
const writeQueues = new Map();

export function localCatalogPath(dataDirectory) {
  return path.join(dataDirectory || defaultDataDirectory(), "catalog.json");
}

function defaultDataDirectory() {
  if (process.platform === "win32")
    return path.join(
      process.env.APPDATA ||
        path.join(os.homedir(), "AppData", "Roaming"),
      "Viva",
    );
  if (process.platform === "darwin")
    return path.join(os.homedir(), "Library", "Application Support", "Viva");
  return path.join(
    process.env.XDG_DATA_HOME ||
      path.join(os.homedir(), ".local", "share"),
    "viva",
  );
}

function isValidEnvelope(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.schemaVersion !== 1
  )
    return false;
  if (value.etag === null)
    return value.config === null;
  return (
    typeof value.etag === "string" &&
    /^local-[a-f0-9]{32}$/.test(value.etag) &&
    value.config !== null &&
    typeof value.config === "object" &&
    !Array.isArray(value.config)
  );
}

async function writeTemporaryFile(filePath, contents) {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    return temporaryPath;
  } catch (error) {
    if (handle) await handle.close();
    await unlink(temporaryPath).catch((cleanupError) => {
      if (cleanupError.code !== "ENOENT") throw cleanupError;
    });
    throw error;
  }
}

export function createLocalCatalogBucket(dataDirectory) {
  const filePath = localCatalogPath(dataDirectory);
  const directory = path.dirname(filePath);

  async function readEnvelope() {
    const info = await stat(filePath);
    if (info.size > MAX_CATALOG_FILE_BYTES)
      throw new Error("Local catalog file exceeds its size limit.");
    const text = await readFile(filePath, "utf8");
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error("Local catalog file contains invalid JSON.");
    }
    if (!isValidEnvelope(value))
      throw new Error("Local catalog file has an invalid format.");
    return value;
  }

  async function ensureFile() {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      await readEnvelope();
      return;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    const temporaryPath = await writeTemporaryFile(
      filePath,
      JSON.stringify(EMPTY_CATALOG) + "\n",
    );
    try {
      await link(temporaryPath, filePath);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    } finally {
      await unlink(temporaryPath);
    }
    await readEnvelope();
  }

  function serializeWrite(operation) {
    const previous = writeQueues.get(filePath) || Promise.resolve();
    const result = previous.then(operation, operation);
    writeQueues.set(
      filePath,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  }

  return {
    async get(key) {
      if (key !== "viva/catalog.json")
        throw new Error("Unsupported local catalog key.");
      await ensureFile();
      const envelope = await readEnvelope();
      if (envelope.etag === null) return null;
      return {
        etag: envelope.etag,
        async json() {
          return envelope.config;
        },
      };
    },

    async put(key, text, options = {}) {
      if (key !== "viva/catalog.json")
        throw new Error("Unsupported local catalog key.");
      return serializeWrite(async () => {
        await ensureFile();
        const current = await readEnvelope();
        const condition = options.onlyIf || {};
        if (
          (condition.etagDoesNotMatch === "*" && current.etag !== null) ||
          (condition.etagMatches && condition.etagMatches !== current.etag)
        )
          return null;

        const config = JSON.parse(text);
        if (!config || typeof config !== "object" || Array.isArray(config))
          throw new Error("Local catalog update must be a JSON object.");
        const envelope = {
          schemaVersion: 1,
          etag: `local-${randomUUID().replaceAll("-", "")}`,
          config,
        };
        const temporaryPath = await writeTemporaryFile(
          filePath,
          JSON.stringify(envelope) + "\n",
        );
        try {
          await rename(temporaryPath, filePath);
        } catch (error) {
          await unlink(temporaryPath).catch((cleanupError) => {
            if (cleanupError.code !== "ENOENT") throw cleanupError;
          });
          throw error;
        }
        return { etag: envelope.etag };
      });
    },
  };
}
