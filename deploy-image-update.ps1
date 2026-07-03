# deploy-image-update.ps1 -- Rebuild and push the Docker image, then force a new ACA revision
# Additive-safe: only pushes a new image and triggers an ACA rolling update.
# Existing agents and connections are not touched.
#
# Usage (from repo root):
#   .\deploy-image-update.ps1

$ErrorActionPreference = "Stop"

$RESOURCE_GROUP = "rg-cwm-mcp"
$ACA_APP_NAME   = "connectwise-manage-mcp"
$ACR_NAME       = "acrcwmmcp"

Write-Host "=== Step 1: TypeScript build ===" -ForegroundColor Cyan
npm run build

Write-Host "`n=== Step 2: Build and push Docker image to ACR ===" -ForegroundColor Cyan
$ACR_LOGIN_SERVER = az acr show --name $ACR_NAME --query loginServer --output tsv
$IMAGE_REF = "$ACR_LOGIN_SERVER/connectwise-manage-mcp:latest"
Write-Host "  Image: $IMAGE_REF"
az acr login --name $ACR_NAME
docker build -t $IMAGE_REF $PSScriptRoot
docker push $IMAGE_REF
Write-Host "  Image pushed."

Write-Host "`n=== Step 3: Force new ACA revision ===" -ForegroundColor Cyan
az containerapp update --name $ACA_APP_NAME --resource-group $RESOURCE_GROUP --image $IMAGE_REF | Out-Null
Write-Host "  Revision triggered. Waiting 30s for startup..."
Start-Sleep -Seconds 30

$FQDN = az containerapp show --name $ACA_APP_NAME --resource-group $RESOURCE_GROUP `
    --query properties.configuration.ingress.fqdn --output tsv
try {
    $health = Invoke-RestMethod -Uri "https://$FQDN/health" -TimeoutSec 10
    Write-Host "  Health: $($health | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Warning "  Health check failed — container may still be starting. Verify: https://$FQDN/health"
}

Write-Host "`nDone." -ForegroundColor Green
Write-Host "  New endpoint: https://$FQDN/mcp/knowledge-base"
