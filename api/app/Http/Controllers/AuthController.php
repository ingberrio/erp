<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use Illuminate\Support\Facades\Config;

class AuthController extends Controller
{
    /**
     * Handle user login.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function login(Request $request)
    {
        Log::info('Login attempt started for email: ', ['email' => $request->email, 'ip' => $request->ip()]);

        try {
            $request->validate([
                'email' => 'required|email',
                'password' => 'required',
            ]);
            Log::info('Login: Validation passed for request data.');

            $user = User::where('email', $request->email)->first();

            if (!$user || !Hash::check($request->password, $user->password)) {
                Log::warning('Login: Authentication failed for email.', ['email' => $request->email]);
                throw ValidationException::withMessages([
                    'email' => ['Las credenciales proporcionadas son incorrectas.'],
                ]);
            }

            Log::info('Login: User successfully authenticated by manual check.', ['user_id' => $user->id, 'email' => $user->email]);

            if (!$user->is_global_admin && is_null($user->tenant_id)) {
                Log::warning('Login: User is neither global admin nor has a tenant ID.', ['user_id' => $user->id]);
                throw ValidationException::withMessages([
                    'email' => ['Tu cuenta no está asociada a una empresa.'],
                ]);
            }
            Log::info('Login: User passed global admin/tenant_id check.', ['user_id' => $user->id, 'is_global_admin' => $user->is_global_admin, 'tenant_id' => $user->tenant_id]);

            $user->tokens()->delete();
            $token = $user->createToken('auth_token', ['*'])->plainTextToken;
            Log::info('Login: API token created for user.', ['user_id' => $user->id]);

            // --- ¡CAMBIOS CLAVE AQUÍ! ---
            // Guardar la configuración actual de Spatie teams
            $originalTeamsConfig = Config::get('permission.teams');
            $originalCurrentTeamId = Config::get('permission.current_team_id');

            // Si el usuario no es global admin, temporalmente deshabilitar teams para cargar TODOS los roles/permisos
            // Esto es necesario porque Spatie, al cargar relaciones, puede filtrar agresivamente por current_team_id
            // incluso para roles globales que no tienen un tenant_id.
            if (!$user->is_global_admin) {
                Config::set('permission.teams', false);
                Config::set('permission.current_team_id', null); // Asegurarse de que no haya filtro de team
                Log::info('Login: Temporarily disabling Spatie teams for role/permission loading for tenant user.', ['user_id' => $user->id]);
            }

            // Cargar roles y permisos del usuario
            $user->load('roles.permissions');

            // Restaurar la configuración original de Spatie teams
            Config::set('permission.teams', $originalTeamsConfig);
            Config::set('permission.current_team_id', $originalCurrentTeamId);
            Log::info('Login: Restored original Spatie teams configuration.');
            // --- FIN DE CAMBIOS CLAVE ---

            // Obtener los nombres de los permisos
            $permissions = $user->getAllPermissions()->pluck('name')->toArray();
            Log::info('Login: User permissions collected.', ['permissions' => $permissions]);

            Log::info('Login: Returning successful response.', ['user_id' => $user->id, 'tenant_id' => $user->tenant_id, 'is_global_admin' => $user->is_global_admin]);

            return response()->json([
                'token' => $token,
                'user' => [ // Construir el objeto user explícitamente
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'tenant_id' => $user->tenant_id,
                    'is_global_admin' => (bool) $user->is_global_admin,
                    'facility_id' => $user->facility_id, // Asegúrate de incluirlo si existe
                    'permissions' => $permissions, // ¡Aquí se añade el array de permisos!
                    // Puedes añadir otras propiedades del usuario que necesites en el frontend
                ],
            ]);

        } catch (ValidationException $e) {
            Log::error('Login: Validation failed during login process.', ['errors' => $e->errors()]);
            return response()->json([
                'message' => 'Fallo de validación.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            Log::critical('Login: Unexpected error during login process.', [
                'error_message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'Ocurrió un error inesperado durante el login.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get the authenticated User.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function user(Request $request)
    {
        $user = Auth::guard('sanctum')->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Get roles and permissions directly from database to bypass Spatie team filtering
        $roleIds = \DB::table('model_has_roles')
            ->where('model_id', $user->id)
            ->where('model_type', get_class($user))
            ->pluck('role_id');
        
        Log::info('User method: Found role IDs for user.', ['user_id' => $user->id, 'role_ids' => $roleIds->toArray()]);

        // Get permission names from these roles
        $permissions = [];
        if ($roleIds->isNotEmpty()) {
            $permissionIds = \DB::table('role_has_permissions')
                ->whereIn('role_id', $roleIds)
                ->pluck('permission_id');
            
            $permissions = \DB::table('permissions')
                ->whereIn('id', $permissionIds)
                ->pluck('name')
                ->toArray();
        }

        // Also get direct permissions if any
        $directPermissionIds = \DB::table('model_has_permissions')
            ->where('model_id', $user->id)
            ->where('model_type', get_class($user))
            ->pluck('permission_id');
        
        if ($directPermissionIds->isNotEmpty()) {
            $directPerms = \DB::table('permissions')
                ->whereIn('id', $directPermissionIds)
                ->pluck('name')
                ->toArray();
            $permissions = array_unique(array_merge($permissions, $directPerms));
        }

        Log::info('User method: User permissions collected.', ['permissions' => $permissions]);

        // Devolver el usuario y sus permisos de forma explícita
        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'tenant_id' => $user->tenant_id,
            'is_global_admin' => (bool) $user->is_global_admin,
            'facility_id' => $user->facility_id ?? null,
            'permissions' => $permissions,
        ]);
    }

    /**
     * Log the user out (Revoke the token).
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function logout(Request $request)
    {
        $user = Auth::guard('sanctum')->user();
        if ($user) {
            $user->tokens()->where('id', $user->currentAccessToken()->id)->delete();
            Log::info('User logged out successfully.', ['user_id' => $user->id]);
            return response()->noContent(); // 204 No Content
        }
        return response()->json(['message' => 'No user authenticated.'], 401);
    }
}
