<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use Illuminate\Support\Facades\Config; // <-- ¡Añadir esta importación!

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

            Log::info('Login: Returning successful response.', ['user_id' => $user->id, 'tenant_id' => $user->tenant_id, 'is_global_admin' => $user->is_global_admin]);

            return response()->json([
                'token' => $token,
                'user' => $user,
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

        // --- ¡CAMBIOS CLAVE AQUÍ TAMBIÉN! ---
        $originalTeamsConfig = Config::get('permission.teams');
        $originalCurrentTeamId = Config::get('permission.current_team_id');

        if (!$user->is_global_admin) {
            Config::set('permission.teams', false);
            Config::set('permission.current_team_id', null);
            Log::info('User method: Temporarily disabling Spatie teams for role/permission loading for tenant user.', ['user_id' => $user->id]);
        }

        $user->load('roles.permissions');

        Config::set('permission.teams', $originalTeamsConfig);
        Config::set('permission.current_team_id', $originalCurrentTeamId);
        Log::info('User method: Restored original Spatie teams configuration.');
        // --- FIN DE CAMBIOS CLAVE ---

        return response()->json($user);
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
