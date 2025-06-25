<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Role;
use Spatie\Permission\Models\Permission;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException; // Asegúrate de que esta importación exista
use Illuminate\Support\Facades\DB; // Asegúrate de que esta importación exista


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
     * Listar todos los roles con sus permisos para el tenant actual.
     * GET /api/roles
     */
    public function index(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            $roles = Role::with('permissions') // Carga los permisos para la lista
                // ->withCount('users') // Descomentar si tienes una relación 'users' en Role para contar usuarios
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
                'description' => 'nullable|string|max:255', // <-- Validar campo description
                'permissions' => 'nullable|array',
                'permissions.*' => ['integer', Rule::exists('permissions', 'id')->where(function ($query) use ($tenantId, $guard) {
                    $query->where('tenant_id', $tenantId)->where('guard_name', $guard);
                })],
            ]);

            $role = Role::create([
                'name'        => $validated['name'],
                'description' => $validated['description'] ?? null, // <-- Guardar description
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
            return response()->json($role->load('permissions'), 201);

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
     * Mostrar un rol específico (con permisos).
     * GET /api/roles/{id}
     */
    public function show(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            $role = Role::with('permissions') // Siempre cargar permisos al mostrar un solo rol
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
                'description' => 'nullable|string|max:255', // <-- Validar campo description
                'permissions' => 'nullable|array', // Los permisos ahora pueden enviarse en la actualización
                'permissions.*' => ['integer', Rule::exists('permissions', 'id')->where(function ($query) use ($tenantId, $guard) {
                    $query->where('tenant_id', $tenantId)->where('guard_name', $guard);
                })],
            ]);

            $role->update([
                'name'        => $validated['name'],
                'description' => $validated['description'] ?? $role->description, // <-- Actualiza la descripción
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

            // Devolver el rol con los permisos cargados después de la actualización
            return response()->json($role->load('permissions'));
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

            // Opcional: antes de borrar un rol, podrías querer desasignarlo de todos los usuarios
            // o añadir una validación para evitar borrar roles con usuarios asignados.
            // if ($role->users()->count() > 0) {
            //     throw new \Exception('No se puede eliminar el rol porque tiene usuarios asignados.');
            // }
            // $role->users()->detach(); // Si tienes una relación directa de users en Role

            $role->delete();

            DB::commit();

            Log::info('Rol eliminado correctamente.', [
                'role_id' => $id,
                'tenant_id' => $tenantId,
            ]);

            return response()->noContent(); // 204 No Content
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
     * pero la lógica de sincronización ya está integrada en 'update'.
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

            // Validar que los IDs de permisos son enteros
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

            // Sincronizar permisos, lo que manejará la eliminación de los no incluidos y la adición de los nuevos
            $role->syncPermissions($permissionIds);

            Log::info("Permisos sincronizados correctamente", [
                'role_id'     => $role->id,
                'permissions' => $permissionIds,
                'tenant_id'   => $tenantId,
            ]);

            return response()->json($role->load('permissions'));
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
