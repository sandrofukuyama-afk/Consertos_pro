import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();

const ignoredDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "work",
]);

const ignoredPathFragments = [
  `${path.sep}public${path.sep}pdfjs${path.sep}`,
];

const ignoredExtensions = new Set([
  ".brd",
  ".bdv",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".webm",
  ".zip",
  ".gz",
  ".lockb",
]);

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".env",
  ".gitignore",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mdx",
  ".mjs",
  ".scss",
  ".sql",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const mojibakePatterns = ["Ã", "Â", "â€", "�"]; // encoding-check-ignore
const ignoreLineMarker = "encoding-check-ignore";

function shouldIgnorePath(filePath) {
  const normalizedPath = path.normalize(filePath);
  if (ignoredPathFragments.some((fragment) => normalizedPath.includes(fragment))) {
    return true;
  }

  const extension = path.extname(normalizedPath).toLowerCase();
  if (ignoredExtensions.has(extension)) {
    return true;
  }

  return path.basename(normalizedPath).endsWith(".log");
}

function shouldScanFile(filePath) {
  if (shouldIgnorePath(filePath)) {
    return false;
  }

  const basename = path.basename(filePath);
  if (basename === ".env" || basename === ".gitignore") {
    return true;
  }

  return textExtensions.has(path.extname(filePath).toLowerCase());
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name) || shouldIgnorePath(fullPath)) {
        continue;
      }

      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && shouldScanFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function findEncodingIssues() {
  const files = await collectFiles(projectRoot);
  const issues = [];

  for (const filePath of files) {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      continue;
    }

    const content = await readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const hits = new Set();

    for (const line of lines) {
      if (line.includes(ignoreLineMarker)) {
        continue;
      }

      for (const pattern of mojibakePatterns) {
        if (line.includes(pattern)) {
          hits.add(pattern);
        }
      }
    }

    if (hits.size > 0) {
      issues.push({
        filePath: path.relative(projectRoot, filePath),
        patterns: [...hits],
      });
    }
  }

  return issues;
}

const issues = await findEncodingIssues();

if (issues.length > 0) {
  console.error("Mojibake detectado. Corrija os textos antes de concluir:");
  for (const issue of issues) {
    console.error(`- ${issue.filePath}: ${issue.patterns.join(", ")}`);
  }
  process.exit(1);
}

console.log("Encoding check passed.");
