<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use App\TenantContext;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth; // ¡IMPORTA LA FACHADA AUTH!

class AuthController extends Controller
{
    // Registro de usuario
    public function register(Request $request)
    {
        $request->validate([
            'name'      => 'required|string|max:255',
            'email'     => 'required|email|unique:users,email',
            'password'  => 'required|string|min:6',
            'tenant_id' => 'required|exists:tenants,id', // El usuario debe estar asociado a un tenant
        ]);

        $user = User::create([
            'name'      => $request->name,
            'email'     => $request->email,
            'password'  => bcrypt($request->password),
            'tenant_id' => $request->tenant_id,
        ]);
        
        if ($user->tenant_id) {
            TenantContext::setTenantId($user->tenant_id);
            \Illuminate\Support\Facades\Log::info('Auth: Register - Tenant ID set from new user:', ['tenant_id' => $user->tenant_id]);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'user'  => $user,
            'token' => $token,
        ], 201);
    }

    // Login de usuario
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }
        
        if ($user->tenant_id) {
            TenantContext::setTenantId($user->tenant_id);
            Log::info('Auth: Login - Tenant ID set from authenticated user:', ['tenant_id' => $user->tenant_id]);
        } else {
            Log::warning('Auth: Login - User authenticated but no tenant_id found or set.', ['user_id' => $user->id ?? 'N/A']);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        // Después de un login exitoso, también devolvemos el usuario con sus permisos.
        // Esto es similar a lo que hace el método `user()`, pero se incluye aquí para la respuesta inicial de login.
        $user->load('roles.permissions'); // Cargar roles y sus permisos

        $permissions = $user->roles->flatMap(function ($role) {
            return $role->permissions->pluck('name');
        })->unique()->values()->toArray();

        if ($user->hasRole('Admin')) { // Asegúrate de que 'Admin' es el nombre de tu rol de administrador
            $permissions[] = 'admin';
            $permissions = array_unique($permissions);
        }

        return response()->json([
            'user'  => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'tenant_id' => $user->tenant_id,
                'facility_id' => $user->facility_id ?? null, // Asegúrate de que facility_id se incluya si existe
                'permissions' => $permissions, // ¡Aquí se incluyen los permisos!
            ],
            'token' => $token,
        ]);
    }

    // Logout (revocar token actual)
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Successfully logged out'
        ]);
    }

    /**
     * Get the authenticated user's details, including roles and permissions.
     * Este método es llamado por el frontend después de la carga inicial o al recargar la página.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function user(Request $request)
    {
        $user = Auth::user();

        if (!$user) {
            // Si no hay usuario autenticado, registra un warning y devuelve 401.
            Log::warning('Auth: user() - No authenticated user found.');
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // --- PASO CRUCIAL 1: Cargar las relaciones de roles y sus permisos ---
        // Sin esta línea, los roles y permisos no estarán disponibles en el objeto $user.
        $user->load('roles.permissions');

        // Para depuración: verificar si los roles se cargaron
        Log::debug('Auth: user() - User after loading relations:', [
            'user_id' => $user->id,
            'email' => $user->email,
            'roles_count' => $user->roles->count(),
            'roles_data' => $user->roles->pluck('name')->toArray() // Nombres de los roles cargados
        ]);


        // --- PASO CRUCIAL 2: Recopilar todos los nombres de permisos únicos ---
        // Itera sobre los roles cargados y extrae los nombres de sus permisos.
        $permissions = $user->roles->flatMap(function ($role) {
            return $role->permissions->pluck('name');
        })->unique()->values()->toArray();

        // Para depuración: verificar los permisos recolectados
        Log::debug('Auth: user() - Collected permissions from roles:', ['permissions' => $permissions]);


        // --- PASO CRUCIAL 3: Añadir el permiso 'admin' si el usuario tiene el rol 'Admin' ---
        // Esto es importante para que el frontend pueda usar 'admin' como un comodín para acceso total.
        if ($user->hasRole('Admin')) { // Asegúrate de que 'Admin' es el nombre de tu rol de administrador
            $permissions[] = 'admin';
            $permissions = array_unique($permissions); // Eliminar duplicados si 'admin' ya estaba por otro rol/permiso
            Log::debug('Auth: user() - Added "admin" permission for Admin role.', ['final_permissions' => $permissions]);
        }

        // --- PASO CRUCIAL 4: Devolver el objeto de usuario con la propiedad 'permissions' ---
        // El frontend espera esta propiedad para actualizar su estado de permisos.
        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'tenant_id' => $user->tenant_id,
            'facility_id' => $user->facility_id ?? null, // Asegúrate de que facility_id se incluya si existe, o null
            'permissions' => $permissions, // ¡Esta es la propiedad que el frontend necesita!
        ]);
    }
}
