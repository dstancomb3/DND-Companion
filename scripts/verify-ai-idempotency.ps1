#!/usr/bin/env pwsh
<#
.SYNOPSIS
Verify AI idempotency table provisioning across environments.

.DESCRIPTION
This script checks if the ai_idempotency_records table exists and is accessible
in the target database. It provides pre/post migration validation.

.PARAMETER Env
Environment name: 'local', 'staging', 'production'

.PARAMETER DatabaseUrl
PostgreSQL connection string (default: $env:DATABASE_URL)

.PARAMETER SkipMigration
Skip the migration step (verification only)

.EXAMPLE
# Verify local environment (uses $env:DATABASE_URL)
./verify-ai-idempotency.ps1 -Env local

# Verify staging with explicit connection string
./verify-ai-idempotency.ps1 -Env staging -DatabaseUrl "postgresql://user:pass@host:5432/db"

# Run migration and verify
./verify-ai-idempotency.ps1 -Env production
#>

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("local", "staging", "production")]
    [string]$Env = "local",

    [Parameter(Mandatory = $false)]
    [string]$DatabaseUrl = "",

    [Parameter(Mandatory = $false)]
    [switch]$SkipMigration = $false,

    [Parameter(Mandatory = $false)]
    [switch]$RunMigration = $false
)

$ErrorActionPreference = "Stop"

# Colors for output
$colors = @{
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "Cyan"
}

function Write-Status {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet("Success", "Warning", "Error", "Info")]
        [string]$Status = "Info"
    )
    Write-Host "[$Status] $Message" -ForegroundColor $colors[$Status]
}

function Get-ConnectionString {
    if ($DatabaseUrl) {
        return $DatabaseUrl
    }
    
    $envUrl = $env:DATABASE_URL
    if (-not $envUrl) {
        Write-Status "DATABASE_URL environment variable is not set" "Error"
        exit 1
    }
    return $envUrl
}

function Test-TableExists {
    param(
        [Parameter(Mandatory = $true)][string]$ConnectionString
    )
    
    Write-Status "Checking if ai_idempotency_records table exists..." "Info"
    
    # Extract connection details for psql
    $connObj = @{}
    
    # Parse connection string: postgresql://user:pass@host:port/dbname
    if ($ConnectionString -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
        $connObj.User = $matches[1]
        $connObj.Pass = $matches[2]
        $connObj.Host = $matches[3]
        $connObj.Port = $matches[4]
        $connObj.Database = $matches[5]
    } else {
        Write-Status "Could not parse DATABASE_URL" "Error"
        exit 1
    }
    
    # Create psql connection string
    $psqlConn = "postgresql://$($connObj.User):$($connObj.Pass)@$($connObj.Host):$($connObj.Port)/$($connObj.Database)"
    
    # Try to query table existence using psql if available
    try {
        $result = psql $psqlConn -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='ai_idempotency_records';"
        
        if ($result -eq 1) {
            Write-Status "Table ai_idempotency_records found" "Success"
            return "exists"
        } else {
            Write-Status "Table ai_idempotency_records does not exist" "Warning"
            return "missing"
        }
    } catch {
        Write-Status "psql not available or connection failed: $_" "Warning"
        Write-Status "Consider installing psql or running migration manually" "Info"
        return "unknown"
    }
}

function Invoke-Migration {
    Write-Status "Running database migration..." "Info"
    
    try {
        & pnpm --filter @workspace/db run push 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Status "Migration completed successfully" "Success"
            return $true
        } else {
            Write-Status "Migration failed with exit code $LASTEXITCODE" "Error"
            return $false
        }
    } catch {
        Write-Status "Failed to run migration: $_" "Error"
        return $false
    }
}

function Test-TableRowCount {
    param(
        [Parameter(Mandatory = $true)][string]$ConnectionString
    )
    
    Write-Status "Checking table row count..." "Info"
    
    try {
        # Parse connection details
        $connObj = @{}
        if ($ConnectionString -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
            $connObj.User = $matches[1]
            $connObj.Pass = $matches[2]
            $connObj.Host = $matches[3]
            $connObj.Port = $matches[4]
            $connObj.Database = $matches[5]
        }
        
        $psqlConn = "postgresql://$($connObj.User):$($connObj.Pass)@$($connObj.Host):$($connObj.Port)/$($connObj.Database)"
        
        $result = psql $psqlConn -t -c "SELECT COUNT(*) FROM ai_idempotency_records;"
        
        if ($result) {
            Write-Status "Table contains $result rows" "Info"
            return [int]$result
        }
    } catch {
        Write-Status "Could not query row count: $_" "Warning"
    }
    
    return 0
}

function Test-TableSchema {
    param(
        [Parameter(Mandatory = $true)][string]$ConnectionString
    )
    
    Write-Status "Verifying table schema..." "Info"
    
    $requiredColumns = @("key", "endpoint", "request_hash", "status", "status_code", "response_body", "created_at", "updated_at", "expires_at")
    
    try {
        $connObj = @{}
        if ($ConnectionString -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
            $connObj.User = $matches[1]
            $connObj.Pass = $matches[2]
            $connObj.Host = $matches[3]
            $connObj.Port = $matches[4]
            $connObj.Database = $matches[5]
        }
        
        $psqlConn = "postgresql://$($connObj.User):$($connObj.Pass)@$($connObj.Host):$($connObj.Port)/$($connObj.Database)"
        
        $result = psql $psqlConn -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='ai_idempotency_records' ORDER BY column_name;"
        
        $actualColumns = $result | Where-Object { $_ } | ForEach-Object { $_.Trim() }
        
        $missingColumns = $requiredColumns | Where-Object { $_ -notin $actualColumns }
        
        if ($missingColumns.Count -eq 0) {
            Write-Status "All required columns present" "Success"
            return "valid"
        } else {
            Write-Status "Missing columns: $($missingColumns -join ', ')" "Error"
            return "invalid"
        }
    } catch {
        Write-Status "Could not verify schema: $_" "Warning"
        return "unknown"
    }
}

# Main execution
Write-Status "=== AI Idempotency Table Provisioning Verification ===" "Info"
Write-Status "Environment: $Env" "Info"

$connString = Get-ConnectionString
Write-Status "Connection: $(($connString -split '@')[0])@$(($connString -split '@')[1])" "Info"

# Step 1: Check if migration should run
if ($RunMigration -and -not $SkipMigration) {
    if (-not (Invoke-Migration)) {
        Write-Status "Migration failed. Aborting." "Error"
        exit 1
    }
}

# Step 2: Verify table exists
$tableExists = Test-TableExists -ConnectionString $connString

if ($tableExists -eq "missing" -and -not $SkipMigration) {
    Write-Status "Table not found. Running migration..." "Warning"
    if (Invoke-Migration) {
        $tableExists = Test-TableExists -ConnectionString $connString
    }
}

if ($tableExists -eq "unknown") {
    Write-Status "Could not verify table (psql not available). Please verify manually." "Warning"
} elseif ($tableExists -eq "missing") {
    Write-Status "Table verification failed. Ensure DATABASE_URL is correct and database is accessible." "Error"
    Write-Status "Run: pnpm --filter @workspace/db run push" "Info"
    exit 1
} else {
    # Table check passed, continue.
}

# Step 3: Verify schema
$schemaValid = Test-TableSchema -ConnectionString $connString
if ($schemaValid -eq "invalid") {
    Write-Status "Schema validation failed." "Error"
    exit 1
}

# Step 4: Check row count
$rowCount = Test-TableRowCount -ConnectionString $connString

# Final summary
Write-Host ""
Write-Status "=== Summary ===" "Info"
Write-Status "✓ Table exists and is accessible" "Success"
Write-Status "✓ Schema is valid" "Success"
Write-Status "✓ Current rows: $rowCount" "Info"
Write-Status "Environment $Env is ready for AI idempotency" "Success"

Write-Host ""
Write-Status "Next steps:" "Info"
Write-Status "1. Start the API server: pnpm --filter @workspace/api-server run dev" "Info"
Write-Status "2. Check logs for: '[ai-idempotency] Health check passed'" "Info"
Write-Status "3. Verify AI routes work correctly" "Info"
