#!/bin/bash
# git-webdiff: webdiff entry script
# This lets you run "git webdiff"

set -euo pipefail

# Check if we're being called as a difftool (wrapper mode)
if [ -n "${WEBDIFF_AS_DIFFTOOL-}" ]; then
    # We're being called by git difftool - act like the wrapper
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # Handle Ctrl-C gracefully
    # trap 'echo -e "\nWebdiff server stopped by user" >&2; exit 0' INT

    # Pass any additional webdiff configuration from WEBDIFF_ARGS.
    # Environment variables can only be strings, so WEBDIFF_ARGS is a
    # space-separated string of shell-quoted arguments. We use `eval`
    # to safely parse it back into a bash array.
    webdiff_args=()
    if [ -n "${WEBDIFF_ARGS-}" ]; then
        eval "webdiff_args=(${WEBDIFF_ARGS})"
    fi

    echo "Now starting webdiff with arguments: ${webdiff_args[@]}"

    cd "$SCRIPT_DIR" && \
      exec uv run -m webdiff.app "${webdiff_args[@]}" "$@"
fi

webdiff_args=()
git_args=()

# Function to show help
show_help() {
    cat << 'EOF'
usage: git-webdiff [-h] [options] [git_args ...]

Web-based git difftool

positional arguments:
  git_args                     Arguments to pass to git difftool

options:
  -h, --help                   show this help message and exit
  --port PORT, -p PORT         Port to serve on (default: random)
  --host HOST                  Host to serve on (default: localhost)
  --root-path PATH             Root path for the application (e.g., /webdiff)
  --timeout MINUTES            Automatically shut down the server after this many minutes
  --unified LINES              Number of unified context lines (default: 8)
  --extra-dir-diff-args ARGS   Extra arguments for directory diff
  --extra-file-diff-args ARGS  Extra arguments for file diff
  --max-diff-width WIDTH       Maximum width for diff display (default: 120)
  --theme THEME                Color theme for syntax highlighting (default: googlecode)
  --max-lines-for-syntax LINES Maximum lines for syntax highlighting (default: 25000)
  --diff-algorithm ALGORITHM   Diff algorithm: myers, minimal, patience, histogram
  --color-insert COLOR         Background color for inserted lines (default: #efe)
  --color-delete COLOR         Background color for deleted lines (default: #fee)
  --color-char-insert COLOR    Background color for inserted characters (default: #cfc)
  --color-char-delete COLOR    Background color for deleted characters (default: #fcc)

Examples:
=========

# Compare working directory with HEAD
git-webdiff

# Compare specific commits
git-webdiff HEAD~3..HEAD

# Compare staged changes
git-webdiff --cached

# Compare specific files
git-webdiff -- path/to/file.txt

# Pass options to webdiff
git-webdiff --theme monokai --max-diff-width 150

Configuration:
=============

To use as default git difftool:
    git config --global diff.tool webdiff
    git config --global difftool.prompt false
    git config --global difftool.webdiff.cmd 'WEBDIFF_AS_DIFFTOOL=1 /path/to/git-webdiff "$LOCAL" "$REMOTE"'

To pass arguments when using as a difftool, you can set WEBDIFF_ARGS.
For example, in your .gitconfig:
[difftool "webdiff"]
    cmd = WEBDIFF_ARGS="--theme monokai" WEBDIFF_AS_DIFFTOOL=1 /path/to/git-webdiff "$LOCAL" "$REMOTE"

Or using an environment variable in your shell profile:
    export WEBDIFF_ARGS="--theme monokai --max-diff-width 150"

The server will run in the foreground. Press Ctrl-C to stop it.
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -p|--port|--timeout|--unified|--max-diff-width|--max-lines-for-syntax)
            if [[ -z "$2" || ! "$2" =~ ^[0-9]+$ ]]; then
                echo "Error: $1 requires a numeric argument" >&2
                exit 1
            fi
            webdiff_args+=("$1" "$2")
            shift 2
            ;;
        --host|--root-path|--theme|--diff-algorithm|--color-insert|--color-delete|--color-char-insert|--color-char-delete|--extra-dir-diff-args|--extra-file-diff-args)
            if [[ -z "$2" ]]; then
                echo "Error: $1 requires an argument" >&2
                exit 1
            fi
            webdiff_args+=("$1" "$2")
            shift 2
            ;;
        *)
            # All remaining arguments are git arguments
            git_args+=("$1")
            shift
            ;;
    esac
done

export WEBDIFF_AS_DIFFTOOL=1
# We serialize the webdiff_args array into a single string that can be
# passed via an environment variable. `printf "%q "` quotes each element
# to handle spaces and special characters safely. This string is then
# deserialized by the script when it's re-invoked by git-difftool.
export WEBDIFF_ARGS="$(printf "%q " "${webdiff_args[@]}")"

# First check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Check if there are any differences to show
# We need to handle different cases:
# - No arguments: compare working tree with HEAD
# - --cached: compare index with HEAD
# - Other arguments: pass through to git diff
has_diff=0

if [ ${#git_args[@]} -eq 0 ]; then
    # No arguments - check working tree vs HEAD
    git diff --quiet HEAD 2>/dev/null || has_diff=1
else
    # Has arguments - check with git diff
    git diff --quiet "${git_args[@]}" 2>/dev/null || has_diff=1
fi

if [ $has_diff -eq 0 ]; then
    # No differences found
    echo "No differences found."
    exit 1
fi

# There are differences, run git difftool
git_cmd=(git difftool -d -x "$(realpath "$0")" "${git_args[@]}")
exec "${git_cmd[@]}"
