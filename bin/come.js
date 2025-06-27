#!/usr/bin/env node
/**
 * coalesce-memory — "come" command
 * Unifies markdown files into AGENTS.md and symlinks them.
 */
import { promises as fs } from "fs";
import path from "path";
import process from "process";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, "../package.json"), "utf8"));

async function createSymlinkWithFallback(target, linkPath, fallbackSourcePath) {
  try {
    await fs.symlink(target, linkPath);
    logVerbose(`Created symlink: ${linkPath} -> ${target}`);
  } catch (err) {
    if (process.platform === 'win32' && (err.code === 'EPERM' || err.code === 'ENOENT')) {
      log(`Symlink failed on Windows, falling back to copy mode for ${path.basename(linkPath)}`);
      logVerbose(`Error: ${err.message}`);
      await fs.copyFile(fallbackSourcePath, linkPath);
      logVerbose(`Copied file: ${fallbackSourcePath} -> ${linkPath}`);
    } else {
      logVerbose(`Symlink error: ${err.message}`);
      throw err;
    }
  }
}

// CLI options with defaults
let options = {
  output: "AGENTS.md",
  absolute: false,
  dryRun: false,
  verbose: false,
  showHelp: false,
  showVersion: false
};

function log(message, level = 'info') {
  if (level === 'verbose' && !options.verbose) return;
  console.log(message);
}

function logVerbose(message) {
  log(message, 'verbose');
}

async function addToGitignore(cwd, filename) {
  if (options.dryRun) {
    logVerbose(`[dry-run] Would add ${filename} to .gitignore`);
    return;
  }
  
  logVerbose(`Processing .gitignore for ${filename}`);
  const gitignorePath = path.join(cwd, ".gitignore");
  const blockStart = "# coalesce-memory symlinked files";
  const blockEnd = "# end coalesce-memory";
  let lines = [];
  let content = "";
  try {
    content = await fs.readFile(gitignorePath, "utf8");
    lines = content.split("\n");
  } catch {
    // .gitignore doesn't exist, create block
    const block = `${blockStart}\n${filename}\n${blockEnd}\n`;
    await fs.writeFile(gitignorePath, block);
    log(`Created .gitignore with coalesce-memory block and added ${filename}`);
    logVerbose(`Added block: ${blockStart} ... ${blockEnd}`);
    return;
  }
  const startIdx = lines.findIndex(line => line.trim() === blockStart);
  const endIdx =
    startIdx !== -1
      ? lines.findIndex((line, idx) => idx > startIdx && line.trim() === blockEnd)
      : -1;
  if (startIdx !== -1 && endIdx !== -1) {
    const blockEntries = lines.slice(startIdx + 1, endIdx);
    if (blockEntries.some(line => line.trim() === filename)) {
      return;
    }
    lines.splice(endIdx, 0, filename);
    await fs.writeFile(gitignorePath, lines.join("\n"));
    logVerbose(`Added ${filename} to .gitignore`);
    logVerbose(`Updated existing block at lines ${startIdx + 1}-${endIdx + 1}`);
  } else {
    const separator = content.length > 0 ? "\n\n" : "";
    const block = `${separator}${blockStart}\n${filename}\n${blockEnd}\n`;
    await fs.appendFile(gitignorePath, block);
    log(`Added ${filename} to .gitignore in coalesce-memory block`);
    logVerbose(`Created new block: ${blockStart} ... ${blockEnd}`);
  }
}

(async () => {
  try {
    const cwd = process.cwd();
    // Parse CLI arguments
    const args = process.argv.slice(2);
    const filesToProcess = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      switch (arg) {
        case "-h":
        case "--help":
          options.showHelp = true;
          break;
        case "--version":
          options.showVersion = true;
          break;
        case "-o":
        case "--output":
          options.output = args[++i];
          break;
        case "--absolute":
          options.absolute = true;
          break;
        case "--dry-run":
          options.dryRun = true;
          break;
        case "-v":
        case "--verbose":
          options.verbose = true;
          break;
        default:
          if (arg.startsWith("-")) {
            console.error(`Unknown option: ${arg}`);
            process.exit(1);
          }
          filesToProcess.push(arg);
      }
    }

    if (options.showHelp) {
      console.log("Usage: come [options] <file1.md> [file2.md] [...]");
      console.log("");
      console.log("Options:");
      console.log("  -h, --help       display help information");
      console.log("      --version    display version");
      console.log("  -o, --output     unified output file (default: AGENTS.md)");
      console.log("      --absolute   use absolute paths for symlink targets");
      console.log("      --dry-run    show actions without making changes");
      console.log("  -v, --verbose    enable verbose logging");
      process.exit(0);
    }

    if (options.showVersion) {
      console.log(pkg.version);
      process.exit(0);
    }

    if (filesToProcess.length === 0) {
      console.log("No input files specified.");
      console.log("Usage: come [options] <file1.md> [file2.md] [...]");
      process.exit(0);
    }

    const unified = options.output;
    const unifiedPath = path.isAbsolute(unified) ? unified : path.join(cwd, unified);

    if (options.dryRun) {
      console.log("[dry-run] Dry run mode: no changes will be made.");
    }
    
    logVerbose(`Processing ${filesToProcess.length} files with unified output: ${unified}`);
    logVerbose(`Options: absolute=${options.absolute}, dryRun=${options.dryRun}, verbose=${options.verbose}`);

    // 1. Ensure unified file exists (skip in dry-run)
    if (!options.dryRun) {
      try {
        await fs.access(unifiedPath);
        logVerbose(`Unified file ${unified} already exists`);
      } catch {
        await fs.writeFile(unifiedPath, "");
        logVerbose(`Created empty unified file: ${unified}`);
      }
    } else {
      logVerbose(`[dry-run] Would ensure unified file exists: ${unified}`);
    }

    // 2. Handle every file argument
    for (const file of filesToProcess) {
      if (file === unified) {
        logVerbose(`Skipping ${file} (the unified file itself)`);
        continue;
      }
      
      logVerbose(`Processing file: ${file}`);

      const filePath = path.join(cwd, file);

      let stat;
      try {
        stat = await fs.lstat(filePath);
      } catch {
        // File doesn't exist, create a symlink to unified file
        const symlinkTarget = options.absolute ? unifiedPath : path.relative(path.dirname(filePath), unifiedPath);
        if (!options.dryRun) {
          await createSymlinkWithFallback(symlinkTarget, filePath, unifiedPath);
        }
        log(`${options.dryRun ? '[dry-run] Would create' : 'Created'} symlink for non-existent file: ${file}`);
        logVerbose(`Symlink target: ${symlinkTarget}`);
        await addToGitignore(cwd, file);
        continue;
      }

      if (stat.isSymbolicLink()) {
        // Already a symlink, validate target and ensure it's in .gitignore
        const currentTarget = await fs.readlink(filePath);
        const expectedTarget = options.absolute ? unifiedPath : path.relative(path.dirname(filePath), unifiedPath);
        
        if (currentTarget !== expectedTarget) {
          log(`Symlink ${file} points to wrong target (${currentTarget}), updating to ${expectedTarget}`);
          logVerbose(`Expected target: ${expectedTarget}`);
          if (!options.dryRun) {
            await fs.unlink(filePath);
            await createSymlinkWithFallback(expectedTarget, filePath, unifiedPath);
          }
          log(`${options.dryRun ? '[dry-run] Would update' : 'Updated'} symlink target for ${file}`);
        } else {
          logVerbose(`Skipping ${file} (already a symlink with correct target)`);
          logVerbose(`Current target: ${currentTarget}`);
        }
        await addToGitignore(cwd, file);
        continue;
      }

      // a. Merge contents into AGENTS.md
      const content = await fs.readFile(filePath, "utf8");
      const safeFilename = file.replace(/`/g, '\\`');
      const blockStart = `\`>>> ${safeFilename}\``;
      const blockEnd = `\`<<< ${safeFilename}\``;
      const unifiedTx = await fs.readFile(unifiedPath, "utf8");

      if (!unifiedTx.includes(blockStart)) {
        const separator = unifiedTx.length > 0 && !unifiedTx.endsWith('\n\n') ? '\n\n' : '';
        if (!options.dryRun) {
          await fs.appendFile(
            unifiedPath,
            `${separator}${blockStart}\n${content.trim()}\n${blockEnd}\n`
          );
        }
        log(`${options.dryRun ? '[dry-run] Would merge' : 'Merged'} ${file} into ${unified}`);
        logVerbose(`Block markers: ${blockStart} ... ${blockEnd}`);
      } else {
        logVerbose(`Block for ${file} already exists in ${unified}, skipping merge`);
        logVerbose(`Found existing block: ${blockStart}`);
      }

      // b. Replace original file with a symlink (with rollback safety)
      const symlinkTarget = options.absolute ? unifiedPath : path.relative(path.dirname(filePath), unifiedPath);
      if (!options.dryRun) {
        const backupPath = `${filePath}.backup-${Date.now()}`;
        try {
          await fs.rename(filePath, backupPath);
          await createSymlinkWithFallback(symlinkTarget, filePath, unifiedPath);
          await fs.unlink(backupPath);
        } catch (symlinkErr) {
          // Rollback on symlink failure
          try {
            await fs.rename(backupPath, filePath);
          } catch (rollbackErr) {
            console.error(`Critical error: Failed to rollback ${file}. Backup at ${backupPath}`);
            throw rollbackErr;
          }
          throw symlinkErr;
        }
      }
      log(`${options.dryRun ? '[dry-run] Would replace' : 'Replaced'} ${file} with a symlink to ${unified}`);
      logVerbose(`Symlink target: ${symlinkTarget}`);

      // c. Add to .gitignore
      await addToGitignore(cwd, file);
    }

  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();