<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\TenantContext;
use Closure;
use Illuminate\Http\Request;

class IdentifyTenant
{
    public function handle(Request $request, Closure $next)
    {
        $tenantId = (int) $request->header('X-Tenant-ID', 0);
        if ($tenantId) {
            TenantContext::setTenantId($tenantId);
        }

        return $next($request);
    }
}
