import * as zip from "@zip-js/zip-js";

if (!(await Deno.stat("checkedVersions.json").catch(() => null))) {
  await Deno.writeTextFile("checkedVersions.json", "[]");
}
const checkedVersions: string[] = JSON.parse(
  await Deno.readTextFile("checkedVersions.json")
);
const fileList: Record<string, string> = JSON.parse(
  await Deno.readTextFile("fileList.json")
);

type ThunderstoreVersion = {
  full_name: string;
  version_number: string;
  download_url: string;
  dependencies: string[];
};

type ThunderstorePackage = {
  full_name: string;
  package_url: string;
  versions: ThunderstoreVersion[];
};

const packages: ThunderstorePackage[] = await fetch(
  "https://thunderstore.io/c/webfishing/api/v1/package/"
).then((res) => res.json());

let str = "";

async function sha256OfFile(file: string) {
  const buf = await Deno.readFile(file);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function extractPck(pck: zip.Entry) {
  const errors = [];

  const buf = await pck.getData!(new zip.Uint8ArrayWriter());

  if (await Deno.stat("temp").catch(() => null)) {
    await Deno.remove("temp", { recursive: true });
  }
  await Deno.mkdir("temp");

  await Deno.writeFile("temp/pck.pck", buf);

  const cmd = new Deno.Command("D:\\tools\\GDRETools\\gdre_tools.exe", {
    args: ["--headless", "--recover=temp/pck.pck", "--output-dir=temp/project"],
    stdout: "piped",
    stderr: "piped"
  });
  await cmd.output();

  const projectDir = "temp/project";
  if (!(await Deno.stat(projectDir).catch(() => null))) {
    return ["Failed to recover pck"];
  }

  for (const [file, hash] of Object.entries(fileList)) {
    const path = `${projectDir}/${file}`;
    const exists = await Deno.stat(path).catch(() => null);
    if (exists != null) {
      const ourHash = await sha256OfFile(path);
      if (file.endsWith(".gd")) {
        errors.push("REPLACING SCRIPT FILE: " + file);
      } else if (ourHash === hash) {
        errors.push("POTENTIAL REPACKAGED GAME ASSET: " + file);
      }
    }
  }

  return errors;
}

async function checkPackage(pkgVersion: ThunderstoreVersion) {
  const errors = [];

  if (
    !pkgVersion.dependencies.some((dep) => dep.startsWith("NotNet-GDWeave-"))
  ) {
    errors.push("No GDWeave dependency");
  }

  const blob = await fetch(pkgVersion.download_url).then((res) => res.blob());
  const reader = new zip.BlobReader(blob);
  const file = new zip.ZipReader(reader);

  const entries = await file.getEntries();
  const entriesInModsFolder = entries.filter(
    (entry) =>
      entry.filename.startsWith("GDWeave/mods/") &&
      entry.filename.split("/").length === 3
  );
  if (entriesInModsFolder.length > 1) {
    errors.push("Multiple mods in GDWeave/mods folder");
  }

  let manifest = null;
  for (const entry of entries) {
    if (entry.filename.endsWith("manifest.json")) {
      const data = JSON.parse(await entry.getData!(new zip.TextWriter()));
      if (data.Id != null) {
        manifest = data;
        break;
      }
    }
  }

  if (!manifest) {
    errors.push("No GDWeave manifest.json found");
  }

  const pckFiles = entries.filter(
    (entry) =>
      entry.filename.startsWith("GDWeave/mods/") &&
      entry.filename.endsWith(".pck")
  );
  for (const pckFile of pckFiles) {
    const suberrors = await extractPck(pckFile);
    if (suberrors.length > 0) {
      errors.push(...suberrors);
    }
  }

  if (errors.length > 0) {
    console.error(pkgVersion.full_name, errors);
    str += `${pkgVersion.full_name}\n${errors
      .map((e) => `  - ${e}`)
      .join("\n")}\n\n`;
  }
}

const ignore = ["NotNet-GDWeave", "Pyoid-Hook_Line_and_Sinker"];

for (const pkg of packages) {
  if (ignore.includes(pkg.full_name)) continue;
  const pkgVersion = pkg.versions[0];
  if (checkedVersions.includes(pkgVersion.full_name)) continue;

  try {
    console.log("Checking", pkgVersion.full_name);
    await checkPackage(pkgVersion);

    if (!checkedVersions.includes(pkgVersion.full_name))
      checkedVersions.push(pkgVersion.full_name);
  } catch (e) {
    console.error(e);
  }
}

await Deno.writeTextFile(
  "checkedVersions.json",
  JSON.stringify(checkedVersions)
);

await Deno.writeTextFile("errors.txt", str);
