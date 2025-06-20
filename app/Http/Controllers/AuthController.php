<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use App\TenantContext; // <-- Make sure to import TenantContext
use Illuminate\Support\Facades\Log; // For logging


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
        
        // --- ADD THESE LINES HERE ---
        if ($user->tenant_id) {
            TenantContext::setTenantId($user->tenant_id);
            Log::info('Auth: Login - Tenant ID set from authenticated user:', ['tenant_id' => $user->tenant_id]);
        } else {
            // Optional: Handle cases where a user might not have a tenant_id (e.g., global admin)
            Log::warning('Auth: Login - User authenticated but no tenant_id found or set.', ['user_id' => $user->id ?? 'N/A']);
        }
        // --- END ADDED LINES ---

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'user'  => $user,
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
}
