# create-agents.ps1 - Build and import all 18 CW PSA agents into one solution
# Run from the copilot-agents directory. Requires: pac CLI authenticated.
#
# Usage:
#   cd copilot-agents
#   .\create-agents.ps1          # build ConnectWiseConnectors.zip + import
#   .\create-agents.ps1 -DryRun  # build ZIP only, skip import

param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

$ACA_FQDN          = "YOUR-ACA-APP.YOUR-ENV-ID.australiaeast.azurecontainerapps.io"  # set to your ACA FQDN
$CONNECTOR_API     = "shared_crc0e-5fcw-2dpsa-2dmcp-2dserver-5fc458ef7842d9bb4b"   # Power Platform connector path
$CONNECTION_ID     = "YOUR-CONNECTION-ID"                                            # existing connection instance GUID
$CONNECTOR_GUID    = "YOUR-CONNECTOR-GUID"                                           # connector entity GUID
$CONNECTOR_SCHEMA  = "crc0e_5Fcw-2Dpsa-2Dmcp-2Dserver"                            # connector schema name
$CONNECTOR_FILE    = "crc0e_5Fcw-2Dpsa-2Dmcp-2Dserver"                            # filename prefix

$baseDir   = "$PSScriptRoot\ConnectWiseConnectors"
$agentsDir = "$PSScriptRoot\agents"
$outputDir = "$PSScriptRoot\solutions"
$OLD       = "tz_ConnectWisePSAHelper"
$OLD_DISP  = "ConnectWise PSA Helper"
$SOL_NAME  = "ConnectWiseConnectors"
$SOL_DISP  = "ConnectWise Connectors"

# System topics present in every agent
$systemTopics = @(
    "ConversationStart", "EndofConversation", "Escalate", "Fallback",
    "Goodbye", "Greeting", "MultipleTopicsMatched", "OnError",
    "ResetConversation", "Search", "Signin", "StartOver", "ThankYou"
)

# 18 agents — orchestrator has no MCP action; the 17 domain agents each get a scoped MCP endpoint
$allAgents = @(
    @{ Schema = "tz_CWOrchestrator";         Display = "CW PSA Orchestrator";            Yaml = "orchestrator.yaml";          Desc = "Top-level orchestrator for ConnectWise PSA - routes to domain agents"; McpAction = $false; OperationId = $null                   },
    @{ Schema = "tz_CWTickets";              Display = "CW Tickets Agent";               Yaml = "tickets.yaml";               Desc = "Service ticket management for ConnectWise PSA";                        McpAction = $true;  OperationId = "InvokeTickets"          },
    @{ Schema = "tz_CWTimeEntries";          Display = "CW Time Entries Agent";          Yaml = "time-entries.yaml";          Desc = "Time logging, timesheets, and stopwatch management";                  McpAction = $true;  OperationId = "InvokeTimeEntries"      },
    @{ Schema = "tz_CWCompanies";            Display = "CW Companies Agent";             Yaml = "companies.yaml";             Desc = "Company records, sites, and team management";                        McpAction = $true;  OperationId = "InvokeCompanies"        },
    @{ Schema = "tz_CWContacts";             Display = "CW Contacts Agent";              Yaml = "contacts.yaml";              Desc = "Contact records and communications management";                       McpAction = $true;  OperationId = "InvokeContacts"         },
    @{ Schema = "tz_CWConfigurations";       Display = "CW Configurations Agent";        Yaml = "configurations.yaml";        Desc = "Deployed asset and configuration type management";                   McpAction = $true;  OperationId = "InvokeConfigurations"   },
    @{ Schema = "tz_CWServiceBoards";        Display = "CW Service Boards Agent";        Yaml = "service-boards.yaml";        Desc = "Service board configuration: statuses, types, teams";               McpAction = $true;  OperationId = "InvokeServiceBoards"    },
    @{ Schema = "tz_CWServiceConfig";        Display = "CW Service Config Agent";        Yaml = "service-config.yaml";        Desc = "Priorities, SLAs, impacts, KB, and service configuration";          McpAction = $true;  OperationId = "InvokeServiceConfig"    },
    @{ Schema = "tz_CWSales";                Display = "CW Sales Agent";                 Yaml = "sales.yaml";                 Desc = "Sales quotes, forecasts, pipeline, and territories";                 McpAction = $true;  OperationId = "InvokeSales"            },
    @{ Schema = "tz_CWOpportunities";        Display = "CW Opportunities Agent";         Yaml = "opportunities.yaml";         Desc = "Opportunity pipeline, activities, and products";                     McpAction = $true;  OperationId = "InvokeOpportunities"    },
    @{ Schema = "tz_CWFinanceAgreements";    Display = "CW Finance Agreements Agent";    Yaml = "finance-agreements.yaml";    Desc = "Recurring revenue contracts, additions, and GL management";          McpAction = $true;  OperationId = "InvokeFinanceAgreements"},
    @{ Schema = "tz_CWFinanceInvoices";      Display = "CW Finance Invoices Agent";      Yaml = "finance-invoices.yaml";      Desc = "Invoices, payments, billing setups, and accounting";                McpAction = $true;  OperationId = "InvokeFinanceInvoices"  },
    @{ Schema = "tz_CWCatalog";              Display = "CW Catalog Agent";               Yaml = "catalog.yaml";               Desc = "Product catalog, bundles, components, and pricing";                 McpAction = $true;  OperationId = "InvokeCatalog"          },
    @{ Schema = "tz_CWProcurementOrders";    Display = "CW Procurement Orders Agent";    Yaml = "procurement-orders.yaml";    Desc = "Purchase orders, PO lines, and RMA management";                     McpAction = $true;  OperationId = "InvokeProcurementOrders"},
    @{ Schema = "tz_CWProcurementInventory"; Display = "CW Procurement Inventory Agent"; Yaml = "procurement-inventory.yaml"; Desc = "Warehouses, bins, pricing schedules, and adjustments";              McpAction = $true;  OperationId = "InvokeProcurementInventory"},
    @{ Schema = "tz_CWSystemMembers";        Display = "CW System Members Agent";        Yaml = "system-members.yaml";        Desc = "Members, API keys, security roles, and departments";                McpAction = $true;  OperationId = "InvokeSystemMembers"    },
    @{ Schema = "tz_CWSystemAdmin";          Display = "CW System Admin Agent";          Yaml = "system-admin.yaml";          Desc = "Audit trail, reports, KPIs, workflows, and system info";            McpAction = $true;  OperationId = "InvokeSystemAdmin"      },
    @{ Schema = "tz_CWScheduleExpenses";     Display = "CW Schedule and Expenses Agent"; Yaml = "schedule-expenses.yaml";     Desc = "Schedule entries, calendars, and expense management";               McpAction = $true;  OperationId = "InvokeScheduleExpenses" }
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
# Staging
# ---------------------------------------------------------------------------

New-Item -ItemType Directory -Force $outputDir | Out-Null

$tmpDir = "$outputDir\_tmp_$SOL_NAME"
if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
Copy-Item -Recurse -Force $baseDir $tmpDir

# Strip unneeded directories (Connector excluded from solution — already in environment)
Remove-Item -Recurse -Force "$tmpDir\Connector"      -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$tmpDir\Assets"         -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$tmpDir\dvtablesearchs"  -ErrorAction SilentlyContinue

# Remove OLD bot directory and ALL OLD botcomponents (we add clean ones below)
Remove-Item -Recurse -Force "$tmpDir\bots\$OLD"     -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$tmpDir\botcomponents"
New-Item -ItemType Directory -Force "$tmpDir\botcomponents" | Out-Null

# ---------------------------------------------------------------------------
# Build per-agent content
# ---------------------------------------------------------------------------

$rootComponents     = [System.Collections.Generic.List[string]]::new()
$contentOverrides   = [System.Collections.Generic.List[string]]::new()
$connectionRefs     = [System.Collections.Generic.List[string]]::new()

# Connector is already in the environment — not re-imported, not added to RootComponents

$utf8NoBom = New-Object System.Text.UTF8Encoding $false

foreach ($a in $allAgents) {
    $s    = $a.Schema
    $disp = $a.Display
    $desc = $a.Desc

    Write-Host "Staging: $disp ($s)"

    # --- Bot directory ---
    $botDst = "$tmpDir\bots\$s"
    Copy-Item -Recurse -Force "$baseDir\bots\$OLD" $botDst
    Get-ChildItem -Recurse -File $botDst | Where-Object { $_.Extension -in @('.xml', '.json') } | ForEach-Object {
        $raw = [System.IO.File]::ReadAllText($_.FullName)
        $upd = $raw -replace [regex]::Escape($OLD), $s
        $upd = $upd -replace [regex]::Escape($OLD_DISP), $disp
        if ($upd -ne $raw) { [System.IO.File]::WriteAllText($_.FullName, $upd, $utf8NoBom) }
    }

    # --- System topics ---
    foreach ($topic in $systemTopics) {
        $srcDir = "$baseDir\botcomponents\$OLD.topic.$topic"
        if (-not (Test-Path $srcDir)) { continue }
        $dstDir = "$tmpDir\botcomponents\$s.topic.$topic"
        Copy-Item -Recurse -Force $srcDir $dstDir
        Get-ChildItem -Recurse -File $dstDir | Where-Object { $_.Extension -eq '.xml' -or $_.Name -eq 'data' } | ForEach-Object {
            $raw = [System.IO.File]::ReadAllText($_.FullName)
            $upd = $raw -replace [regex]::Escape($OLD), $s
            if ($upd -ne $raw) { [System.IO.File]::WriteAllText($_.FullName, $upd, $utf8NoBom) }
        }
        $contentOverrides.Add("<Override PartName=""/botcomponents/$s.topic.$topic/data"" ContentType=""application/octet-stream"" />")
    }

    # --- gpt.default ---
    $gptDst = "$tmpDir\botcomponents\$s.gpt.default"
    Copy-Item -Recurse -Force "$baseDir\botcomponents\$OLD.gpt.default" $gptDst
    $bcPath = "$gptDst\botcomponent.xml"
    $bc = [System.IO.File]::ReadAllText($bcPath)
    $bc = $bc -replace [regex]::Escape($OLD), $s
    $bc = $bc -replace [regex]::Escape($OLD_DISP), $disp
    $bc = $bc -replace '(?s)<description>.*?</description>', "<description>$desc</description>"
    [System.IO.File]::WriteAllText($bcPath, $bc, $utf8NoBom)
    Copy-Item -Force "$agentsDir\$($a.Yaml)" "$gptDst\data"
    $contentOverrides.Add("<Override PartName=""/botcomponents/$s.gpt.default/data"" ContentType=""application/octet-stream"" />")

    # --- MCP action botcomponent (domain agents only) ---
    if ($a.McpAction) {
        $connRef = "$s.$CONNECTOR_API.$CONNECTION_ID"
        $actionSchema = "$s.action.cw-psa-mcp-server-cw-psa-mcp-server"
        $actionDir = "$tmpDir\botcomponents\$actionSchema"
        New-Item -ItemType Directory -Force $actionDir | Out-Null

        # botcomponent.xml
        $actionBc = @"
<botcomponent schemaname="$actionSchema">
  <componenttype>9</componenttype>
  <iscustomizable>0</iscustomizable>
  <name>cw-psa-mcp-server - cw-psa-mcp-server</name>
  <parentbotid>
    <schemaname>$s</schemaname>
  </parentbotid>
  <statecode>0</statecode>
  <statuscode>1</statuscode>
</botcomponent>
"@
        [System.IO.File]::WriteAllText("$actionDir\botcomponent.xml", $actionBc, $utf8NoBom)

        # data (YAML action definition)
        $actionData = @"
kind: TaskDialog
modelDisplayName: ConnectWise PSA
modelDescription: ConnectWise Manage PSA integration via MCP
action:
  kind: InvokeExternalAgentTaskAction
  connectionReference: $connRef
  connectionProperties:
    mode: Invoker
  operationDetails:
    kind: ModelContextProtocolMetadata
    operationId: $($a.OperationId)
"@
        [System.IO.File]::WriteAllText("$actionDir\data", $actionData, $utf8NoBom)
        $contentOverrides.Add("<Override PartName=""/botcomponents/$actionSchema/data"" ContentType=""application/octet-stream"" />")

        # Connection reference entry for customizations.xml
        $connectionRefs.Add(@"
    <connectionreference connectionreferencelogicalname="$connRef">
      <connectionreferencedisplayname>$connRef</connectionreferencedisplayname>
      <connectorid>/providers/Microsoft.PowerApps/apis/$CONNECTOR_API</connectorid>
      <customconnectorid>
        <connectorid>$CONNECTOR_GUID</connectorid>
      </customconnectorid>
      <iscustomizable>0</iscustomizable>
      <promptingbehavior>0</promptingbehavior>
      <statecode>0</statecode>
      <statuscode>1</statuscode>
    </connectionreference>
"@)
    }

    # RootComponent for this bot (type 380)
    $rootComponents.Add("    <RootComponent type=""380"" schemaName=""$s"" behavior=""0"" />")
}

# ---------------------------------------------------------------------------
# Update manifests
# ---------------------------------------------------------------------------

Write-Host "`nUpdating solution manifests..."

# solution.xml — connector + 18 bots in RootComponents
$solXml = [System.IO.File]::ReadAllText("$tmpDir\solution.xml")
$solXml = $solXml -replace '(?s)<RootComponents>.*?</RootComponents>', "<RootComponents>`n$($rootComponents -join "`n")`n  </RootComponents>"
$solXml = $solXml -replace 'description="[^"]*"', "description=""$SOL_DISP"""
[System.IO.File]::WriteAllText("$tmpDir\solution.xml", $solXml, [System.Text.Encoding]::UTF8)

# customizations.xml — strip all connector definitions (not in package), inject connection references
$custXml = [System.IO.File]::ReadAllText("$tmpDir\customizations.xml")
$custXml = $custXml -replace '(?s)<Connectors>.*?</Connectors>', '<Connectors />'

# Inject connection references for all 17 domain agents
$connRefsBlock = $connectionRefs -join ""
$custXml = $custXml -replace '(?s)<connectionreferences>.*?</connectionreferences>', "<connectionreferences>`n${connRefsBlock}`n  </connectionreferences>"
[System.IO.File]::WriteAllText("$tmpDir\customizations.xml", $custXml, [System.Text.Encoding]::UTF8)

# [Content_Types].xml — rebuild with all entries
$ct = "<?xml version=""1.0"" encoding=""utf-8""?><Types xmlns=""http://schemas.openxmlformats.org/package/2006/content-types"">" +
      "<Default Extension=""xml"" ContentType=""application/octet-stream"" />" +
      "<Default Extension=""json"" ContentType=""application/octet-stream"" />" +
      "<Default Extension=""Png"" ContentType=""application/octet-stream"" />" +
      ($contentOverrides -join '') +
      "</Types>"
[System.IO.File]::WriteAllText("$tmpDir\[Content_Types].xml", $ct, [System.Text.Encoding]::UTF8)

# ---------------------------------------------------------------------------
# Package
# ---------------------------------------------------------------------------

$zipPath = "$outputDir\$SOL_NAME.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

# Use ZipArchive directly so entry names use forward slashes — Compress-Archive
# writes backslash paths on Windows which causes [Content_Types].xml PartName
# mismatches, silently skipping botcomponent data files during solution import.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
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

$actionCount = ($allAgents | Where-Object { $_.McpAction }).Count
Write-Host "Built: $zipPath"
Write-Host "  18 agents | $($rootComponents.Count) bots in RootComponents | $actionCount MCP actions | $($contentOverrides.Count) content entries"

if ($DryRun) {
    Write-Host "(DryRun - skipping import)"
    exit 0
}

# ---------------------------------------------------------------------------
# Pre-create bots (solution import can't create NEW bots — only update existing)
# ---------------------------------------------------------------------------

Write-Host "`nPre-creating bot entities in Dataverse..."
$dvUrl   = "https://YOUR-ORG.crm6.dynamics.com"  # set to your Dataverse environment URL
$dvToken = (& az account get-access-token --resource $dvUrl --query accessToken --output tsv 2>&1)
$dvHdrs  = @{
    Authorization      = "Bearer $dvToken"
    "OData-MaxVersion" = "4.0"
    "OData-Version"    = "4.0"
    "Content-Type"     = "application/json"
    Accept             = "application/json"
}

foreach ($a in $allAgents) {
    $existing = (Invoke-RestMethod -Uri "$dvUrl/api/data/v9.2/bots?`$select=botid&`$filter=schemaname eq '$($a.Schema)'" -Headers $dvHdrs -Method Get).value
    if ($existing.Count -gt 0) {
        Write-Host "  Exists: $($a.Display)"
        continue
    }
    $body = @{
        name                  = $a.Display
        schemaname            = $a.Schema
        authenticationmode    = 2
        authenticationtrigger = 1
        language              = 2057
        runtimeprovider       = 0
        template              = "default-2.1.0"
    } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri "$dvUrl/api/data/v9.2/bots" -Headers $dvHdrs -Method Post -Body $body | Out-Null
        Write-Host "  Created: $($a.Display)"
    } catch {
        Write-Host "  WARN: $($a.Display) - $($_.ErrorDetails.Message)"
    }
}

# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------

Write-Host "`nImporting ConnectWise Connectors solution..."
& $pac solution import --path $zipPath --skip-dependency-check --publish-changes --async

# ---------------------------------------------------------------------------
# Patch gpt.default data fields (solution import skips binary data for existing bots)
# ---------------------------------------------------------------------------

Write-Host "`nPatching agent instructions (gpt.default data fields)..."
foreach ($a in $allAgents) {
    $s = $a.Schema
    $yamlPath = "$agentsDir\$($a.Yaml)"
    if (-not (Test-Path $yamlPath)) { Write-Host "  SKIP (no yaml): $s"; continue }
    $yamlContent = [System.IO.File]::ReadAllText($yamlPath, [System.Text.Encoding]::UTF8)

    # Find the botcomponent id
    $bcUrl = "$dvUrl/api/data/v9.2/botcomponents?`$select=botcomponentid&`$filter=schemaname eq '$s.gpt.default'"
    $bc = (Invoke-RestMethod -Uri $bcUrl -Headers $dvHdrs -Method Get).value
    if ($bc.Count -eq 0) { Write-Host "  NOT FOUND: $s.gpt.default"; continue }

    $patchBody = @{ data = $yamlContent } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri "$dvUrl/api/data/v9.2/botcomponents($($bc[0].botcomponentid))" `
            -Headers ($dvHdrs + @{ "If-Match" = "*" }) -Method Patch -Body $patchBody | Out-Null
        Write-Host "  Patched: $($a.Display)"
    } catch {
        Write-Host "  WARN patch: $($a.Display) - $($_.ErrorDetails.Message)"
    }
}

# ---------------------------------------------------------------------------
# Publish all bots (registers connection references with Copilot Studio backend)
# pac copilot publish must run after import — solution import alone does not
# register the bot's connection references in the backend service.
# ---------------------------------------------------------------------------

Write-Host "`nPublishing agents via pac copilot publish..."
foreach ($a in $allAgents) {
    $botRow = (Invoke-RestMethod -Uri "$dvUrl/api/data/v9.2/bots?`$select=botid&`$filter=schemaname eq '$($a.Schema)'" -Headers $dvHdrs -Method Get).value
    if ($botRow.Count -eq 0) { Write-Host "  NOT FOUND: $($a.Display)"; continue }
    $botGuid = $botRow[0].botid
    Write-Host "  Publishing: $($a.Display) ($botGuid)..."
    $pubOut = (& $pac copilot publish --bot $botGuid 2>&1) -join " "
    if ($pubOut -match "Succeeded") {
        Write-Host "    OK"
    } else {
        Write-Host "    WARN: $pubOut"
    }
}

# ---------------------------------------------------------------------------
# Patch connectionid on all connection references
# Solution import creates connectionreference entities but leaves connectionid
# empty — Copilot Studio cannot invoke tools until this field is populated.
# ---------------------------------------------------------------------------

Write-Host "`nPatching connection references (connectionid)..."
$connRefFilter = "contains(connectionreferencelogicalname,'$CONNECTION_ID')"
$connRefs = (Invoke-RestMethod -Uri "$dvUrl/api/data/v9.2/connectionreferences?`$select=connectionreferenceid,connectionreferencelogicalname,connectionid&`$filter=$connRefFilter" -Headers $dvHdrs -Method Get).value
if ($connRefs.Count -eq 0) {
    Write-Host "  WARN: No connection references found matching connection ID $CONNECTION_ID"
} else {
    $patchBody = @{ connectionid = $CONNECTION_ID } | ConvertTo-Json
    foreach ($ref in $connRefs) {
        if ($ref.connectionid -eq $CONNECTION_ID) {
            Write-Host "  Already set: $($ref.connectionreferencelogicalname)"
            continue
        }
        try {
            Invoke-RestMethod -Uri "$dvUrl/api/data/v9.2/connectionreferences($($ref.connectionreferenceid))" `
                -Headers ($dvHdrs + @{ "If-Match" = "*" }) -Method Patch -Body $patchBody | Out-Null
            Write-Host "  Patched: $($ref.connectionreferencelogicalname)"
        } catch {
            Write-Host "  WARN: $($ref.connectionreferencelogicalname) - $($_.ErrorDetails.Message)"
        }
    }
}

Write-Host "`nDone. Verify at: https://copilotstudio.microsoft.com"
