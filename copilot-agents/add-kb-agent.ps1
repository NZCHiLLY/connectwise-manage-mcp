# add-kb-agent.ps1 -- Deploy the CW Knowledge Base agent to Copilot Studio
# Standalone: only creates tz_CWKnowledgeBase. Does not touch any existing agent.
#
# Steps:
#   1. Update the custom connector OpenAPI to add /mcp/knowledge-base
#   2. Pre-create the bot entity in Dataverse (idempotent)
#   3. Build a minimal single-bot solution ZIP
#   4. Import the solution
#   5. Patch gpt.default data
#   6. Publish the bot
#
# Prerequisites:
#   - pac CLI authenticated: pac auth create --url <env-url>
#   - az CLI authenticated: az login
#   - Deploy image update already done: ..\deploy-image-update.ps1
#
# Usage:
#   cd copilot-agents
#   .\add-kb-agent.ps1              # full run
#   .\add-kb-agent.ps1 -DryRun      # build ZIP only, skip all Power Platform calls

param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

$dvUrl          = "https://YOUR-ORG.crm6.dynamics.com"
$SCHEMA         = "tz_CWKnowledgeBase"
$DISPLAY        = "CW Knowledge Base Agent"
$DESC           = "CRUD for ConnectWise PSA knowledge base articles"
$YAML_FILE      = "$PSScriptRoot\agents\knowledge-base.yaml"
$OPENAPI_FILE   = "$PSScriptRoot\ConnectWiseConnectors\Connector\crc0e_5Fcw-2Dpsa-2Dmcp-2Dserver_openapidefinition.json"
$OLD            = "tz_ConnectWisePSAHelper"
$OLD_DISP       = "ConnectWise PSA Helper"
$outputDir      = "$PSScriptRoot\solutions"
$utf8NoBom      = New-Object System.Text.UTF8Encoding $false

$systemTopics = @(
    "ConversationStart", "EndofConversation", "Escalate", "Fallback",
    "Goodbye", "Greeting", "MultipleTopicsMatched", "OnError",
    "ResetConversation", "Search", "Signin", "StartOver", "ThankYou"
)

# ---------------------------------------------------------------------------
# Locate pac.exe
# ---------------------------------------------------------------------------

$pacCmd = Get-Command pac -ErrorAction SilentlyContinue
$pac = if ($pacCmd) { $pacCmd.Source } else { $null }
if (-not $pac) {
    $pac = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\PowerAppsCLI" -Recurse -Filter "pac.exe" -ErrorAction SilentlyContinue |
           Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $pac) { throw "pac.exe not found. Install via: winget install Microsoft.PowerPlatform.CLI" }

# ---------------------------------------------------------------------------
# Step 1: Update connector OpenAPI
# ---------------------------------------------------------------------------

Write-Host "=== Step 1: Update connector with /mcp/knowledge-base ===" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "  (DryRun - skipping connector update)"
} else {
    # pac connector list returns plain text; parse the data row matching cw-psa-mcp-server
    $listOutput = (& $pac connector list 2>&1) | Where-Object { $_ -match 'cw-psa-mcp-server' } | Select-Object -First 1
    $connectorId = if ($listOutput) { ($listOutput -split '\s+')[0].Trim() } else { $null }

    if (-not $connectorId) {
        Write-Warning "  Connector 'cw-psa-mcp-server' not found via pac connector list."
        Write-Warning "  Update the connector manually in make.powerapps.com before binding the connection reference."
    } else {
        Write-Host "  Found connector: $connectorId"
        $apiPropsFile = "$PSScriptRoot\ConnectWiseConnectors\Connector\apiProperties.json"
        & $pac connector update --connector-id $connectorId --api-definition-file $OPENAPI_FILE --api-properties-file $apiPropsFile
        Write-Host "  Connector updated." -ForegroundColor Green
    }
}

# ---------------------------------------------------------------------------
# Step 2: Authenticate to Dataverse
# ---------------------------------------------------------------------------

if (-not $DryRun) {
    Write-Host "`n=== Step 2: Dataverse auth ===" -ForegroundColor Cyan
    $dvToken = (& az account get-access-token --resource $dvUrl --query accessToken --output tsv 2>&1)
    $dvHdrs = @{
        Authorization      = "Bearer $dvToken"
        "OData-MaxVersion" = "4.0"
        "OData-Version"    = "4.0"
        "Content-Type"     = "application/json"
        Accept             = "application/json"
    }
    Write-Host "  Token acquired."
}

# ---------------------------------------------------------------------------
# Step 3: Build minimal single-bot solution ZIP
# ---------------------------------------------------------------------------

Write-Host "`n=== Step 3: Build solution ZIP ===" -ForegroundColor Cyan

New-Item -ItemType Directory -Force $outputDir | Out-Null
$tmpDir  = "$outputDir\_tmp_$SCHEMA"
$baseDir = "$PSScriptRoot\ConnectWiseConnectors"

if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
Copy-Item -Recurse -Force $baseDir $tmpDir

# Strip everything that references the environment — connector, assets, legacy dirs
Remove-Item -Recurse -Force "$tmpDir\Connector"       -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$tmpDir\Assets"          -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$tmpDir\dvtablesearchs"  -ErrorAction SilentlyContinue

# Remove ALL bots and botcomponents — we add only the KB bot below
Remove-Item -Recurse -Force "$tmpDir\bots"
New-Item -ItemType Directory -Force "$tmpDir\bots" | Out-Null
Remove-Item -Recurse -Force "$tmpDir\botcomponents"
New-Item -ItemType Directory -Force "$tmpDir\botcomponents" | Out-Null

# --- Bot directory (copied from template, schema name replaced) ---
$botDst = "$tmpDir\bots\$SCHEMA"
Copy-Item -Recurse -Force "$baseDir\bots\$OLD" $botDst
Get-ChildItem -Recurse -File $botDst | Where-Object { $_.Extension -in @('.xml', '.json') } | ForEach-Object {
    $raw = [System.IO.File]::ReadAllText($_.FullName)
    $upd = $raw -replace [regex]::Escape($OLD), $SCHEMA
    $upd = $upd -replace [regex]::Escape($OLD_DISP), $DISPLAY
    if ($upd -ne $raw) { [System.IO.File]::WriteAllText($_.FullName, $upd, $utf8NoBom) }
}

# --- System topics ---
$contentOverrides = [System.Collections.Generic.List[string]]::new()
foreach ($topic in $systemTopics) {
    $srcDir = "$baseDir\botcomponents\$OLD.topic.$topic"
    if (-not (Test-Path $srcDir)) { continue }
    $dstDir = "$tmpDir\botcomponents\$SCHEMA.topic.$topic"
    Copy-Item -Recurse -Force $srcDir $dstDir
    Get-ChildItem -Recurse -File $dstDir | Where-Object { $_.Extension -eq '.xml' -or $_.Name -eq 'data' } | ForEach-Object {
        $raw = [System.IO.File]::ReadAllText($_.FullName)
        $upd = $raw -replace [regex]::Escape($OLD), $SCHEMA
        if ($upd -ne $raw) { [System.IO.File]::WriteAllText($_.FullName, $upd, $utf8NoBom) }
    }
    $contentOverrides.Add("<Override PartName=""/botcomponents/$SCHEMA.topic.$topic/data"" ContentType=""application/octet-stream"" />")
}

# --- gpt.default (agent instructions) ---
$gptDst = "$tmpDir\botcomponents\$SCHEMA.gpt.default"
Copy-Item -Recurse -Force "$baseDir\botcomponents\$OLD.gpt.default" $gptDst
$bcPath = "$gptDst\botcomponent.xml"
$bc = [System.IO.File]::ReadAllText($bcPath)
$bc = $bc -replace [regex]::Escape($OLD), $SCHEMA
$bc = $bc -replace [regex]::Escape($OLD_DISP), $DISPLAY
$bc = $bc -replace '(?s)<description>.*?</description>', "<description>$DESC</description>"
[System.IO.File]::WriteAllText($bcPath, $bc, $utf8NoBom)
Copy-Item -Force $YAML_FILE "$gptDst\data"
$contentOverrides.Add("<Override PartName=""/botcomponents/$SCHEMA.gpt.default/data"" ContentType=""application/octet-stream"" />")

# --- solution.xml — single bot RootComponent only (no connector refs) ---
$solXml = @"
<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml version="9.2.26042.168" SolutionPackageVersion="9.2" languagecode="1033" generatedBy="CrmLive" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" OrganizationVersion="9.2.26042.168" OrganizationSchemaType="Standard" CRMServerServiceabilityVersion="9.2.26042.00168">
  <SolutionManifest>
    <UniqueName>CWKnowledgeBase</UniqueName>
    <LocalizedNames>
      <LocalizedName description="CW Knowledge Base" languagecode="1033" />
    </LocalizedNames>
    <Descriptions />
    <Version>0.1.0.0</Version>
    <Managed>0</Managed>
    <Publisher>
      <UniqueName>CWMCPPublisher</UniqueName>
      <LocalizedNames>
        <LocalizedName description="CWMCPPublisher" languagecode="1033" />
      </LocalizedNames>
      <Descriptions />
      <EMailAddress>admin@example.com</EMailAddress>
      <SupportingWebsiteUrl>https://github.com/NZCHiLLY/connectwise-manage-mcp</SupportingWebsiteUrl>
      <CustomizationPrefix>tz</CustomizationPrefix>
      <CustomizationOptionValuePrefix>12694</CustomizationOptionValuePrefix>
      <Addresses>
        <Address>
          <AddressNumber>1</AddressNumber>
          <AddressTypeCode>1</AddressTypeCode>
          <City xsi:nil="true"></City>
          <County xsi:nil="true"></County>
          <Country xsi:nil="true"></Country>
          <Fax xsi:nil="true"></Fax>
          <FreightTermsCode xsi:nil="true"></FreightTermsCode>
          <ImportSequenceNumber xsi:nil="true"></ImportSequenceNumber>
          <Latitude xsi:nil="true"></Latitude>
          <Line1 xsi:nil="true"></Line1>
          <Line2 xsi:nil="true"></Line2>
          <Line3 xsi:nil="true"></Line3>
          <Longitude xsi:nil="true"></Longitude>
          <Name xsi:nil="true"></Name>
          <PostalCode xsi:nil="true"></PostalCode>
          <PostOfficeBox xsi:nil="true"></PostOfficeBox>
          <PrimaryContactName xsi:nil="true"></PrimaryContactName>
          <ShippingMethodCode>1</ShippingMethodCode>
          <StateOrProvince xsi:nil="true"></StateOrProvince>
          <Telephone1 xsi:nil="true"></Telephone1>
          <Telephone2 xsi:nil="true"></Telephone2>
          <Telephone3 xsi:nil="true"></Telephone3>
          <TimeZoneRuleVersionNumber xsi:nil="true"></TimeZoneRuleVersionNumber>
          <UPSZone xsi:nil="true"></UPSZone>
          <UTCOffset xsi:nil="true"></UTCOffset>
          <UTCConversionTimeZoneCode xsi:nil="true"></UTCConversionTimeZoneCode>
        </Address>
        <Address>
          <AddressNumber>2</AddressNumber>
          <AddressTypeCode>1</AddressTypeCode>
          <City xsi:nil="true"></City>
          <County xsi:nil="true"></County>
          <Country xsi:nil="true"></Country>
          <Fax xsi:nil="true"></Fax>
          <FreightTermsCode xsi:nil="true"></FreightTermsCode>
          <ImportSequenceNumber xsi:nil="true"></ImportSequenceNumber>
          <Latitude xsi:nil="true"></Latitude>
          <Line1 xsi:nil="true"></Line1>
          <Line2 xsi:nil="true"></Line2>
          <Line3 xsi:nil="true"></Line3>
          <Longitude xsi:nil="true"></Longitude>
          <Name xsi:nil="true"></Name>
          <PostalCode xsi:nil="true"></PostalCode>
          <PostOfficeBox xsi:nil="true"></PostOfficeBox>
          <PrimaryContactName xsi:nil="true"></PrimaryContactName>
          <ShippingMethodCode>1</ShippingMethodCode>
          <StateOrProvince xsi:nil="true"></StateOrProvince>
          <Telephone1 xsi:nil="true"></Telephone1>
          <Telephone2 xsi:nil="true"></Telephone2>
          <Telephone3 xsi:nil="true"></Telephone3>
          <TimeZoneRuleVersionNumber xsi:nil="true"></TimeZoneRuleVersionNumber>
          <UPSZone xsi:nil="true"></UPSZone>
          <UTCOffset xsi:nil="true"></UTCOffset>
          <UTCConversionTimeZoneCode xsi:nil="true"></UTCConversionTimeZoneCode>
        </Address>
      </Addresses>
    </Publisher>
    <RootComponents>
      <RootComponent type="380" schemaName="$SCHEMA" behavior="0" />
    </RootComponents>
    <MissingDependencies />
  </SolutionManifest>
</ImportExportXml>
"@
[System.IO.File]::WriteAllText("$tmpDir\solution.xml", $solXml, [System.Text.Encoding]::UTF8)

# --- customizations.xml — no connectors, no connection references ---
$custXml = @"
<ImportExportXml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" OrganizationVersion="9.2.26042.168" OrganizationSchemaType="Standard" CRMServerServiceabilityVersion="9.2.26042.00168">
  <Entities></Entities>
  <Roles></Roles>
  <Workflows></Workflows>
  <FieldSecurityProfiles></FieldSecurityProfiles>
  <Templates />
  <EntityMaps />
  <EntityRelationships />
  <OrganizationSettings />
  <optionsets />
  <CustomControls />
  <EntityDataProviders />
  <Connectors />
  <connectionreferences />
  <Languages>
    <Language>1033</Language>
  </Languages>
</ImportExportXml>
"@
[System.IO.File]::WriteAllText("$tmpDir\customizations.xml", $custXml, [System.Text.Encoding]::UTF8)

# --- [Content_Types].xml ---
$ct = "<?xml version=""1.0"" encoding=""utf-8""?><Types xmlns=""http://schemas.openxmlformats.org/package/2006/content-types"">" +
      "<Default Extension=""xml"" ContentType=""application/octet-stream"" />" +
      "<Default Extension=""json"" ContentType=""application/octet-stream"" />" +
      "<Default Extension=""Png"" ContentType=""application/octet-stream"" />" +
      ($contentOverrides -join '') +
      "</Types>"
[System.IO.File]::WriteAllText("$tmpDir\[Content_Types].xml", $ct, $utf8NoBom)

# --- Package ZIP using ZipArchive (forward-slash entry paths) ---
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = "$outputDir\CWKnowledgeBase.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
$zipStream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
$zip = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
try {
    Get-ChildItem -Recurse -File $tmpDir | ForEach-Object {
        $relPath = $_.FullName.Substring($tmpDir.Length + 1).Replace('\', '/')
        $entry = $zip.CreateEntry($relPath, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $fileStream  = [System.IO.File]::OpenRead($_.FullName)
        try   { $fileStream.CopyTo($entryStream) }
        finally { $fileStream.Dispose(); $entryStream.Dispose() }
    }
} finally {
    $zip.Dispose()
    $zipStream.Dispose()
}
Remove-Item -Recurse -Force $tmpDir
Write-Host "  Built: $zipPath" -ForegroundColor Green

if ($DryRun) {
    Write-Host "(DryRun - skipping Power Platform import)"
    exit 0
}

# ---------------------------------------------------------------------------
# Step 4: Pre-create bot entity in Dataverse (idempotent)
# ---------------------------------------------------------------------------

Write-Host "`n=== Step 4: Pre-create bot entity ===" -ForegroundColor Cyan

$existing = (Invoke-RestMethod -Uri "$dvUrl/api/data/v9.2/bots?`$select=botid&`$filter=schemaname eq '$SCHEMA'" -Headers $dvHdrs -Method Get).value
if ($existing.Count -gt 0) {
    Write-Host "  Already exists: $DISPLAY"
} else {
    $body = @{
        name                  = $DISPLAY
        schemaname            = $SCHEMA
        authenticationmode    = 2
        authenticationtrigger = 1
        language              = 2057
        runtimeprovider       = 0
        template              = "default-2.1.0"
    } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri "$dvUrl/api/data/v9.2/bots" -Headers $dvHdrs -Method Post -Body $body | Out-Null
        Write-Host "  Created: $DISPLAY" -ForegroundColor Green
    } catch {
        Write-Warning "  $($_.ErrorDetails.Message)"
    }
}

# ---------------------------------------------------------------------------
# Step 5: Import solution
# ---------------------------------------------------------------------------

Write-Host "`n=== Step 5: Import solution ===" -ForegroundColor Cyan
& $pac solution import --path $zipPath --skip-dependency-check --publish-changes --async

# ---------------------------------------------------------------------------
# Step 6: Patch gpt.default data (solution import skips binary data for existing bots)
# ---------------------------------------------------------------------------

Write-Host "`n=== Step 6: Patch agent instructions ===" -ForegroundColor Cyan
$yamlContent = [System.IO.File]::ReadAllText($YAML_FILE, [System.Text.Encoding]::UTF8)
$bcUrl = "$dvUrl/api/data/v9.2/botcomponents?`$select=botcomponentid&`$filter=schemaname eq '$SCHEMA.gpt.default'"
$bc = (Invoke-RestMethod -Uri $bcUrl -Headers $dvHdrs -Method Get).value
if ($bc.Count -eq 0) {
    Write-Warning "  gpt.default not found for $SCHEMA — import may still be processing. Re-run with step 6 manually."
} else {
    $patchBody = @{ data = $yamlContent } | ConvertTo-Json
    Invoke-RestMethod -Uri "$dvUrl/api/data/v9.2/botcomponents($($bc[0].botcomponentid))" `
        -Headers ($dvHdrs + @{ "If-Match" = "*" }) -Method Patch -Body $patchBody | Out-Null
    Write-Host "  Patched: $DISPLAY" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Step 7: Publish
# ---------------------------------------------------------------------------

Write-Host "`n=== Step 7: Publish ===" -ForegroundColor Cyan
$botRow = (Invoke-RestMethod -Uri "$dvUrl/api/data/v9.2/bots?`$select=botid&`$filter=schemaname eq '$SCHEMA'" -Headers $dvHdrs -Method Get).value
if ($botRow.Count -eq 0) {
    Write-Warning "  Bot not found — import may still be in progress. Run manually: pac copilot publish --bot <guid>"
} else {
    $botGuid = $botRow[0].botid
    Write-Host "  Publishing $DISPLAY ($botGuid)..."
    $pubOut = (& $pac copilot publish --bot $botGuid 2>&1) -join " "
    if ($pubOut -match "Succeeded") {
        Write-Host "  Published." -ForegroundColor Green
    } else {
        Write-Host "  WARN: $pubOut"
    }
}

Write-Host "`nDone. https://copilotstudio.microsoft.com" -ForegroundColor Green
Write-Host ""
Write-Host "Next: bind the connection reference in make.powerapps.com"
Write-Host "  Solutions -> CW Knowledge Base -> Connection References -> edit -> select connection -> save"
Write-Host "  Then add the 'Knowledge Base' action to the agent (InvokeKnowledgeBase operation)"
