<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\TenantController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\PermissionController;

// Rutas públicas: NO requieren tenant ni autenticación
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login',    [AuthController::class, 'login']);

// Rutas protegidas: requieren autenticación y TENANT
Route::middleware(['auth:sanctum', 'identify.tenant'])->group(function () {

    // Info del usuario autenticado
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Cerrar sesión
    Route::post('/logout', [AuthController::class, 'logout']);

    // CRUD de usuarios (filtrados por tenant)
    Route::apiResource('users', UserController::class);

    // CRUD de empresas (tenants)
    Route::apiResource('tenants', TenantController::class);

    // CRUD de roles
    Route::apiResource('roles', RoleController::class);

    // Endpoint para asignar permisos a un rol (edición masiva)
    Route::post('roles/{role}/permissions', [RoleController::class, 'setPermissions'])
         ->name('roles.setPermissions');

    // CRUD de permisos
    Route::apiResource('permissions', PermissionController::class);
});
