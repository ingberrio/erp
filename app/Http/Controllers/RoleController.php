<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Role;
use Spatie\Permission\Models\Permission;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    /**
     * Obtiene el guard por defecto de la aplicación.
     */
    private function defaultGuard(): string
    {
        return config('auth.defaults.guard');
    }

    /**
     * Listar todos los roles con sus permisos para el tenant actual.
     * GET /api/roles
     */
    public function index(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $roles = Role::with('permissions')
            ->where('tenant_id', $tenantId)
            ->get();

        return response()->json($roles);
    }

    /**
     * Crear un nuevo rol para el tenant actual.
     * POST /api/roles
     */
    public function store(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $guard     = $this->defaultGuard();

        $request->validate([
            'name' => [
                'required',
                Rule::unique('roles', 'name')
                    ->where(fn($query) => $query->where('tenant_id', $tenantId))
            ],
        ]);

        $role = Role::create([
            'name'       => $request->name,
            'tenant_id'  => $tenantId,
            'guard_name' => 'sanctum',
        ]);

        return response()->json($role, 201);
    }

    /**
     * Mostrar un rol específico (con permisos).
     * GET /api/roles/{id}
     */
    public function show(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');

        $role = Role::with('permissions')
            ->where('tenant_id', $tenantId)
            ->findOrFail($id);

        return response()->json($role);
    }

    /**
     * Actualizar nombre (y sólo el nombre) de un rol.
     * PUT /api/roles/{id}
     */
    public function update(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');

        $role = Role::where('tenant_id', $tenantId)
            ->findOrFail($id);

        $request->validate([
            'name' => [
                'required',
                Rule::unique('roles', 'name')
                    ->ignore($role->id)
                    ->where(fn($query) => $query->where('tenant_id', $tenantId))
            ],
        ]);

        $role->update([
            'name' => $request->name,
        ]);

        return response()->json($role);
    }

    /**
     * Borrar un rol.
     * DELETE /api/roles/{id}
     */
    public function destroy(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');

        $role = Role::where('tenant_id', $tenantId)
            ->findOrFail($id);

        $role->delete();

        return response()->noContent();
    }

    /**
     * Asignar permisos de forma masiva a un rol.
     * POST /api/roles/{role}/permissions
     */
    public function setPermissions(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');

        $role = Role::where('tenant_id', $tenantId)
            ->findOrFail($id);

        // Sólo tomar IDs válidos que existen en este tenant
        $permissionIds = Permission::whereIn('id', $request->permissions ?? [])
            ->where('tenant_id', $tenantId)
            ->pluck('id')
            ->toArray();

        try {
            $role->syncPermissions($permissionIds);

            Log::info("Permisos sincronizados correctamente", [
                'role_id'     => $role->id,
                'permissions' => $permissionIds,
            ]);

            return response()->json($role->load('permissions'));
        } catch (\Throwable $e) {
            Log::error("Error al sincronizar permisos", [
                'role_id' => $role->id,
                'error'   => $e->getMessage(),
            ]);

            return response()->json([
                'message' => "Error al asignar permisos: {$e->getMessage()}"
            ], 500);
        }
    }
}
