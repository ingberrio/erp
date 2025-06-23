<?php

namespace App\Http\Middleware;

use App\TenantContext; // Assuming this is your custom context class
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Spatie\Permission\PermissionRegistrar; // <-- Make sure this is imported

class IdentifyTenant
{
    public function handle(Request $request, Closure $next)
    {
        $tenantId = (int) $request->header('X-Tenant-ID');

        Log::info('IdentifyTenant - X-Tenant-ID header raw:', ['header' => $request->header('X-Tenant-ID')]);
        Log::info('IdentifyTenant - Calculated tenantId:', ['tenant_id_calculated' => $tenantId]);

        if (!$tenantId) {
            Log::warning('IdentifyTenant - Tenant header missing or invalid, returning 401.', ['tenant_id_calculated' => $tenantId]);
            return response()->json(['message' => 'Tenant header missing (X-Tenant-ID)'], 401);
        }

        // --- THE CRITICAL LINE FOR SPATIE ---
        // This tells Spatie which "team" (tenant) is currently active.
        app(PermissionRegistrar::class)->setPermissionsTeamId($tenantId);
        Log::info('IdentifyTenant - Spatie Permission team ID set to:', ['spatie_team_id' => $tenantId]);
        // --- END OF SPATIE ADDITION ---


        // Your existing custom tenant context setting
        TenantContext::setTenantId($tenantId);
        Log::info('IdentifyTenant - TenantContext::setTenantId called with:', ['tenant_id_set' => $tenantId]);

        return $next($request);
    }
}