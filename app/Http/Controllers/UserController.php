<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Spatie\Permission\Models\Role;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            $users = User::where('tenant_id', $tenantId)
                         ->with('roles')
                         ->get();
            return response()->json($users);
        } catch (\Throwable $e) {
            Log::error('Error fetching users', [
                'tenant_id'    => $tenantId,
                'error_message'=> $e->getMessage(),
            ]);
            return response()->json(['error' => 'Failed to fetch users'], 500);
        }
    }

    public function store(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (is_null($tenantId)) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => ['required','email','max:255',
                            Rule::unique('users','email')->where('tenant_id',$tenantId)],
            'password' => 'required|string|min:8',
            'roles'    => 'sometimes|array',
            'roles.*'  => ['integer', Rule::exists('roles','id')->where('tenant_id',$tenantId)],
        ]);

        // 1) Crear usuario
        $user = User::create([
            'name'      => $validated['name'],
            'email'     => $validated['email'],
            'password'  => Hash::make($validated['password']),
            'tenant_id' => $tenantId,
        ]);

        // 2) Si vienen roles, levantamos sus modelos
        if (!empty($validated['roles'])) {
            $roleModels = Role::where('tenant_id', $tenantId)
                            ->whereIn('id', $validated['roles'])
                            ->get();

            if ($roleModels->count() !== count($validated['roles'])) {
                return response()->json([
                    'error'   => 'One or more roles do not exist for this tenant.',
                    'details' => $validated['roles'],
                ], 422);
            }

            // Extraemos solo los nombres
            $roleNames = $roleModels->pluck('name')->all();

            // Sincronizamos POR NOMBRE
            $user->syncRoles($roleNames);
        }

        return response()->json([
            'user'    => $user->load('roles'),
            'message' => 'User created successfully.',
        ], 201);
    }


    public function update(Request $request, User $user)
    {
        // El Route Model Binding de Laravel, combinado con el TenantScope en el modelo User,
        // ya debería asegurar que $user pertenezca al tenant correcto.
        // Si el usuario no se encuentra para el tenant actual, Laravel automáticamente
        // lanzará un 404 (ModelNotFoundException).
        // Por lo tanto, la verificación explícita de is_null($tenantId) || $user->tenant_id !== $tenantId
        // es redundante y puede causar problemas si se evalúa antes de que el binding sea firme.

        $tenantId = $request->header('X-Tenant-ID'); // Aún es útil para validaciones y roles.

        Log::debug('Request payload (UserController@update)', [
            'user_id_from_route'       => $user->id,
            'user_tenant_id_from_model' => $user->tenant_id, // Tenant ID del modelo User encontrado
            'request_tenant_id_header' => $tenantId,         // Tenant ID del header de la petición
            'payload'                  => $request->all(),
        ]);

        try {
            $validated = $request->validate([
                'name'     => 'required|string|max:255',
                'email'    => [
                    'required',
                    'string',
                    'email',
                    'max:255',
                    // Regla unique con filtro por tenant y excluyendo al usuario actual
                    Rule::unique('users', 'email')->ignore($user->id)
                        ->where(function ($query) use ($tenantId) {
                            return $query->where('tenant_id', $tenantId);
                        }),
                ],
                // 'password' es opcional; solo se valida si se proporciona.
                'password' => 'nullable|string|min:8',
                'roles'    => 'sometimes|array', // 'sometimes' para que no sea requerido si no se envía
                // Valida que los IDs de roles existan Y pertenezcan al tenant actual
                'roles.*'  => ['integer', Rule::exists('roles', 'id')->where('tenant_id', $tenantId)],
            ]);

            // 1) Actualizar datos del usuario
            $user->update([
                'name'     => $validated['name'],
                'email'    => $validated['email'],
                // Actualiza la contraseña solo si el campo 'password' fue enviado y tiene valor
                'password' => $request->filled('password') // Usa request->filled() para campos opcionales
                    ? Hash::make($validated['password'])
                    : $user->password, // Si no se envía o está vacío, mantener la contraseña actual
            ]);

            // 2) Sincronizar roles si el campo 'roles' está presente en la petición
            if (array_key_exists('roles', $validated)) {
                // Obtener los modelos de roles solicitados que pertenecen al tenant actual
                $roleModels = Role::where('tenant_id', $tenantId)
                    ->whereIn('id', $validated['roles'])
                    ->get();

                // Verifica si todos los IDs de roles enviados corresponden a roles existentes para el tenant
                if ($roleModels->count() !== count($validated['roles'])) {
                    // Identifica cuáles roles no se encontraron para el tenant
                    $foundRoleIds = $roleModels->pluck('id')->toArray();
                    $invalidRoleIds = array_diff($validated['roles'], $foundRoleIds);
                    Log::warning('One or more roles do not exist for this tenant during update.', [
                        'user_id' => $user->id,
                        'tenant_id' => $tenantId,
                        'invalid_roles_ids' => $invalidRoleIds,
                        'requested_roles' => $validated['roles']
                    ]);
                    return response()->json([
                        'error'   => 'Uno o más roles no existen para este tenant.',
                        'details' => ['roles' => 'Los IDs de rol ' . implode(', ', $invalidRoleIds) . ' no son válidos para su tenant.'],
                    ], 422);
                }

                // Sincroniza los roles por su nombre (recomendado por Spatie para consistencia)
                $user->syncRoles($roleModels->pluck('name')->all());
            }
            // Si el campo 'roles' no está presente en la petición, los roles del usuario no se modifican.
            // Si quieres que un array vacío de 'roles' desasigne todos los roles,
            // la lógica actual con array_key_exists y syncRoles([]) lo manejaría si $validated['roles'] es un array vacío.


            Log::info('User updated successfully', [
                'user_id'   => $user->id,
                'tenant_id' => $user->tenant_id,
            ]);

            return response()->json([
                'user'    => $user->load('roles'), // Recargar roles para asegurar que la respuesta sea actual
                'message' => 'Usuario actualizado correctamente.',
            ]);

        } catch (ValidationException $e) {
            Log::error('Validation failed during user update', [
                'user_id' => $user->id,
                'tenant_id' => $user->tenant_id,
                'errors'  => $e->errors(),
            ]);
            return response()->json([
                'error'   => 'Fallo de validación',
                'details' => $e->errors(),
            ], 422);

        } catch (\Throwable $e) { // Captura cualquier otra excepción
            Log::error('Unexpected error during user update', [
                'user_id'       => $user->id,
                'tenant_id'     => $user->tenant_id,
                'error_message' => $e->getMessage(),
                'trace'         => $e->getTraceAsString(), // Incluir el stack trace
            ]);
            return response()->json([
                'error'   => 'Ocurrió un error inesperado.',
                'details' => $e->getMessage(),
            ], 500);
        }
    }

    public function show(Request $request, User $user)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error'=>'Tenant ID is missing'], 400);
        }

        if ($user->tenant_id !== $tenantId) {
            return response()->json(['error'=>'User not found for this tenant'], 404);
        }

        try {
            return response()->json($user->load('roles'));
        } catch (\Throwable $e) {
            Log::error('Error fetching user', [
                'user_id'      => $user->id,
                'tenant_id'    => $tenantId,
                'error_message'=> $e->getMessage(),
            ]);
            return response()->json(['error'=>'Failed to fetch user'], 500);
        }
    }

    // In App\Http\Controllers\UserController.php, inside destroy method
    // Your new (working) destroy method:
    public function destroy(Request $request, $id) // Changed from User $user to $id
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error'=>'Tenant ID is missing'], 400);
        }

        // Manually find the user after tenantId is available
        $user = User::where('id', $id)
                    ->where('tenant_id', $tenantId)
                    ->firstOrFail(); // This will throw a 404 if not found for the tenant

        try {
            $user->delete();
            Log::info('User deleted successfully', [
                'user_id'   => $user->id,
                'tenant_id' => $tenantId,
            ]);
            return response()->noContent();
        } catch (\Throwable $e) {
            Log::error('Error deleting user', [
                'user_id'      => $user->id,
                'error_message'=> $e->getMessage(),
            ]);
            return response()->json(['error'=>'Failed to delete user'], 500);
        }
    }
}
