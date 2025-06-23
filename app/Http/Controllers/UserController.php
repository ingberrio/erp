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
        $tenantId = $request->header('X-Tenant-ID');
        if (is_null($tenantId) || $user->tenant_id !== $tenantId) {
            return response()->json(['error' => 'User not found for this tenant'], 404);
        }

        Log::debug('Request payload', [
            'payload'   => $request->all(),
            'tenant_id' => $tenantId,
        ]);

        try {
            $validated = $request->validate([
                'name'     => 'required|string|max:255',
                'email'    => [
                    'required',
                    'string',
                    'email',
                    'max:255',
                    Rule::unique('users', 'email')->ignore($user->id)
                        ->where('tenant_id', $tenantId),
                ],
                'password' => 'nullable|string|min:8',
                'roles'    => 'sometimes|array',
                'roles.*'  => ['integer', Rule::exists('roles', 'id')->where('tenant_id', $tenantId)],
            ]);

            // 1) Actualizamos datos del usuario
            $user->update([
                'name'     => $validated['name'],
                'email'    => $validated['email'],
                'password' => $validated['password']
                    ? Hash::make($validated['password'])
                    : $user->password,
            ]);

            // 2) Si vienen roles, resolvemos los modelos y hacemos sync
            if (array_key_exists('roles', $validated)) {
                $roleModels = Role::where('tenant_id', $tenantId)
                    ->whereIn('id', $validated['roles'])
                    ->get();
            
                if ($roleModels->count() !== count($validated['roles'])) {
                    return response()->json([
                        'error'   => 'One or more roles do not exist for this tenant.',
                        'details' => $validated['roles'],
                    ], 422);
                }
            
                // sincronizar por nombre
                // Extraemos solo los nombres
                $roleNames = $roleModels->pluck('name')->all();

                // Sincronizamos POR NOMBRE
                $user->syncRoles($roleNames);
                }
            

            Log::info('User updated successfully', [
                'user_id' => $user->id,
            ]);

            return response()->json([
                'user'    => $user->load('roles'),
                'message' => 'User updated successfully.',
            ]);

        } catch (ValidationException $e) {
            return response()->json([
                'error'   => 'Validation failed',
                'details' => $e->errors(),
            ], 422);

        } catch (\Throwable $e) {
            Log::error('Unexpected error during user update', [
                'error_message' => $e->getMessage(),
            ]);
            return response()->json([
                'error'   => 'An unexpected error occurred.',
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

    public function destroy(Request $request, User $user)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId || $user->tenant_id !== $tenantId) {
            return response()->json(['error'=>'User not found for this tenant'], 404);
        }

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
