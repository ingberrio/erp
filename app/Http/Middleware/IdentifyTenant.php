<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log; // Add this import

class IdentifyTenant
{
    public function handle(Request $request, Closure $next)
    {
        $tenantId = (int) $request->header('X-Tenant-ID');

        // Log the raw header value
        Log::info('IdentifyTenant - X-Tenant-ID header raw:', ['header' => $request->header('X-Tenant-ID')]);
        // Log the casted tenantId
        Log::info('IdentifyTenant - Calculated tenantId:', ['tenant_id_calculated' => $tenantId]);


        if (!$tenantId) {
            // If the header is missing or evaluates to 0 after casting (int),
            // we'll still log what TenantContext *would* get.
            Log::warning('IdentifyTenant - Tenant header missing or invalid, returning 401.', ['tenant_id_calculated' => $tenantId]);
            return response()->json(['message' => 'Tenant header missing (X-Tenant-ID)'], 401);
        }

        // This is the crucial line that needs to be uncommented and executed
        TenantContext::setTenantId($tenantId);
        Log::info('IdentifyTenant - TenantContext::setTenantId called with:', ['tenant_id_set' => $tenantId]);


        // You can keep this line if your logic uses it, but it's not strictly necessary for TenantContext
        $request->merge(['tenant_id' => $tenantId]);

        return $next($request);
    }
}