<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Permission; // Asegúrate de que este es tu modelo Permission
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException; // Para un mejor manejo de errores
use Illuminate\Support\Facades\Log; // Para logs

class PermissionController extends Controller
{
    /**
     * Lista permisos del tenant actual.
     * GET /api/permissions
     */
    public function index(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            // Aseguramos que solo se listen permisos del tenant actual
            $permissions = Permission::where('tenant_id', $tenantId)->get();
            return response()->json($permissions);
        } catch (\Throwable $e) {
            Log::error('Error fetching permissions in index', [
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Failed to fetch permissions'], 500);
        }
    }

    /**
     * Crea un nuevo permiso para el tenant actual.
     * POST /api/permissions
     */
    public function store(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            $validated = $request->validate([
                'name' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('permissions', 'name')->where(function ($query) use ($tenantId) {
                        return $query->where('tenant_id', $tenantId);
                    }),
                ],
                'description' => 'nullable|string|max:255', // <-- Validar campo description
            ]);

            $permission = Permission::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null, // <-- Guardar description
                'tenant_id' => $tenantId,
                'guard_name' => 'sanctum', // Asegúrate de que esto es siempre 'sanctum'
            ]);

            Log::info('Permission created successfully', [
                'permission_id' => $permission->id,
                'tenant_id' => $tenantId,
            ]);

            return response()->json($permission, 201);
        } catch (ValidationException $e) {
            Log::error('Validation failed during permission store', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Fallo de validación', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during permission store', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Ocurrió un error inesperado.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Muestra un permiso específico para el tenant actual.
     * GET /api/permissions/{id}
     */
    public function show(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            $permission = Permission::where('tenant_id', $tenantId)->findOrFail($id);
            return response()->json($permission);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Permission not found for this tenant.'], 404);
        } catch (\Throwable $e) {
            Log::error('Error fetching permission in show', [
                'permission_id' => $id,
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Failed to fetch permission'], 500);
        }
    }

    /**
     * Actualiza un permiso existente para el tenant actual.
     * PUT /api/permissions/{id}
     */
    public function update(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            $permission = Permission::where('tenant_id', $tenantId)->findOrFail($id);

            $validated = $request->validate([
                'name' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('permissions', 'name')->ignore($permission->id)
                        ->where(function ($query) use ($tenantId) {
                            return $query->where('tenant_id', $tenantId);
                        }),
                ],
                'description' => 'nullable|string|max:255', // <-- Validar campo description
            ]);

            $permission->update([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null, // <-- Guardar description
            ]);

            Log::info('Permission updated successfully', [
                'permission_id' => $permission->id,
                'tenant_id' => $tenantId,
            ]);

            return response()->json($permission);
        } catch (ValidationException $e) {
            Log::error('Validation failed during permission update', [
                'permission_id' => $id,
                'tenant_id' => $tenantId,
                'errors' => $e->errors(),
            ]);
            return response()->json(['error' => 'Fallo de validación', 'details' => $e->errors()], 422);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Permission not found for this tenant.'], 404);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during permission update', [
                'permission_id' => $id,
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Ocurrió un error inesperado.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Borra un permiso.
     * DELETE /api/permissions/{id}
     */
    public function destroy(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            $permission = Permission::where('tenant_id', $tenantId)->findOrFail($id);
            $permission->delete();

            Log::info('Permission deleted successfully', [
                'permission_id' => $id,
                'tenant_id' => $tenantId,
            ]);

            return response()->noContent(); // 204 No Content
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Permission not found for this tenant.'], 404);
        } catch (\Throwable $e) {
            Log::error('Error deleting permission', [
                'permission_id' => $id,
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Failed to delete permission'], 500);
        }
    }
}
