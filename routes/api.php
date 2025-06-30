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
use App\Http\Controllers\FacilityController;
use App\Http\Controllers\StageController;
use App\Http\Controllers\CultivationAreaController;
use App\Http\Controllers\BatchController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Rutas públicas: NO requieren tenant ni autenticación
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login',    [AuthController::class, 'login']);

// Rutas protegidas: requieren autenticación (Sanctum) y TENANT
Route::middleware(['auth:sanctum', 'identify.tenant'])->group(function () {

    // Info del usuario autenticado
    Route::get('/user', function (Request $request) {
        // Asegurarse de que el usuario y el tenant se carguen si es necesario
        return $request->user()->load('tenant');
    });

    // Cerrar sesión
    Route::post('/logout', [AuthController::class, 'logout']);

    // CRUD de usuarios (filtrados por tenant)
    Route::apiResource('users', UserController::class);

    // CRUD de empresas (tenants)
    // Nota: El acceso a este recurso podría requerir permisos de super-administrador
    // Si tu aplicación es multi-tenant y los usuarios normales no deben gestionar tenants.
    Route::apiResource('tenants', TenantController::class);

    // CRUD de roles
    Route::apiResource('roles', RoleController::class);

    // Endpoint para asignar permisos a un rol (edición masiva)
    Route::post('roles/{role}/permissions', [RoleController::class, 'setPermissions'])
         ->name('roles.setPermissions');

    // CRUD de permisos
    Route::apiResource('permissions', PermissionController::class);

    // --- Módulo de Calendario (Tipo Trello) API Routes ---
    Route::apiResource('boards', BoardController::class);
    Route::prefix('boards/{board}')->group(function () {
        Route::apiResource('lists', LListController::class)->except(['show', 'update', 'destroy']);
    });
    Route::apiResource('lists', LListController::class)->only(['show', 'update', 'destroy']);
    Route::prefix('lists/{list}')->group(function () {
        Route::apiResource('cards', CardController::class)->except(['show', 'update', 'destroy']);
        Route::put('cards/reorder', [CardController::class, 'reorderCardsInList']);
    });
    Route::apiResource('cards', CardController::class)->only(['show', 'update', 'destroy']);

    // --- MÓDULO DE CULTIVO ---
    // Facilities CRUD
    Route::apiResource('facilities', FacilityController::class);

    // Stages CRUD (Etapas)
    Route::apiResource('stages', StageController::class);
    Route::put('stages/reorder', [StageController::class, 'reorder']); // Ruta para reordenar etapas

    // Cultivation Areas CRUD
    Route::apiResource('cultivation-areas', CultivationAreaController::class);
    // Rutas anidadas para Cultivation Areas bajo Facilities y Stages
    Route::prefix('facilities/{facility}')->group(function () {
        Route::apiResource('cultivation-areas', CultivationAreaController::class)->only(['index']);
    });
    Route::prefix('stages/{stage}')->group(function () {
        Route::apiResource('cultivation-areas', CultivationAreaController::class)->only(['index']);
        // Nueva ruta para reordenar áreas dentro de una etapa
        Route::put('cultivation-areas/reorder', [CultivationAreaController::class, 'reorder']);
    });

    // Batches CRUD
    Route::apiResource('batches', BatchController::class);
    // Rutas anidadas para Batches bajo Cultivation Areas
    Route::prefix('cultivation-areas/{cultivationArea}')->group(function () {
        Route::apiResource('batches', BatchController::class)->only(['index']);
    });
});
