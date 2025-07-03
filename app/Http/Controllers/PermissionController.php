<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission; // Asegúrate de que este es tu modelo Permission
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth; // <-- ¡Añadir esta importación!

class PermissionController extends Controller
{
    /**
     * Obtiene el guard por defecto de la aplicación.
     */
    private function defaultGuard(): string
    {
        return config('auth.defaults.guard');
    }

    /**
     * Lista permisos del tenant actual o todos si es Global Admin.
     * GET /api/permissions
     */
    public function index(Request $request)
    {
        $user = Auth::guard('sanctum')->user(); // Obtener el usuario autenticado
        Log::info('PermissionController@index: Request received.', [
            'user_id' => $user->id ?? 'guest',
            'is_global_admin' => $user->is_global_admin ?? false,
            'tenant_id_from_user' => $user->tenant_id ?? 'N/A'
        ]);

        try {
            // Si el usuario es un administrador global, devolver TODOS los permisos (globales y de todos los tenants).
            if ($user && $user->is_global_admin) {
                Log::info('PermissionController@index: Global Admin detected. Fetching all permissions.');
                $permissions = Permission::all();
                return response()->json($permissions);
            }

            // Para usuarios de tenant, filtrar permisos por tenant_id
            $tenantId = $request->header('X-Tenant-ID');
            if (!$tenantId) {
                Log::warning('PermissionController@index: Tenant ID is missing for non-global admin.', ['user_id' => $user->id ?? 'N/A']);
                return response()->json(['error' => 'Tenant ID is missing.'], 400);
            }

            // Asegurarse de que el tenant_id del usuario coincide con el del header (seguridad adicional)
            if ($user && $user->tenant_id && $user->tenant_id != $tenantId) {
                Log::warning('PermissionController@index: Tenant ID mismatch between user and header.', [
                    'user_id' => $user->id,
                    'user_tenant_id' => $user->tenant_id,
                    'header_tenant_id' => $tenantId
                ]);
                return response()->json(['error' => 'Unauthorized: Tenant ID mismatch.'], 403);
            }

            Log::info('PermissionController@index: Fetching permissions for tenant.', ['tenant_id' => $tenantId]);
            $permissions = Permission::where('tenant_id', $tenantId)->get();
            return response()->json($permissions);

        } catch (\Throwable $e) {
            Log::critical('Error fetching permissions in PermissionController@index', [
                'user_id' => $user->id ?? 'N/A',
                'is_global_admin' => $user->is_global_admin ?? false,
                'tenant_id_from_header' => $request->header('X-Tenant-ID') ?? 'N/A',
                'error_message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Failed to fetch permissions due to an unexpected error.'], 500);
        }
    }

    /**
     * Crea un nuevo permiso para el tenant actual o globalmente si es Global Admin.
     * POST /api/permissions
     */
    public function store(Request $request)
    {
        $currentUser = Auth::guard('sanctum')->user();
        $guard = $this->defaultGuard();

        try {
            $validated = $request->validate([
                'name' => [
                    'required',
                    'string',
                    'max:255',
                    // La regla unique se ajustará dinámicamente
                ],
                'description' => 'nullable|string|max:255',
                'tenant_id' => 'nullable|exists:tenants,id', // Permitir tenant_id si es global admin
            ]);

            // Determinar el tenant_id para el nuevo permiso
            $assignedTenantId = null;
            if ($currentUser->is_global_admin) {
                // Si es global admin, puede asignar a un tenant específico o dejarlo global (null)
                $assignedTenantId = $request->input('tenant_id');
            } else {
                // Si no es global admin, el permiso se asigna a su propio tenant
                $assignedTenantId = $currentUser->tenant_id;
            }

            // Validación adicional para usuarios no-global-admin
            if (!$currentUser->is_global_admin) {
                // Un no-global admin no puede crear permisos globales
                if ($assignedTenantId === null) {
                    abort(403, 'Unauthorized: Non-global admin cannot create global permissions.');
                }
                // Un no-global admin no puede crear permisos en otros tenants
                if ($assignedTenantId != $currentUser->tenant_id) {
                    abort(403, 'Unauthorized: Cannot assign permission to a different tenant.');
                }
            }
            
            // Re-validar la unicidad del nombre del permiso con el tenant_id asignado
            $request->validate([
                'name' => [
                    'required',
                    'string',
                    Rule::unique('permissions', 'name')->where(function ($query) use ($assignedTenantId, $guard) {
                        return $query->where('tenant_id', $assignedTenantId)->where('guard_name', $guard);
                    }),
                ],
            ]);

            $permission = Permission::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'tenant_id' => $assignedTenantId, // Usar el tenant_id determinado
                'guard_name' => $guard,
            ]);

            Log::info('Permission created successfully', [
                'permission_id' => $permission->id,
                'tenant_id' => $assignedTenantId,
            ]);

            return response()->json($permission, 201);
        } catch (ValidationException $e) {
            Log::error('Validation failed during permission store', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Fallo de validación', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::critical('Unexpected error during permission store', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['error' => 'Ocurrió un error inesperado.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Muestra un permiso específico para el tenant actual o globalmente si es Global Admin.
     * GET /api/permissions/{id}
     */
    public function show(Request $request, $id)
    {
        $currentUser = Auth::guard('sanctum')->user();

        try {
            $query = Permission::query();

            // Si es global admin, no aplicar filtro de tenant
            if ($currentUser->is_global_admin) {
                Log::info('PermissionController@show: Global Admin detected. Fetching permission without tenant filter.');
            } else {
                // Para usuarios de tenant, filtrar por su propio tenant_id
                $tenantId = $request->header('X-Tenant-ID');
                if (!$tenantId || $currentUser->tenant_id != $tenantId) {
                    abort(403, 'Unauthorized: Tenant ID mismatch or missing.');
                }
                $query->where('tenant_id', $tenantId);
                Log::info('PermissionController@show: Fetching permission for tenant.', ['tenant_id' => $tenantId]);
            }

            $permission = $query->findOrFail($id);

            // Verificación final de seguridad si no es global admin
            if (!$currentUser->is_global_admin && $permission->tenant_id !== $currentUser->tenant_id) {
                abort(403, 'Unauthorized: You do not have permission to view this permission.');
            }

            return response()->json($permission);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Permission not found.'], 404);
        } catch (\Throwable $e) {
            Log::critical('Error fetching permission in show', [
                'permission_id' => $id,
                'user_id' => $currentUser->id,
                'is_global_admin' => $currentUser->is_global_admin,
                'error_message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Failed to fetch permission due to an unexpected error.'], 500);
        }
    }

    /**
     * Actualiza un permiso existente para el tenant actual o globalmente si es Global Admin.
     * PUT /api/permissions/{id}
     */
    public function update(Request $request, $id)
    {
        $currentUser = Auth::guard('sanctum')->user();
        $guard = $this->defaultGuard();

        try {
            $permission = Permission::findOrFail($id); // Encontrar el permiso primero

            // Validar que el usuario actual tiene permiso para actualizar este permiso
            if (!$currentUser->is_global_admin && $currentUser->tenant_id !== $permission->tenant_id) {
                abort(403, 'Unauthorized: You do not have permission to update this permission.');
            }

            $rules = [
                'name' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('permissions', 'name')->ignore($permission->id)
                        ->where(fn($query) => $query->where('tenant_id', $permission->tenant_id)->where('guard_name', $guard)),
                ],
                'description' => 'nullable|string|max:255',
                'tenant_id' => 'nullable|exists:tenants,id', // Permitir tenant_id para global admin
            ];

            $validated = $request->validate($rules);

            // Manejo de tenant_id para la actualización
            if (isset($validated['tenant_id'])) {
                if (!$currentUser->is_global_admin) {
                    // Un no-global admin no puede cambiar el tenant_id ni asignarse a otro tenant.
                    if ($validated['tenant_id'] !== $permission->tenant_id) {
                         abort(403, 'Unauthorized: Cannot change permission\'s tenant ID.');
                    }
                }
                $permission->tenant_id = $validated['tenant_id'];
            }

            $permission->update([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? $permission->description,
            ]);

            Log::info('Permission updated successfully', [
                'permission_id' => $permission->id,
                'tenant_id' => $permission->tenant_id,
            ]);

            return response()->json($permission);
        } catch (ValidationException $e) {
            Log::error('Validation failed during permission update', [
                'permission_id' => $id,
                'tenant_id' => $permission->tenant_id ?? 'N/A',
                'errors' => $e->errors(),
            ]);
            return response()->json(['error' => 'Fallo de validación', 'details' => $e->errors()], 422);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Permission not found.'], 404);
        } catch (\Throwable $e) {
            Log::critical('Unexpected error during permission update', [
                'permission_id' => $id,
                'tenant_id' => $permission->tenant_id ?? 'N/A',
                'error_message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
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
        $currentUser = Auth::guard('sanctum')->user();

        try {
            $permission = Permission::findOrFail($id); // Encontrar el permiso primero

            // Validar que el usuario actual tiene permiso para eliminar este permiso
            if (!$currentUser->is_global_admin && $currentUser->tenant_id !== $permission->tenant_id) {
                abort(403, 'Unauthorized: You do not have permission to delete this permission.');
            }

            $permission->delete();

            Log::info('Permission deleted successfully', [
                'permission_id' => $id,
                'tenant_id' => $permission->tenant_id,
            ]);

            return response()->noContent(); // 204 No Content
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Permission not found.'], 404);
        } catch (\Throwable $e) {
            Log::critical('Error deleting permission', [
                'permission_id' => $id,
                'tenant_id' => $permission->tenant_id ?? 'N/A',
                'error_message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Failed to delete permission'], 500);
        }
    }
}
