#!/usr/bin/env python3
"""
TikTok Product Video Factory — One-Click Runner
=================================================
Double-click this file or run: python run.py

What it does:
  1. Checks that Node.js is installed
  2. Installs npm dependencies (if needed)
  3. Validates your .env config
  4. Runs the full pipeline on all pending products in your Google Sheet

Optional flags:
  --skip-checks    Skip dependency checks (faster startup)
  --status         Just show config status, don't process
"""

import subprocess
import sys
import os

# ── Config ──────────────────────────────────────────────────────────────────

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(PROJECT_DIR, ".env")
NODE_MODULES = os.path.join(PROJECT_DIR, "node_modules")


# ── Helpers ─────────────────────────────────────────────────────────────────

def print_header():
    print()
    print("=" * 55)
    print("  TikTok Product Video Factory")
    print("  One-Click Pipeline Runner")
    print("=" * 55)
    print()


def print_step(num, total, msg):
    print(f"  [{num}/{total}] {msg}")


def print_ok(msg):
    print(f"       OK: {msg}")


def print_fail(msg):
    print(f"       FAIL: {msg}")


def print_warn(msg):
    print(f"       WARN: {msg}")


def run_cmd(cmd, cwd=None, capture=True):
    """Run a shell command and return (success, output)."""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd or PROJECT_DIR,
            capture_output=capture,
            text=True,
            shell=True,
            timeout=300,
        )
        return result.returncode == 0, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return False, "Command timed out (5 min limit)"
    except Exception as e:
        return False, str(e)


# ── Checks ──────────────────────────────────────────────────────────────────

def check_node():
    """Verify Node.js is installed."""
    ok, output = run_cmd("node --version")
    if ok:
        version = output.strip()
        print_ok(f"Node.js {version}")
        return True
    else:
        print_fail("Node.js not found! Install from https://nodejs.org")
        return False


def check_npm_deps():
    """Install npm dependencies if needed."""
    if os.path.exists(NODE_MODULES):
        print_ok("npm dependencies installed")
        return True

    print_warn("node_modules not found. Running npm install...")
    ok, output = run_cmd("npm install", capture=False)
    if ok:
        print_ok("npm install complete")
        return True
    else:
        print_fail("npm install failed")
        return False


def check_env_file():
    """Verify .env exists."""
    if os.path.exists(ENV_FILE):
        print_ok(".env file found")
        return True
    else:
        print_fail(".env file missing! Copy .env.example to .env and fill in your keys.")
        return False


# ── Pipeline ────────────────────────────────────────────────────────────────

def run_pipeline():
    """Run the main pipeline via npm."""
    print("\n  Starting pipeline...\n")
    print("-" * 55)

    try:
        process = subprocess.Popen(
            "npx tsx src/cli/run-pipeline.ts",
            cwd=PROJECT_DIR,
            shell=True,
            stdout=sys.stdout,
            stderr=sys.stderr,
        )
        process.wait()
        return process.returncode == 0
    except KeyboardInterrupt:
        print("\n\n  Pipeline interrupted by user.")
        return False
    except Exception as e:
        print(f"\n  Pipeline error: {e}")
        return False


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    print_header()

    args = sys.argv[1:]
    skip_checks = "--skip-checks" in args
    status_only = "--status" in args

    total_steps = 3 if not skip_checks else 2
    step = 0

    if not skip_checks:
        # Step 1: Check Node.js
        step += 1
        print_step(step, total_steps, "Checking Node.js...")
        if not check_node():
            sys.exit(1)

    # Step 2: Check dependencies
    step += 1
    print_step(step, total_steps, "Checking dependencies...")
    if not check_env_file():
        sys.exit(1)
    if not check_npm_deps():
        sys.exit(1)

    # Step 3: Validate config
    step += 1
    print_step(step, total_steps, "Validating config...")
    ok, output = run_cmd("npx tsx src/cli/validate-env.ts")
    if not ok:
        print_fail("Config validation failed")
        print(output)
        sys.exit(1)
    print_ok("Config valid")

    if status_only:
        print("\n  Status check complete. Use without --status to run pipeline.")
        sys.exit(0)

    # Run the pipeline
    print()
    print("=" * 55)
    print("  All checks passed! Running pipeline...")
    print("=" * 55)

    success = run_pipeline()

    print()
    print("-" * 55)
    if success:
        print("  Pipeline finished successfully!")
        print(f"  Check outputs in: {os.path.join(PROJECT_DIR, 'outputs')}")
    else:
        print("  Pipeline finished with errors. Check logs above.")
    print("-" * 55)
    print()

    # Keep window open on Windows (double-click)
    if os.name == "nt":
        input("Press Enter to close...")


if __name__ == "__main__":
    main()
