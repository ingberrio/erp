<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\TenantController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\BoardController;
use App\Http\Controllers\LListController;
use App\Http\Controllers\CardController;

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

    // --- Módulo de Calendario (Tipo Trello) API Routes ---
    // Boards CRUD (Tableros principales del calendario/proyecto)
    Route::apiResource('boards', BoardController::class);

    // Lists CRUD (Columnas/listas dentro de un tablero) - Rutas anidadas y singulares
    Route::prefix('boards/{board}')->group(function () {
        // Rutas para crear y listar listas dentro de un tablero específico
        Route::apiResource('lists', LListController::class)->except(['show', 'update', 'destroy']);
    });
    // Rutas para mostrar, actualizar y eliminar una lista individual
    Route::apiResource('lists', LListController::class)->only(['show', 'update', 'destroy']);

    // Cards CRUD (Tarjetas/tareas dentro de una lista) - Rutas anidadas y singulares
    Route::prefix('lists/{list}')->group(function () {
        // Rutas para crear y listar tarjetas dentro de una lista específica
        Route::apiResource('cards', CardController::class)->except(['show', 'update', 'destroy']);
        // AÑADIR LA RUTA DE REORDENAR AQUÍ, DENTRO DEL PREFIJO DE LISTA
        // Esto asegura que {list} esté disponible en el controlador
        Route::put('cards/reorder', [CardController::class, 'reorderCardsInList']); // Cambiado a PUT y nombre de método diferente
    });
    // Rutas para mostrar, actualizar y eliminar una tarjeta individual
    Route::apiResource('cards', CardController::class)->only(['show', 'update', 'destroy']);

    // ELIMINAR ESTA RUTA GLOBAL DUPLICADA:
    // Route::post('cards/reorder', [CardController::class, 'reorder']); // <-- ¡ELIMINAR ESTA LÍNEA!
});
