# Test text AI models through fal.ai's OpenRouter router, the same way the Worker calls them.
# Asks for your fal key without showing it, sends one short prompt to each model,
# and prints the reply, token counts, cost at the Worker's price, and the credits a member would pay.
# Cost: well under 1 cent per run. The key is never saved anywhere.
#
# Run from PowerShell:
#   powershell -ExecutionPolicy Bypass -File tools\test-llm-model.ps1

param(
  [string]$Prompt = "In two sentences, give a small bakery one tip for getting more Google reviews."
)

# model id -> Worker price per million tokens (keep in step with LLMS in worker/src/index.js)
$models = [ordered]@{
  "anthropic/claude-sonnet-4.5" = @{ inPerM = 3.00; outPerM = 15.00 }
  "anthropic/claude-sonnet-5.5" = @{ inPerM = 2.00; outPerM = 10.00 }
}
$markup = 3

$secure = Read-Host "Paste your fal.ai key (hidden)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

$url = "https://fal.run/openrouter/router/openai/v1/chat/completions"
foreach ($m in $models.Keys) {
  $body = @{ model = $m; max_tokens = 300; messages = @(
    @{ role = "system"; content = "You are a helpful assistant for small-business owners." },
    @{ role = "user"; content = $Prompt }
  ) } | ConvertTo-Json -Depth 5
  Write-Host "`n=== $m ===" -ForegroundColor Cyan
  try {
    $r = Invoke-RestMethod -Method Post -Uri $url -Headers @{ Authorization = "Key $key" } `
      -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes($body))
    $inTok = [int]$r.usage.prompt_tokens; $outTok = [int]$r.usage.completion_tokens
    $usd = ($inTok * $models[$m].inPerM + $outTok * $models[$m].outPerM) / 1e6
    $credits = [Math]::Max(1, [Math]::Ceiling($usd * $markup / 0.01 - 1e-9))
    Write-Host $r.choices[0].message.content
    Write-Host ("tokens in/out: {0}/{1}   cost at list price: `${2:N5}   member pays: {3} credit(s)" -f $inTok, $outTok, $usd, $credits) -ForegroundColor Green
    if ($r.model) { Write-Host "model reported by router: $($r.model)" }
  } catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  }
}
$key = $null
