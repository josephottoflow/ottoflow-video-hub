# Enqueue all 6 topics into the BullMQ render queue
# Then start the worker in a separate terminal:  npm run worker

$BASE = "http://localhost:3000"

$renders = @(
  @{ rowIndex = 2; template = "quote-card";   topic = "OODA Loop" },
  @{ rowIndex = 3; template = "listicle";     topic = "Jobs to Be Done" },
  @{ rowIndex = 4; template = "cinematic";    topic = "Survivorship Bias" },
  @{ rowIndex = 5; template = "stats-story";  topic = "2-Pizza Rule" },
  @{ rowIndex = 6; template = "tutorial";     topic = "Dunning-Kruger" },
  @{ rowIndex = 7; template = "stats-story";  topic = "80/20 Rule" }
)

$queued = @()

foreach ($r in $renders) {
  Write-Host "`nQueuing row $($r.rowIndex): $($r.topic) ($($r.template))..." -ForegroundColor Cyan
  $body = "{`"rowIndex`":$($r.rowIndex),`"template`":`"$($r.template)`"}"
  try {
    $resp   = Invoke-WebRequest -Uri "$BASE/api/pipeline" `
                -Method POST -ContentType "application/json" `
                -Body $body -UseBasicParsing -TimeoutSec 30
    $result = $resp.Content | ConvertFrom-Json
    if ($result.queued -eq 1) {
      $job = $result.jobs[0]
      Write-Host "  Queued  job ID: $($job.id)" -ForegroundColor Green
      $queued += $job
    } else {
      Write-Host "  Not queued: $($result.error)" -ForegroundColor Red
    }
  } catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "$($queued.Count)/$($renders.Count) jobs queued" -ForegroundColor Yellow
Write-Host "Start the worker to begin rendering:" -ForegroundColor Yellow
Write-Host "  npm run worker" -ForegroundColor White
Write-Host "Check job status:" -ForegroundColor Yellow
Write-Host "  GET http://localhost:3000/api/jobs" -ForegroundColor White
