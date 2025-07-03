<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use App\Models\Tenant; // Asegúrate de importar tu modelo Tenant

class IdentifyTenant
{
    /**
     * Almacena el tenant ID identificado para acceso global (por ejemplo, desde scopes).
     * @var string|null
     */
    protected static ?string $currentTenantId = null;

    /**
     * Obtiene el tenant ID actualmente identificado.
     *
     * @return string|null
     */
    public static function getTenantId(): ?string
    {
        return self::$currentTenantId;
    }

    /**
     * Establece el tenant ID en el contexto y para Spatie.
     *
     * @param string|null $tenantId
     */
    public static function setTenantId(?string $tenantId): void
    {
        self::$currentTenantId = $tenantId;
        // Si usas Spatie con equipos, esto es crucial
        config(['permission.teams' => true]);
        config(['permission.current_team_id' => $tenantId]);
        Log::info('TenantContext::setTenantId called with: ', ['tenant_id_set' => $tenantId]);
    }

    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        Log::info('IdentifyTenant - Processing request.', ['path' => $request->path(), 'method' => $request->method()]);

        $user = Auth::guard('sanctum')->user();
        $tenantId = $request->header('X-Tenant-ID');

        if ($user && $user->is_global_admin) {
            // Si es un administrador global, no hay tenant_id específico.
            // Establecemos el tenant_id en null para indicar acceso global.
            self::setTenantId(null);
            Log::info('IdentifyTenant - Global Admin detected. Bypassing tenant ID check.');
        } elseif ($tenantId) {
            // Si hay un X-Tenant-ID en el header, úsalo.
            // Primero, logueamos el valor raw del header para depuración
            Log::info('IdentifyTenant - X-Tenant-ID header raw: ', ['header' => $tenantId]);

            // Opcional: Validar que el tenantId del header existe en la base de datos
            // $tenantExists = Tenant::where('id', $tenantId)->exists();
            // if (!$tenantExists) {
            //     Log::warning('IdentifyTenant - Provided X-Tenant-ID does not exist.', ['tenant_id' => $tenantId]);
            //     return response()->json(['error' => 'Invalid Tenant ID provided.'], 400);
            // }

            // Si el usuario está autenticado y no es global admin,
            // verificar que el tenant_id del usuario coincide con el del header.
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
            // Si no hay usuario global admin ni X-Tenant-ID,
            // el tenant_id es null (para rutas públicas o no autenticadas que no requieren tenant).
            self::setTenantId(null);
            Log::info('IdentifyTenant - No Tenant ID provided or user is not authenticated/global admin. Tenant ID set to null.');
        }

        return $next($request);
    }
}
