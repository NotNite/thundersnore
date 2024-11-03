import "@std/dotenv/load";
const root = Deno.env.get("DECOMP_PATH")!;
const startingDirs = ["Assets", "Resources", "Scenes", "Sounds"];

const files: Record<string, string> = {};

async function sha256OfFile(file: string) {
  const buf = await Deno.readFile(`${root}/${file}`);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildFileList(dir: string) {
  const fullDir = `${root}/${dir}`;
  const entries = Deno.readDir(fullDir);
  for await (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      await buildFileList(path);
    } else {
      if (entry.name.endsWith(".import")) continue;
      files[path] = await sha256OfFile(path);
    }
  }
}

for (const dir of startingDirs) {
  await buildFileList(dir);
}

await Deno.writeFile(
  "fileList.json",
  new TextEncoder().encode(JSON.stringify(files, null, 2))
);
