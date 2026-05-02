@echo off
title Installing Claude Code Skills
echo ==========================================
echo   Installing Claude Code Templates
echo ==========================================
echo.
cd /d "%~dp0"

echo [1/27] ui-ux-pro-max...
call npx claude-code-templates@latest --skill creative-design/ui-ux-pro-max

echo [2/27] senior-fullstack...
call npx claude-code-templates@latest --skill development/senior-fullstack

echo [3/27] ui-design-system...
call npx claude-code-templates@latest --skill creative-design/ui-design-system

echo [4/27] react-best-practices...
call npx claude-code-templates@latest --skill web-development/react-best-practices

echo [5/27] brainstorming...
call npx claude-code-templates@latest --skill development/brainstorming

echo [6/27] seo-optimizer...
call npx claude-code-templates@latest --skill business-marketing/seo-optimizer

echo [7/27] senior-prompt-engineer...
call npx claude-code-templates@latest --skill development/senior-prompt-engineer

echo [8/27] frontend-design...
call npx claude-code-templates@latest --skill creative-design/frontend-design

echo [9/27] mcp-builder...
call npx claude-code-templates@latest --skill development/mcp-builder

echo [10/27] senior-backend...
call npx claude-code-templates@latest --skill development/senior-backend

echo [11/27] code-reviewer...
call npx claude-code-templates@latest --skill development/code-reviewer

echo [12/27] senior-frontend...
call npx claude-code-templates@latest --skill development/senior-frontend

echo [13/27] telegram-notifications hook...
call npx claude-code-templates@latest --hook automation/telegram-detailed-notifications

echo [14/27] debug-window hook...
call npx claude-code-templates@latest --hook development-tools/debug-window

echo [15/27] using-superpowers...
call npx claude-code-templates@latest --skill development/using-superpowers

echo [16/27] ux-researcher-designer...
call npx claude-code-templates@latest --skill creative-design/ux-researcher-designer

echo [17/27] content-creator...
call npx claude-code-templates@latest --skill business-marketing/content-creator

echo [18/27] content-research-writer...
call npx claude-code-templates@latest --skill business-marketing/content-research-writer

echo [19/27] marketing-strategy-pmm...
call npx claude-code-templates@latest --skill business-marketing/marketing-strategy-pmm

echo [20/27] social-content...
call npx claude-code-templates@latest --skill business-marketing/social-content

echo [21/27] marketing-ideas...
call npx claude-code-templates@latest --skill business-marketing/marketing-ideas

echo [22/27] seo-audit...
call npx claude-code-templates@latest --skill business-marketing/seo-audit

echo [23/27] product-strategist...
call npx claude-code-templates@latest --skill business-marketing/product-strategist

echo [24/27] programmatic-seo...
call npx claude-code-templates@latest --skill business-marketing/programmatic-seo

echo [25/27] app-builder...
call npx claude-code-templates@latest --skill business-marketing/app-builder

echo [26/27] analytics-tracking...
call npx claude-code-templates@latest --skill business-marketing/analytics-tracking

echo.
echo ==========================================
echo   All 27 skills/hooks installed!
echo ==========================================
pause
