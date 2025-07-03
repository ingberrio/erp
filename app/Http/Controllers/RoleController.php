<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Role; // Asegúrate de que este sea tu modelo de Role si no es directamente Spatie
use Spatie\Permission\Models\Permission;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth; // <-- ¡Añadir esta importación!

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
        $user = Auth::guard('sanctum')->user(); // Obtener el usuario autenticado
        Log::info('RoleController@index: Request received.', [
            'user_id' => $user->id ?? 'guest',
            'is_global_admin' => $user->is_global_admin ?? false,
            'tenant_id_from_user' => $user->tenant_id ?? 'N/A'
        ]);

        try {
            // Si el usuario es un administrador global, devolver TODOS los roles (globales y de todos los tenants).
            if ($user && $user->is_global_admin) {
                Log::info('RoleController@index: Global Admin detected. Fetching all roles.');
                // Cargar roles con sus permisos y el conteo de usuarios
                $roles = Role::with('permissions')
                    ->withCount('users')
                    ->get();
                return response()->json($roles);
            }

            // Para usuarios de tenant, filtrar roles por tenant_id
            $tenantId = $request->header('X-Tenant-ID');
            if (!$tenantId) {
                Log::warning('RoleController@index: Tenant ID is missing for non-global admin.', ['user_id' => $user->id ?? 'N/A']);
                return response()->json(['error' => 'Tenant ID is missing.'], 400);
            }

            // Asegurarse de que el tenant_id del usuario coincide con el del header (seguridad adicional)
            if ($user && $user->tenant_id && $user->tenant_id != $tenantId) {
                Log::warning('RoleController@index: Tenant ID mismatch between user and header.', [
                    'user_id' => $user->id,
                    'user_tenant_id' => $user->tenant_id,
                    'header_tenant_id' => $tenantId
                ]);
                return response()->json(['error' => 'Unauthorized: Tenant ID mismatch.'], 403);
            }

            Log::info('RoleController@index: Fetching roles for tenant.', ['tenant_id' => $tenantId]);
            // Cargar roles del tenant con sus permisos y el conteo de usuarios
            $roles = Role::with('permissions')
                ->withCount('users')
                ->where('tenant_id', $tenantId)
                ->get();

            return response()->json($roles);

        } catch (\Throwable $e) {
            Log::critical('Error fetching roles in RoleController@index', [
                'user_id' => $user->id ?? 'N/A',
                'is_global_admin' => $user->is_global_admin ?? false,
                'tenant_id_from_header' => $request->header('X-Tenant-ID') ?? 'N/A',
                'error_message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Failed to fetch roles due to an unexpected error.'], 500);
        }
    }

    /**
     * Crear un nuevo rol para el tenant actual.
     * POST /api/roles
     */
    public function store(Request $request)
    {
        $currentUser = Auth::guard('sanctum')->user();
        $guard = $this->defaultGuard();

        DB::beginTransaction();

        try {
            $validated = $request->validate([
                'name'        => [
                    'required',
                    'string',
                    'max:255',
                    // La regla unique se ajustará dinámicamente
                ],
                'description' => 'nullable|string|max:255',
                'permissions' => 'nullable|array',
                'permissions.*' => ['integer', Rule::exists('permissions', 'id')], // No filtrar por tenant_id aquí aún
                'tenant_id' => 'nullable|exists:tenants,id', // Permitir tenant_id si es global admin
            ]);

            // Determinar el tenant_id para el nuevo rol
            $assignedTenantId = null;
            if ($currentUser->is_global_admin) {
                // Si es global admin, puede asignar a un tenant específico o dejarlo global (null)
                $assignedTenantId = $request->input('tenant_id');
            } else {
                // Si no es global admin, el rol se asigna a su propio tenant
                $assignedTenantId = $currentUser->tenant_id;
            }

            // Validación adicional para usuarios no-global-admin
            if (!$currentUser->is_global_admin) {
                // Un no-global admin no puede crear roles globales
                if ($assignedTenantId === null) {
                    abort(403, 'Unauthorized: Non-global admin cannot create global roles.');
                }
                // Un no-global admin no puede crear roles en otros tenants
                if ($assignedTenantId != $currentUser->tenant_id) {
                    abort(403, 'Unauthorized: Cannot assign role to a different tenant.');
                }
            }
            
            // Re-validar la unicidad del nombre del rol con el tenant_id asignado
            $request->validate([
                'name' => [
                    'required',
                    'string',
                    Rule::unique('roles', 'name')->where(function ($query) use ($assignedTenantId, $guard) {
                        return $query->where('tenant_id', $assignedTenantId)->where('guard_name', $guard);
                    }),
                ],
            ]);


            $role = Role::create([
                'name'        => $validated['name'],
                'description' => $validated['description'] ?? null,
                'tenant_id'   => $assignedTenantId, // Usar el tenant_id determinado
                'guard_name'  => $guard,
            ]);

            // Sincronizar permisos si se enviaron
            if (!empty($validated['permissions'])) {
                $permissions = Permission::whereIn('id', $validated['permissions'])->get();
                // Filtrar permisos si el usuario actual no es global admin
                if (!$currentUser->is_global_admin) {
                    $permissions = $permissions->filter(function($permission) use ($currentUser) {
                        return $permission->tenant_id == $currentUser->tenant_id;
                    });
                }
                $role->syncPermissions($permissions);
            }

            DB::commit();

            Log::info('Rol creado correctamente.', [
                'role_id' => $role->id,
                'tenant_id' => $assignedTenantId,
            ]);

            return response()->json($role->load('permissions')->loadCount('users'), 201);

        } catch (ValidationException $e) {
            DB::rollBack();
            Log::error('Validation failed during role store', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Fallo de validación', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::critical('Ocurrió un error inesperado durante el almacenamiento del rol', [
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
        $currentUser = Auth::guard('sanctum')->user();

        try {
            $query = Role::with('permissions')->withCount('users');

            // Si es global admin, no aplicar filtro de tenant
            if ($currentUser->is_global_admin) {
                Log::info('RoleController@show: Global Admin detected. Fetching role without tenant filter.');
            } else {
                // Para usuarios de tenant, filtrar por su propio tenant_id
                $tenantId = $request->header('X-Tenant-ID');
                if (!$tenantId || $currentUser->tenant_id != $tenantId) {
                    abort(403, 'Unauthorized: Tenant ID mismatch or missing.');
                }
                $query->where('tenant_id', $tenantId);
                Log::info('RoleController@show: Fetching role for tenant.', ['tenant_id' => $tenantId]);
            }

            $role = $query->findOrFail($id);

            // Verificación final de seguridad si no es global admin
            if (!$currentUser->is_global_admin && $role->tenant_id !== $currentUser->tenant_id) {
                abort(403, 'Unauthorized: You do not have permission to view this role.');
            }

            return response()->json($role);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Role not found.'], 404);
        } catch (\Throwable $e) {
            Log::critical('Error fetching role in show', [
                'role_id' => $id,
                'user_id' => $currentUser->id,
                'is_global_admin' => $currentUser->is_global_admin,
                'error_message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Failed to fetch role due to an unexpected error.'], 500);
        }
    }

    /**
     * Actualizar un rol (nombre, descripción y permisos).
     * PUT /api/roles/{id}
     */
    public function update(Request $request, $id)
    {
        $currentUser = Auth::guard('sanctum')->user();
        $guard = $this->defaultGuard();

        DB::beginTransaction();

        try {
            $role = Role::findOrFail($id); // Encontrar el rol primero

            // Validar que el usuario actual tiene permiso para actualizar este rol
            if (!$currentUser->is_global_admin && $currentUser->tenant_id !== $role->tenant_id) {
                abort(403, 'Unauthorized: You do not have permission to update this role.');
            }

            $rules = [
                'name'        => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('roles', 'name')
                        ->ignore($role->id)
                        ->where(fn($query) => $query->where('tenant_id', $role->tenant_id)->where('guard_name', $guard)),
                ],
                'description' => 'nullable|string|max:255',
                'permissions' => 'nullable|array',
                'permissions.*' => ['integer', Rule::exists('permissions', 'id')], // No filtrar por tenant_id aquí aún
                'tenant_id' => 'nullable|exists:tenants,id', // Permitir tenant_id para global admin
            ];

            $validated = $request->validate($rules);

            // Manejo de tenant_id para la actualización
            if (isset($validated['tenant_id'])) {
                if (!$currentUser->is_global_admin) {
                    // Un no-global admin no puede cambiar el tenant_id ni asignarse a otro tenant.
                    if ($validated['tenant_id'] !== $role->tenant_id) {
                         abort(403, 'Unauthorized: Cannot change role\'s tenant ID.');
                    }
                }
                $role->tenant_id = $validated['tenant_id'];
            }


            $role->update([
                'name'        => $validated['name'],
                'description' => $validated['description'] ?? $role->description,
            ]);

            // Sincronizar permisos si se enviaron en la petición
            if (array_key_exists('permissions', $validated)) {
                $permissionsToAssign = Permission::whereIn('id', $validated['permissions'])->get();
                // Filtrar permisos si el usuario actual no es global admin
                if (!$currentUser->is_global_admin) {
                    $permissionsToAssign = $permissionsToAssign->filter(function($permission) use ($currentUser) {
                        return $permission->tenant_id == $currentUser->tenant_id;
                    });
                }
                $role->syncPermissions($permissionsToAssign);
            }

            DB::commit();

            Log::info('Rol actualizado correctamente.', [
                'role_id'   => $role->id,
                'tenant_id' => $role->tenant_id,
            ]);

            return response()->json($role->load('permissions')->loadCount('users'));
        } catch (ValidationException $e) {
            DB::rollBack();
            Log::error('Validation failed during role update', [
                'role_id' => $id,
                'tenant_id' => $role->tenant_id ?? 'N/A',
                'errors' => $e->errors(),
            ]);
            return response()->json(['error' => 'Fallo de validación', 'details' => $e->errors()], 422);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            DB::rollBack();
            return response()->json(['error' => 'Role not found.'], 404);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::critical('Ocurrió un error inesperado durante la actualización del rol', [
                'role_id' => $id,
                'tenant_id' => $role->tenant_id ?? 'N/A',
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
        $currentUser = Auth::guard('sanctum')->user();

        DB::beginTransaction();

        try {
            $role = Role::findOrFail($id); // Encontrar el rol primero

            // Validar que el usuario actual tiene permiso para eliminar este rol
            if (!$currentUser->is_global_admin && $currentUser->tenant_id !== $role->tenant_id) {
                abort(403, 'Unauthorized: You do not have permission to delete this role.');
            }

            $role->delete();

            DB::commit();

            Log::info('Rol eliminado correctamente.', [
                'role_id' => $id,
                'tenant_id' => $role->tenant_id,
            ]);

            return response()->noContent();
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            DB::rollBack();
            return response()->json(['error' => 'Role not found.'], 404);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::critical('Error eliminando rol', [
                'role_id' => $id,
                'tenant_id' => $role->tenant_id ?? 'N/A',
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
        $currentUser = Auth::guard('sanctum')->user();

        try {
            $role = Role::findOrFail($id); // Encontrar el rol primero

            // Validar que el usuario actual tiene permiso para modificar este rol
            if (!$currentUser->is_global_admin && $currentUser->tenant_id !== $role->tenant_id) {
                abort(403, 'Unauthorized: You do not have permission to modify this role.');
            }

            $request->validate([
                'permissions' => 'required|array',
                'permissions.*' => ['integer', Rule::exists('permissions', 'id')], // No filtrar por tenant_id aquí aún
            ]);

            $permissionIds = Permission::whereIn('id', $request->permissions ?? [])->pluck('id')->toArray();
            
            // Filtrar permisos si el usuario actual no es global admin
            if (!$currentUser->is_global_admin) {
                $permissionIds = Permission::whereIn('id', $permissionIds)
                    ->where('tenant_id', $currentUser->tenant_id)
                    ->pluck('id')
                    ->toArray();
            }

            $role->syncPermissions($permissionIds);

            Log::info("Permisos sincronizados correctamente", [
                'role_id'     => $role->id,
                'permissions' => $permissionIds,
                'tenant_id'   => $role->tenant_id,
            ]);

            return response()->json($role->load('permissions')->loadCount('users'));
        } catch (ValidationException $e) {
            Log::error('Validation failed during setPermissions', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Fallo de validación al asignar permisos', 'details' => $e->errors()], 422);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Role not found.'], 404);
        } catch (\Throwable $e) {
            Log::critical("Error al sincronizar permisos", [
                'role_id' => $id,
                'user_id' => $currentUser->id,
                'error'   => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => "Error al asignar permisos: {$e->getMessage()}"
            ], 500);
        }
    }
}
