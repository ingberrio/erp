<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController as AppUserController;
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
use App\Http\Controllers\TraceabilityEventController;
use App\Http\Controllers\RegulatoryReportController;
use App\Http\Controllers\InventoryReconciliationController; // ¡IMPORTANTE: Añadir esta línea!
use App\Http\Controllers\DiscrepancyReasonController; // ¡IMPORTANTE: Añadir esta línea!

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
    Route::get('/user', [AuthController::class, 'user']);

    // Cerrar sesión
    Route::post('/logout', [AuthController::class, 'logout']);

    // CRUD de usuarios (filtrados por tenant)
    Route::apiResource('users', AppUserController::class, ['only' => ['index', 'show', 'store', 'update', 'destroy']]);

    // NUEVA RUTA: Obtener miembros del inquilino actual
    Route::get('/tenant-members', [AppUserController::class, 'tenantMembers']);


    // CRUD de empresas (tenants)
    Route::apiResource('tenants', TenantController::class, ['only' => ['index', 'show', 'store', 'update', 'destroy']]);

    // CRUD de roles
    Route::apiResource('roles', RoleController::class);

    // Endpoint para asignar permisos a un rol (edición masiva)
    Route::post('roles/{role}/permissions', [RoleController::class, 'setPermissions'])
        ->name('roles.setPermissions');

    // CRUD de permisos
    Route::apiResource('permissions', PermissionController::class);

    // --- Módulo de Calendario (Tipo Trello) API Routes ---
    Route::apiResource('boards', BoardController::class);
    // NUEVA RUTA: Para sincronizar miembros de un tablero
    Route::post('boards/{board}/members', [BoardController::class, 'syncMembers']);

    Route::prefix('boards/{board}')->group(function () {
        Route::apiResource('lists', LListController::class)->except(['show', 'update', 'destroy']);
    });
    Route::apiResource('lists', LListController::class)->only(['show', 'update', 'destroy']);
    Route::prefix('lists/{list}')->group(function () {
        Route::apiResource('cards', CardController::class)->except(['show', 'update', 'destroy']);
        Route::put('cards/reorder', [CardController::class, 'reorderCardsInList']);
    });
    Route::apiResource('cards', CardController::class)->only(['show', 'update', 'destroy']);

    Route::post('cards/{card}/members', [CardController::class, 'syncMembers']);


    // --- MÓDULO DE CULTIVO ---
    // Facilities CRUD
    Route::apiResource('facilities', FacilityController::class, ['only' => ['index', 'show', 'store', 'update', 'destroy']]);
    Route::get('/facilities/tenant/{tenantId}', [FacilityController::class, 'getFacilitiesByTenantId']);

    // Stages CRUD (Etapas)
    Route::apiResource('stages', StageController::class);
    Route::put('stages/reorder', [StageController::class, 'reorder']); // Ruta para reordenar etapas

    // Cultivation Areas CRUD
    Route::apiResource('cultivation-areas', CultivationAreaController::class);

    // Rutas anidadas para Cultivation Areas bajo Facilities
    Route::prefix('facilities/{facility}')->group(function () {
        Route::apiResource('cultivation-areas', CultivationAreaController::class)->only(['index']);
    });

    // Rutas anidadas para Stages bajo Cultivation Areas y reordenamiento
    Route::prefix('stages/{stage}')->group(function () {
        Route::apiResource('cultivation-areas', CultivationAreaController::class)->only(['index']);
        // Nueva ruta para reordenar áreas dentro de una etapa
        Route::put('cultivation-areas/reorder', [CultivationAreaController::class, 'reorder']);
    });

    // Esto generará: GET /api/cultivation-areas/{cultivationArea}/batches
    Route::prefix('cultivation-areas/{cultivationArea}')->group(function () {
        Route::apiResource('batches', BatchController::class)->only(['index']);
    });
    
    // Batches CRUD (Rutas base para lotes: /api/batches, /api/batches/{id}, etc.)
    Route::apiResource('batches', BatchController::class);

    // Rutas de acciones específicas para lotes (split, process)
    Route::prefix('batches')->group(function () {
        // NUEVA RUTA PARA DIVIDIR LOTES
        Route::post('/{batch}/split', [BatchController::class, 'split']);

        // ¡NUEVA RUTA PARA PROCESAR UN LOTE!
        Route::post('/{batch}/process', [BatchController::class, 'process']);
    });

    // Rutas para Eventos de Trazabilidad
    // IMPORTANTE: Coloca la ruta específica 'export' ANTES del apiResource
    Route::get('traceability-events/export', [TraceabilityEventController::class, 'exportCsv']); // <--- MOVIDA AQUÍ
    Route::apiResource('traceability-events', TraceabilityEventController::class); // <--- DESPUÉS DE LA ESPECÍFICA
    Route::post('/reports/generate-ctls', [RegulatoryReportController::class, 'generateCtls']);
    
    // --- RUTAS DE RECONCILIACIÓN DE INVENTARIO (NUEVAS) ---
    // Agrega estas líneas
    Route::post('/physical-counts', [InventoryReconciliationController::class, 'storePhysicalCount']);
    Route::get('/inventory/reconciliation', [InventoryReconciliationController::class, 'index']); 
    Route::get('/discrepancy-reasons', [DiscrepancyReasonController::class, 'index']);
    
    Route::put('/inventory/discrepancies/{id}/justify', [InventoryReconciliationController::class, 'justifyDiscrepancy']);
    // Route::post('/inventory/discrepancies/{id}/adjust', [InventoryReconciliationController::class, 'adjustDiscrepancy']);


    Route::get('/test-cors', function () {
        dd(['message' => 'CORS test successful!', 'headers_sent' => headers_sent()]);
    });
});