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
    /**
     * Display a listing of the resource (GET /api/users).
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (is_null($tenantId)) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            $users = User::where('tenant_id', $tenantId)->with('roles')->get();
            return response()->json($users);
        } catch (\Throwable $e) {
            Log::error('Error fetching users', [
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Failed to fetch users'], 500);
        }
    }

    /**
     * Store a newly created resource in storage (POST /api/users).
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (is_null($tenantId)) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        Log::debug('Request payload', [
            'payload' => $request->all(),
            'tenant_id' => $tenantId,
        ]);

        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'email' => [
                    'required',
                    'string',
                    'email',
                    'max:255',
                    Rule::unique('users', 'email')->where('tenant_id', $tenantId),
                ],
                'password' => 'required|string|min:8',
                'roles' => 'sometimes|array',
                'roles.*' => [
                    'integer',
                    Rule::exists('roles', 'id')->where(function ($query) use ($tenantId) {
                        $query->where('tenant_id', $tenantId)->where('guard_name', 'sanctum');
                    }),
                ],
                'tenant_id' => 'prohibited',
            ]);

            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'tenant_id' => $tenantId,
            ]);

            if (!empty($validated['roles'])) {
                Log::info('Attempting to sync roles for user', [
                    'user_id' => $user->id,
                    'tenant_id' => $tenantId,
                    'roles' => $validated['roles'],
                ]);
                $user->syncRoles($validated['roles'], 'sanctum');
            }

            Log::info('User created successfully', [
                'user_id' => $user->id,
                'tenant_id' => $tenantId,
            ]);

            return response()->json([
                'user' => $user->load('roles'),
                'message' => 'User created successfully.'
            ], 201);

        } catch (ValidationException $e) {
            Log::error('Validation failed during user creation', [
                'tenant_id' => $tenantId,
                'errors' => $e->errors(),
                'payload' => $request->all(),
            ]);
            return response()->json([
                'error' => 'Validation failed',
                'details' => $e->errors(),
            ], 422);
        } catch (\Spatie\Permission\Exceptions\RoleDoesNotExist $e) {
            Log::error('Role does not exist during sync', [
                'tenant_id' => $tenantId,
                'roles' => $validated['roles'] ?? [],
                'error_message' => $e->getMessage(),
            ]);
            return response()->json([
                'error' => 'One or more roles do not exist.',
                'details' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during user creation', [
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
            return response()->json([
                'error' => 'An unexpected error occurred.',
                'details' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified resource (GET /api/users/{id}).
     *
     * @param  \App\Models\User  $user
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request, User $user)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (is_null($tenantId)) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            if ($user->tenant_id !== $tenantId) {
                return response()->json(['error' => 'User not found for this tenant'], 404);
            }
            $user->load('roles');
            return response()->json($user);
        } catch (\Throwable $e) {
            Log::error('Error fetching user', [
                'user_id' => $user->id,
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Failed to fetch user'], 500);
        }
    }

    /**
     * Update the specified resource in storage (PUT/PATCH /api/users/{id}).
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\User  $user
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, User $user)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (is_null($tenantId)) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        if ($user->tenant_id !== $tenantId) {
            return response()->json(['error' => 'User not found for this tenant'], 404);
        }

        Log::debug('Request payload', [
            'payload' => $request->all(),
            'tenant_id' => $tenantId,
        ]);

        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'email' => [
                    'required',
                    'string',
                    'email',
                    'max:255',
                    Rule::unique('users', 'email')->ignore($user->id)->where('tenant_id', $tenantId),
                ],
                'password' => 'nullable|string|min:8',
                'roles' => 'sometimes|array',
                'roles.*' => [
                    'integer',
                    Rule::exists('roles', 'id')->where(function ($query) use ($tenantId) {
                        $query->where('tenant_id', $tenantId)->where('guard_name', 'sanctum');
                    }),
                ],
            ]);

            $user->update([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => isset($validated['password']) ? Hash::make($validated['password']) : $user->password,
            ]);

            if (!empty($validated['roles'])) {
                Log::info('Attempting to sync roles for user', [
                    'user_id' => $user->id,
                    'tenant_id' => $tenantId,
                    'roles' => $validated['roles'],
                ]);
                $user->syncRoles($validated['roles'], 'sanctum');
            }

            Log::info('User updated successfully', [
                'user_id' => $user->id,
                'tenant_id' => $tenantId,
            ]);

            return response()->json([
                'user' => $user->load('roles'),
                'message' => 'User updated successfully.'
            ]);

        } catch (ValidationException $e) {
            Log::error('Validation failed during user update', [
                'user_id' => $user->id,
                'tenant_id' => $tenantId,
                'errors' => $e->errors(),
                'payload' => $request->all(),
            ]);
            return response()->json([
                'error' => 'Validation failed',
                'details' => $e->errors(),
            ], 422);
        } catch (\Spatie\Permission\Exceptions\RoleDoesNotExist $e) {
            Log::error('Role does not exist during sync', [
                'user_id' => $user->id,
                'tenant_id' => $tenantId,
                'roles' => $validated['roles'] ?? [],
                'error_message' => $e->getMessage(),
            ]);
            return response()->json([
                'error' => 'One or more roles do not exist.',
                'details' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during user update', [
                'user_id' => $user->id,
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
            return response()->json([
                'error' => 'An unexpected error occurred.',
                'details' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified resource from storage (DELETE /api/users/{id}).
     *
     * @param  \App\Models\User  $user
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, User $user)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (is_null($tenantId)) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        if ($user->tenant_id !== $tenantId) {
            return response()->json(['error' => 'User not found for this tenant'], 404);
        }

        try {
            $user->delete();
            Log::info('User deleted successfully', [
                'user_id' => $user->id,
                'tenant_id' => $tenantId,
            ]);
            return response()->noContent();
        } catch (\Throwable $e) {
            Log::error('Error deleting user', [
                'user_id' => $user->id,
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Failed to delete user'], 500);
        }
    }
}