# coalesce-memory

Unifies AI agent memory files into a single AGENTS.md file with symlinks.

## Install

```bash
npm install -g coalesce-memory
```

## Usage

```bash
come CLAUDE.md GEMINI.md codex.md
```

Creates AGENTS.md containing all file contents in blocks, then replaces originals with symlinks.

## Options

```
-o, --output     Output file (default: AGENTS.md)
--absolute       Use absolute symlink paths
--dry-run        Show actions without changes
-v, --verbose    Detailed logging
-h, --help       Show help
```