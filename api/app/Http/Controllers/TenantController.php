<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use Illuminate\Http\Request;

class TenantController extends Controller
{
    // Listar todos los tenants (solo para admin global)
    public function index(Request $request)
    {
        // Opcional: Solo admins pueden ver todos los tenants
        // if (!$request->user()->is_admin) {
        //     return response()->json(['error' => 'Unauthorized'], 403);
        // }

        return Tenant::all();
    }

    // Crear un nuevo tenant (empresa)
    public function store(Request $request)
    {
        // Opcional: Solo admins pueden crear tenants
        // if (!$request->user()->is_admin) {
        //     return response()->json(['error' => 'Unauthorized'], 403);
        // }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact_email' => 'nullable|email',
        ]);

        $tenant = Tenant::create($validated);
        return response()->json($tenant, 201);
    }

    // Mostrar un tenant específico
    public function show(Tenant $tenant)
    {
        return $tenant;
    }

    // Actualizar un tenant
    public function update(Request $request, Tenant $tenant)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'contact_email' => 'nullable|email',
        ]);

        $tenant->update($validated);
        return response()->json($tenant);
    }

    // Eliminar un tenant
    public function destroy(Tenant $tenant)
    {
        $tenant->delete();
        return response()->json(['message' => 'Tenant deleted successfully']);
    }
}
