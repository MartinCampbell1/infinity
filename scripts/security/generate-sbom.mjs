#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_LOCKFILE = "package-lock.json";
const DEFAULT_OUTPUT = "artifacts/security/infinity-sbom.cdx.json";

export function parseGenerateSbomArgs(argv) {
  const options = {
    lockfile: DEFAULT_LOCKFILE,
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--lockfile") {
      options.lockfile = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--output") {
      options.output = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.lockfile) {
    throw new Error("--lockfile requires a path.");
  }
  if (!options.output) {
    throw new Error("--output requires a path.");
  }

  return options;
}

export function packageNameFromLockPath(packagePath, packageEntry) {
  if (typeof packageEntry.name === "string" && packageEntry.name.length > 0) {
    return packageEntry.name;
  }

  const segments = packagePath.split("node_modules/");
  const nodeModulePath = segments[segments.length - 1];
  if (!nodeModulePath || nodeModulePath === packagePath) {
    return path.basename(packagePath);
  }

  const nameParts = nodeModulePath.split("/");
  if (nameParts[0]?.startsWith("@")) {
    return `${nameParts[0]}/${nameParts[1]}`;
  }
  return nameParts[0];
}

export function npmPackagePurl(name, version) {
  const encodedVersion = encodeURIComponent(version);
  if (name.startsWith("@")) {
    const [scope, packageName] = name.split("/");
    return `pkg:npm/${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}@${encodedVersion}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodedVersion}`;
}

export function hashFromIntegrity(integrity) {
  if (typeof integrity !== "string" || integrity.length === 0) {
    return [];
  }

  const firstIntegrity = integrity.split(" ")[0];
  const separatorIndex = firstIntegrity.indexOf("-");
  if (separatorIndex === -1) {
    return [];
  }

  const algorithm = firstIntegrity.slice(0, separatorIndex).toUpperCase().replace(/^SHA(\d+)$/, "SHA-$1");
  const content = firstIntegrity.slice(separatorIndex + 1);
  if (!content) {
    return [];
  }
  return [{ alg: algorithm, content }];
}

export function componentFromPackage(packagePath, packageEntry) {
  const name = packageNameFromLockPath(packagePath, packageEntry);
  const version = packageEntry.version;
  if (!name || !version) {
    return null;
  }

  const component = {
    type: "library",
    "bom-ref": `${name}@${version}:${packagePath}`,
    name,
    version,
    purl: npmPackagePurl(name, version),
    scope: packageEntry.optional ? "optional" : "required",
    properties: [
      { name: "infinity:package-lock-path", value: packagePath },
      { name: "infinity:npm.dev", value: String(Boolean(packageEntry.dev)) },
      { name: "infinity:npm.optional", value: String(Boolean(packageEntry.optional)) },
    ],
  };

  const hashes = hashFromIntegrity(packageEntry.integrity);
  if (hashes.length > 0) {
    component.hashes = hashes;
  }

  if (typeof packageEntry.license === "string" && packageEntry.license.length > 0) {
    component.licenses = [{ license: { id: packageEntry.license } }];
  }

  return component;
}

export function buildCycloneDxSbom(packageLock, { serialNumber = "urn:uuid:00000000-0000-4000-8000-000000000000" } = {}) {
  const rootPackage = packageLock.packages?.[""] ?? {};
  const rootName = packageLock.name ?? rootPackage.name ?? "infinity";
  const rootVersion = packageLock.version ?? rootPackage.version ?? "0.0.0";

  const components = Object.entries(packageLock.packages ?? {})
    .filter(([packagePath]) => packagePath !== "")
    .map(([packagePath, packageEntry]) => componentFromPackage(packagePath, packageEntry))
    .filter(Boolean)
    .sort((left, right) => left["bom-ref"].localeCompare(right["bom-ref"]));

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber,
    version: 1,
    metadata: {
      timestamp: new Date(0).toISOString(),
      tools: [
        {
          vendor: "FounderOS",
          name: "infinity-lockfile-sbom",
          version: "1.0.0",
        },
      ],
      component: {
        type: "application",
        name: rootName,
        version: rootVersion,
      },
      properties: [
        { name: "infinity:source", value: "package-lock.json" },
        { name: "infinity:package-lock-version", value: String(packageLock.lockfileVersion ?? "unknown") },
      ],
    },
    components,
  };
}

export async function writeSbomFromPackageLock({ lockfile, output }) {
  const rawLockfile = await readFile(lockfile, "utf8");
  const packageLock = JSON.parse(rawLockfile);
  const sbom = buildCycloneDxSbom(packageLock);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");
  return {
    output,
    componentCount: sbom.components.length,
    rootName: sbom.metadata.component.name,
    rootVersion: sbom.metadata.component.version,
  };
}

async function main() {
  const options = parseGenerateSbomArgs(process.argv.slice(2));
  const result = await writeSbomFromPackageLock(options);
  console.log(
    `Wrote CycloneDX SBOM to ${result.output} (${result.componentCount} components, root ${result.rootName}@${result.rootVersion}).`
  );
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
