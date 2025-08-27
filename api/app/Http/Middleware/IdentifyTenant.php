<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use App\Models\Tenant;

class IdentifyTenant
{
    protected static ?string $currentTenantId = null;

    public static function getTenantId(): ?string
    {
        return self::$currentTenantId;
    }

    public static function setTenantId(?string $tenantId): void
    {
        self::$currentTenantId = $tenantId;
        // ¡CRÍTICO! Asegúrate de que estas líneas estén presentes y correctas
        config(['permission.teams' => true]);
        config(['permission.current_team_id' => $tenantId]);
        Log::info('TenantContext::setTenantId called with: ', ['tenant_id_set' => $tenantId]);
    }

    public function handle(Request $request, Closure $next)
    {
        Log::info('IdentifyTenant - Processing request.', ['path' => $request->path(), 'method' => $request->method()]);

        $user = Auth::guard('sanctum')->user();
        $tenantId = $request->header('X-Tenant-ID');

        if ($user && $user->is_global_admin) {
            self::setTenantId(null); // Global Admin no tiene tenant_id específico
            Log::info('IdentifyTenant - Global Admin detected. Bypassing tenant ID check.');
        } elseif ($tenantId) {
            Log::info('IdentifyTenant - X-Tenant-ID header raw: ', ['header' => $tenantId]);

            if ($user && !$user->is_global_admin && $user->tenant_id != $tenantId) {
                Log::warning('IdentifyTenant - Authenticated user tenant ID mismatch with X-Tenant-ID header.', [
                    'user_id' => $user->id,
                    'user_tenant_id' => $user->tenant_id,
                    'header_tenant_id' => $tenantId
                ]);
                return response()->json(['error' => 'Unauthorized: Tenant ID mismatch.'], 403);
            }

            self::setTenantId($tenantId);
            Log::info('IdentifyTenant - Tenant ID set in context and for Spatie.', ['tenant_id' => $tenantId]);
        } else {
            self::setTenantId(null); // No tenant ID proporcionado, o usuario no autenticado/global admin
            Log::info('IdentifyTenant - No Tenant ID provided or user is not authenticated/global admin. Tenant ID set to null.');
        }

        return $next($request);
    }
}
