# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `coalesce-memory`, a Node.js CLI tool that unifies AI agent memory files (CLAUDE.md, GEMINI.md, codex.md) into a single AGENTS.md file. The tool creates symlinks from the original files to AGENTS.md to maintain compatibility with different AI agents.

## Commands

### Development and Testing
- `node bin/come.js <file1.md> [file2.md] [...]` - Run the CLI tool directly
- `come <file1.md> [file2.md] [...]` - Use the globally installed CLI (if linked via npm)

### Installation
- `npm link` - Link the package globally for development
- `npm install -g .` - Install globally from local directory

## Architecture

### Core Components
- `bin/come.js` - Main CLI entry point that handles file processing
- `package.json` - Defines the `come` binary and project metadata

### File Processing Logic
The tool follows this workflow:
1. Ensures AGENTS.md exists (creates empty file if missing)
2. For each input file:
   - If file doesn't exist: creates symlink to AGENTS.md
   - If already symlink: validates target and updates if needed
   - If regular file: merges content into AGENTS.md using block markers (`>>> filename` / `<<< filename`), then replaces with symlink

### Key Implementation Details
- Uses ES modules (`"type": "module"` in package.json)
- Handles symlinks safely using `fs.lstat()` to detect existing symlinks
- Content merging uses block markers to prevent duplicate content
- Rollback safety prevents data loss during file replacement
- Windows compatibility with copy fallback for symlink failures
- Supports dry-run mode and verbose logging