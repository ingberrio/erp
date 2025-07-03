<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use App\Models\User; // Asegúrate de importar tu modelo User

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

            // Autenticación manual para Sanctum
            $user = User::where('email', $request->email)->first();

            if (!$user || !Hash::check($request->password, $user->password)) {
                Log::warning('Login: Authentication failed for email.', ['email' => $request->email]);
                throw ValidationException::withMessages([
                    'email' => ['Las credenciales proporcionadas son incorrectas.'],
                ]);
            }

            Log::info('Login: User successfully authenticated by manual check.', ['user_id' => $user->id, 'email' => $user->email]);

            // Verificar si el usuario es un administrador global o tiene un tenant_id
            if (!$user->is_global_admin && is_null($user->tenant_id)) {
                Log::warning('Login: User is neither global admin nor has a tenant ID.', ['user_id' => $user->id]);
                throw ValidationException::withMessages([
                    'email' => ['Tu cuenta no está asociada a una empresa.'],
                ]);
            }
            Log::info('Login: User passed global admin/tenant_id check.', ['user_id' => $user->id, 'is_global_admin' => $user->is_global_admin, 'tenant_id' => $user->tenant_id]);


            // Eliminar tokens antiguos para evitar acumulación
            $user->tokens()->delete();

            // Crear un nuevo token de Sanctum
            $token = $user->createToken('auth_token', ['*'])->plainTextToken;
            Log::info('Login: API token created for user.', ['user_id' => $user->id]);

            // Cargar roles y permisos del usuario para el frontend
            // Asegúrate de que las relaciones 'roles' y 'permissions' estén definidas en tu modelo User
            // y que el TenantScope esté correctamente aplicado para evitar ambigüedades.
            $user->load('roles.permissions');

            Log::info('Login: Returning successful response.', ['user_id' => $user->id, 'tenant_id' => $user->tenant_id, 'is_global_admin' => $user->is_global_admin]);

            return response()->json([
                'token' => $token,
                'user' => $user, // Devolver el objeto de usuario completo con roles y permisos
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
        // Cargar roles y permisos del usuario
        $user->load('roles.permissions');
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
            return response()->json(['message' => 'Successfully logged out']);
        }
        return response()->json(['message' => 'No user authenticated.'], 401);
    }
}
