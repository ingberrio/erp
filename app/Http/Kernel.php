<?php

namespace App\Http;

use Illuminate\Foundation\Http\Kernel as HttpKernel;

class Kernel extends HttpKernel
{
    /**
     * The application's global HTTP middleware stack.
     *
     * These middleware are run during every request to your application.
     *
     * @var array<int, class-string|string>
     */
    protected $middleware = [
        \Illuminate\Http\Middleware\HandleCors::class,
        \Illuminate\Http\Middleware\PreventRequestsDuringMaintenance::class,
        \Illuminate\Foundation\Http\Middleware\ValidatePostSize::class,
        \App\Http\Middleware\TrimStrings::class,
        \Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull::class,
        // ¡IMPORTANTE! IdentifyTenant y SetTenantForPermissions NO deben ir aquí
        // si dependen de un usuario autenticado o de Sanctum.
        // Se moverán al grupo 'api'
    ];

    /**
     * The application's route middleware groups.
     *
     * @var array<string, array<int, class-string|string>>
     */
    protected $middlewareGroups = [
        'web' => [
            \App\Http\Middleware\EncryptCookies::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\View\Middleware\ShareErrorsFromSession::class,
            \App\Http\Middleware\VerifyCsrfToken::class,
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ],

        'api' => [
            // 1. Sanctum para manejar el estado/cookies del frontend
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class, // <-- ¡DESCOMENTADO!
            'throttle:api',
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
            // 2. Tus middlewares de tenant, después de que Sanctum haya manejado el estado
            // y antes de 'auth:sanctum' en routes/api.php (si lo tienes allí)
            // O si 'auth:sanctum' está aquí, estos van después de 'auth:sanctum'
            \App\Http\Middleware\IdentifyTenant::class, // <-- MOVIDO AQUÍ
            \App\Http\Middleware\SetTenantForPermissions::class, // <-- MOVIDO AQUÍ
        ],
    ];

    /**
     * The application's route middleware.
     *
     * These middleware may be assigned to groups or individual routes.
     *
     * @var array<string, class-string|string>
     */
    protected $routeMiddleware = [
        'auth' => \Illuminate\Auth\Middleware\Authenticate::class, // Asumiendo que esta es la implementación estándar de Laravel
        'auth.basic' => \Illuminate\Auth\Middleware\AuthenticateWithBasicAuth::class,
        'cache.headers' => \Illuminate\Http\Middleware\SetCacheHeaders::class,
        'can' => \Illuminate\Auth\Middleware\Authorize::class,
        'guest' => \App\Http\Middleware\RedirectIfAuthenticated::class,
        'password.confirm' => \Illuminate\Auth\Middleware\RequirePassword::class,
        'signed' => \Illuminate\Routing\Middleware\ValidateSignature::class,
        'throttle' => \Illuminate\Routing\Middleware\ThrottleRequests::class,
        'verified' => \Illuminate\Auth\Middleware\EnsureEmailIsVerified::class,
        // Tus middlewares personalizados ya no necesitan estar aquí si se usan en 'api' group o directamente en Route::middleware()
        // 'identify.tenant' => \App\Http\Middleware\IdentifyTenant::class, // Ya está en el grupo 'api'
        // 'settenant.permissions' => \App\Http\Middleware\SetTenantForPermissions::class, // Ya está en el grupo 'api'
        'role' => \Spatie\Permission\Middlewares\RoleMiddleware::class, // Si usas Spatie
        'permission' => \Spatie\Permission\Middlewares\PermissionMiddleware::class, // Si usas Spatie
        'role_or_permission' => \Spatie\Permission\Middlewares\RoleOrPermissionMiddleware::class, // Si usas Spatie
    ];
}
