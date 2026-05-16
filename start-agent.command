#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
echo ""
echo "  ============================================"
echo "   Ottoflow Agent - Starting..."
echo "   Worker will start automatically."
echo "   Minimize this window. Do NOT close it."
echo "  ============================================"
echo ""
node local-agent.js
