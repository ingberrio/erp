<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth; // Importa la fachada Auth
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Spatie\Permission\Models\Role;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    /**
     * Display a listing of the resource.
     * GET /api/users
     */
    public function index(Request $request)
    {
        $user = Auth::guard('sanctum')->user(); // Obtener el usuario autenticado
        Log::info('UserController@index: Request received.', [
            'user_id' => $user->id ?? 'guest',
            'is_global_admin' => $user->is_global_admin ?? false,
            'tenant_id_from_user' => $user->tenant_id ?? 'N/A'
        ]);

        try {
            // Si el usuario es un administrador global, devolver TODOS los usuarios.
            // El TenantScope en el modelo User debería manejar el bypass para is_global_admin
            // si TenantContext::getTenantId() devuelve null para global admins.
            if ($user && $user->is_global_admin) {
                Log::info('UserController@index: Global Admin detected. Fetching all users.');
                // Cargar usuarios con sus roles para el frontend
                $users = User::with('roles')->get();
                return response()->json($users);
            }

            // Para usuarios de tenant, filtrar por tenant_id
            $tenantId = $request->header('X-Tenant-ID');
            if (!$tenantId) {
                Log::warning('UserController@index: Tenant ID is missing for non-global admin.', ['user_id' => $user->id ?? 'N/A']);
                return response()->json(['error' => 'Tenant ID is missing.'], 400);
            }

            // Asegurarse de que el tenant_id del usuario autenticado coincide con el del header (seguridad adicional)
            if ($user && $user->tenant_id && $user->tenant_id != $tenantId) {
                Log::warning('UserController@index: Tenant ID mismatch between user and header.', [
                    'user_id' => $user->id,
                    'user_tenant_id' => $user->tenant_id,
                    'header_tenant_id' => $tenantId
                ]);
                return response()->json(['error' => 'Unauthorized: Tenant ID mismatch.'], 403);
            }

            Log::info('UserController@index: Fetching users for tenant.', ['tenant_id' => $tenantId]);
            // Cargar usuarios del tenant con sus roles
            $users = User::where('tenant_id', $tenantId)->with('roles')->get();
            return response()->json($users);

        } catch (\Throwable $e) {
            Log::critical('Error fetching users in UserController@index', [
                'user_id' => $user->id ?? 'N/A',
                'is_global_admin' => $user->is_global_admin ?? false,
                'tenant_id_from_header' => $request->header('X-Tenant-ID') ?? 'N/A',
                'error_message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Failed to fetch users due to an unexpected error.'], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     * POST /api/users
     */
    public function store(Request $request)
    {
        $currentUser = Auth::guard('sanctum')->user();

        try {
            $validated = $request->validate([
                'name'     => 'required|string|max:255',
                'email'    => 'required|string|email|max:255|unique:users,email', // Unique globalmente por ahora, luego se ajustará por tenant
                'password' => 'required|string|min:8',
                'roles'    => 'nullable|array', // Array de IDs de roles
                'roles.*'  => 'exists:roles,id', // Cada ID debe existir en la tabla roles
                'tenant_id' => 'nullable|exists:tenants,id', // Permitir tenant_id si es global admin
            ]);

            // Determinar el tenant_id para el nuevo usuario
            $assignedTenantId = null;
            if ($currentUser->is_global_admin) {
                // Si es global admin, puede asignar a un tenant específico o dejarlo global (null)
                $assignedTenantId = $request->input('tenant_id');
            } else {
                // Si no es global admin, el usuario se asigna a su propio tenant
                $assignedTenantId = $currentUser->tenant_id;
            }

            // Validación adicional para usuarios no-global-admin
            if (!$currentUser->is_global_admin) {
                // Un no-global admin no puede crear usuarios globales
                if ($assignedTenantId === null) {
                    abort(403, 'Unauthorized: Non-global admin cannot create global users.');
                }
                // Un no-global admin no puede crear usuarios en otros tenants
                if ($assignedTenantId != $currentUser->tenant_id) {
                    abort(403, 'Unauthorized: Cannot assign user to a different tenant.');
                }
            }
            
            // Ajustar la regla unique para el email si no es global admin
            if (!$currentUser->is_global_admin) {
                $validated['email'] = $request->validate([
                    'email' => [
                        'required',
                        'email',
                        Rule::unique('users', 'email')->where(function ($query) use ($assignedTenantId) {
                            return $query->where('tenant_id', $assignedTenantId);
                        }),
                    ],
                ])['email'];
            }


            $newUser = User::create([
                'name'      => $validated['name'],
                'email'     => $validated['email'],
                'password'  => Hash::make($validated['password']),
                'tenant_id' => $assignedTenantId,
                'is_global_admin' => false, // Los nuevos usuarios creados por el CRUD no son global admin por defecto
            ]);

            // Asignar roles
            if (isset($validated['roles']) && !empty($validated['roles'])) {
                $roles = Role::whereIn('id', $validated['roles'])->get();
                
                // Filtrar roles si el usuario actual no es global admin
                if (!$currentUser->is_global_admin) {
                    $roles = $roles->filter(function($role) use ($currentUser) {
                        return $role->tenant_id == $currentUser->tenant_id;
                    });
                }
                $newUser->syncRoles($roles); // Sync por ID de Role
            }

            Log::info('User created successfully.', ['user_id' => $newUser->id, 'tenant_id' => $newUser->tenant_id]);
            $newUser->load('roles'); // Recargar el usuario con los roles asignados para la respuesta
            return response()->json($newUser, 201);

        } catch (ValidationException $e) {
            Log::error('Validation failed during user store', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::critical('Unexpected error during user store', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified resource.
     * GET /api/users/{user}
     */
    public function show(Request $request, User $user)
    {
        $currentUser = Auth::guard('sanctum')->user();

        // Global admin puede ver cualquier usuario
        if ($currentUser->is_global_admin) {
            $user->load('roles.permissions');
            return response()->json($user);
        }

        // Usuario de tenant solo puede ver usuarios de su propio tenant
        if ($currentUser->tenant_id === $user->tenant_id) {
            $user->load('roles.permissions');
            return response()->json($user);
        }

        abort(403, 'Unauthorized: You do not have permission to view this user.');
    }

    /**
     * Update the specified resource in storage.
     * PUT /api/users/{user}
     */
    public function update(Request $request, User $user)
    {
        $currentUser = Auth::guard('sanctum')->user();

        // Validar que el usuario actual tiene permiso para actualizar este usuario
        // Un usuario no global admin solo puede actualizar usuarios de su propio tenant.
        if (!$currentUser->is_global_admin && $currentUser->tenant_id !== $user->tenant_id) {
            abort(403, 'Unauthorized: You do not have permission to update this user.');
        }

        try {
            $rules = [
                'name' => 'sometimes|required|string|max:255',
                'email' => [
                    'sometimes',
                    'required',
                    'string',
                    'email',
                    'max:255',
                    // Regla unique con filtro por tenant y excluyendo al usuario actual
                    Rule::unique('users', 'email')->ignore($user->id)
                        ->where(function ($query) use ($user) { // Usar $user->tenant_id para la validación
                            return $query->where('tenant_id', $user->tenant_id);
                        }),
                ],
                'password' => 'nullable|string|min:8',
                'roles'    => 'nullable|array',
                'roles.*'  => 'exists:roles,id',
                'tenant_id' => 'nullable|exists:tenants,id', // Permitir tenant_id para global admin
            ];

            $validated = $request->validate($rules);

            // Manejo de tenant_id para la actualización
            if (isset($validated['tenant_id'])) {
                if (!$currentUser->is_global_admin) {
                    // Un no-global admin no puede cambiar el tenant_id ni asignarse a otro tenant.
                    if ($validated['tenant_id'] !== $user->tenant_id) {
                         abort(403, 'Unauthorized: Cannot change user\'s tenant ID.');
                    }
                }
                $user->tenant_id = $validated['tenant_id'];
            }

            $user->name = $validated['name'] ?? $user->name;
            $user->email = $validated['email'] ?? $user->email;
            if (isset($validated['password']) && !empty($validated['password'])) {
                $user->password = Hash::make($validated['password']);
            }
            $user->save();

            // Sincronizar roles
            if (isset($validated['roles'])) {
                $rolesToAssign = Role::whereIn('id', $validated['roles'])->get();
                // Filtrar roles si el usuario actual no es global admin
                if (!$currentUser->is_global_admin) {
                    $rolesToAssign = $rolesToAssign->filter(function($role) use ($currentUser) {
                        return $role->tenant_id == $currentUser->tenant_id;
                    });
                }
                $user->syncRoles($rolesToAssign); // Sync por ID de Role
            }

            Log::info('User updated successfully.', ['user_id' => $user->id, 'tenant_id' => $user->tenant_id]);
            $user->load('roles'); // Recargar roles para la respuesta
            return response()->json($user);

        } catch (ValidationException $e) {
            Log::error('Validation failed during user update', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::critical('Unexpected error during user update', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     * DELETE /api/users/{user}
     */
    public function destroy(Request $request, User $user) // Usar Route Model Binding
    {
        $currentUser = Auth::guard('sanctum')->user();

        // No permitir que un usuario se elimine a sí mismo
        if ($currentUser->id === $user->id) {
            abort(403, 'Unauthorized: You cannot delete your own user account.');
        }

        // Global admin puede eliminar cualquier usuario
        if ($currentUser->is_global_admin) {
            $user->delete();
            Log::info('User deleted by Global Admin.', ['user_id' => $user->id]);
            return response()->noContent();
        }

        // Usuario de tenant solo puede eliminar usuarios de su propio tenant
        // El TenantScope ya debería haber filtrado esto, pero se añade una verificación explícita.
        if ($currentUser->tenant_id === $user->tenant_id) {
            $user->delete();
            Log::info('User deleted by Tenant Admin.', ['user_id' => $user->id, 'tenant_id' => $currentUser->tenant_id]);
            return response()->noContent();
        }

        abort(403, 'Unauthorized: You do not have permission to delete this user.');
    }
}
