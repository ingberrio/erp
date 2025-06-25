<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Role;
use Spatie\Permission\Models\Permission;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;


class RoleController extends Controller
{
    /**
     * Obtiene el guard por defecto de la aplicación.
     */
    private function defaultGuard(): string
    {
        return config('auth.defaults.guard');
    }

    /**
     * Listar todos los roles con sus permisos y el conteo de usuarios para el tenant actual.
     * GET /api/roles
     */
    public function index(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            // Carga los permisos y el conteo de usuarios asociados a cada rol
            $roles = Role::with('permissions')
                ->withCount('users') // <-- Agregado para contar los usuarios relacionados
                ->where('tenant_id', $tenantId)
                ->get();

            return response()->json($roles);
        } catch (\Throwable $e) {
            Log::error('Error fetching roles in index', [
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Failed to fetch roles'], 500);
        }
    }

    /**
     * Crear un nuevo rol para el tenant actual.
     * POST /api/roles
     */
    public function store(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        $guard = $this->defaultGuard();

        DB::beginTransaction();

        try {
            $validated = $request->validate([
                'name'        => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('roles', 'name')
                        ->where(fn($query) => $query->where('tenant_id', $tenantId))
                        ->where(fn($query) => $query->where('guard_name', 'sanctum')), // Asegura unicidad por guard_name
                ],
                'description' => 'nullable|string|max:255',
                'permissions' => 'nullable|array',
                'permissions.*' => ['integer', Rule::exists('permissions', 'id')->where(function ($query) use ($tenantId, $guard) {
                    $query->where('tenant_id', $tenantId)->where('guard_name', $guard);
                })],
            ]);

            $role = Role::create([
                'name'        => $validated['name'],
                'description' => $validated['description'] ?? null,
                'tenant_id'   => $tenantId,
                'guard_name'  => $guard, // Asumimos 'sanctum' para roles de API
            ]);

            // Sincronizar permisos si se enviaron
            if (!empty($validated['permissions'])) {
                $role->syncPermissions($validated['permissions']);
            }

            DB::commit();

            Log::info('Rol creado correctamente.', [
                'role_id' => $role->id,
                'tenant_id' => $tenantId,
            ]);

            // Devolver el rol con los permisos cargados
            return response()->json($role->load('permissions')->loadCount('users'), 201); // <-- loadCount para el conteo de usuarios al crear

        } catch (ValidationException $e) {
            DB::rollBack();
            Log::error('Validation failed during role store', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Fallo de validación', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Ocurrió un error inesperado durante el almacenamiento del rol', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['error' => 'Ocurrió un error inesperado.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Mostrar un rol específico (con permisos y conteo de usuarios).
     * GET /api/roles/{id}
     */
    public function show(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            // Siempre cargar permisos y conteo de usuarios al mostrar un solo rol
            $role = Role::with('permissions')
                ->withCount('users') // <-- Agregado para contar los usuarios relacionados
                ->where('tenant_id', $tenantId)
                ->findOrFail($id);

            return response()->json($role);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Role not found for this tenant.'], 404);
        } catch (\Throwable $e) {
            Log::error('Error fetching role in show', [
                'role_id' => $id,
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Failed to fetch role'], 500);
        }
    }

    /**
     * Actualizar un rol (nombre, descripción y permisos).
     * PUT /api/roles/{id}
     */
    public function update(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        $guard = $this->defaultGuard();

        DB::beginTransaction();

        try {
            $role = Role::where('tenant_id', $tenantId)
                ->findOrFail($id);

            $validated = $request->validate([
                'name'        => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('roles', 'name')
                        ->ignore($role->id)
                        ->where(fn($query) => $query->where('tenant_id', $tenantId))
                        ->where(fn($query) => $query->where('guard_name', 'sanctum')), // Asegura unicidad por guard_name
                ],
                'description' => 'nullable|string|max:255',
                'permissions' => 'nullable|array',
                'permissions.*' => ['integer', Rule::exists('permissions', 'id')->where(function ($query) use ($tenantId, $guard) {
                    $query->where('tenant_id', $tenantId)->where('guard_name', $guard);
                })],
            ]);

            $role->update([
                'name'        => $validated['name'],
                'description' => $validated['description'] ?? $role->description,
            ]);

            // Sincronizar permisos si se enviaron en la petición
            if (array_key_exists('permissions', $validated)) {
                $role->syncPermissions($validated['permissions']);
            }

            DB::commit();

            Log::info('Rol actualizado correctamente.', [
                'role_id'   => $role->id,
                'tenant_id' => $tenantId,
            ]);

            // Devolver el rol con los permisos y el conteo de usuarios cargados después de la actualización
            return response()->json($role->load('permissions')->loadCount('users')); // <-- loadCount para el conteo de usuarios al actualizar
        } catch (ValidationException $e) {
            DB::rollBack();
            Log::error('Validation failed during role update', [
                'role_id' => $id,
                'tenant_id' => $tenantId,
                'errors' => $e->errors(),
            ]);
            return response()->json(['error' => 'Fallo de validación', 'details' => $e->errors()], 422);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            DB::rollBack();
            return response()->json(['error' => 'Role not found for this tenant.'], 404);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Ocurrió un error inesperado durante la actualización del rol', [
                'role_id' => $id,
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Ocurrió un error inesperado.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Borrar un rol.
     * DELETE /api/roles/{id}
     */
    public function destroy(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        DB::beginTransaction();

        try {
            $role = Role::where('tenant_id', $tenantId)
                ->findOrFail($id);

            $role->delete();

            DB::commit();

            Log::info('Rol eliminado correctamente.', [
                'role_id' => $id,
                'tenant_id' => $tenantId,
            ]);

            return response()->noContent();
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            DB::rollBack();
            return response()->json(['error' => 'Role not found for this tenant.'], 404);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Error eliminando rol', [
                'role_id' => $id,
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Failed to delete role'], 500);
        }
    }

    /**
     * Asignar permisos de forma masiva a un rol.
     * POST /api/roles/{role}/permissions
     * Nota: Este método se mantiene opcionalmente si necesitas un endpoint dedicado,
     * pero la lógica de sincronización ya está integrada en 'update' y 'store'.
     */
    public function setPermissions(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            $role = Role::where('tenant_id', $tenantId)
                ->findOrFail($id);

            $request->validate([
                'permissions' => 'required|array',
                'permissions.*' => ['integer', Rule::exists('permissions', 'id')->where(function ($query) use ($tenantId) {
                    $query->where('tenant_id', $tenantId);
                })],
            ]);

            $permissionIds = Permission::whereIn('id', $request->permissions ?? [])
                ->where('tenant_id', $tenantId)
                ->pluck('id')
                ->toArray();

            $role->syncPermissions($permissionIds);

            Log::info("Permisos sincronizados correctamente", [
                'role_id'     => $role->id,
                'permissions' => $permissionIds,
                'tenant_id'   => $tenantId,
            ]);

            return response()->json($role->load('permissions')->loadCount('users')); // <-- loadCount para el conteo de usuarios
        } catch (ValidationException $e) {
            Log::error('Validation failed during setPermissions', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Fallo de validación al asignar permisos', 'details' => $e->errors()], 422);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Role not found for this tenant.'], 404);
        } catch (\Throwable $e) {
            Log::error("Error al sincronizar permisos", [
                'role_id' => $id,
                'tenant_id' => $tenantId,
                'error'   => $e->getMessage(),
            ]);

            return response()->json([
                'message' => "Error al asignar permisos: {$e->getMessage()}"
            ], 500);
        }
    }
}
