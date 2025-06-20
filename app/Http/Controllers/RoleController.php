<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Role; // <--- ¡IMPORTANTE! Cambia esto para usar tu modelo App\Models\Role
use Spatie\Permission\Models\Permission;
use Illuminate\Support\Facades\Log; // Puedes añadir esto para depuración si lo necesitas
use Illuminate\Validation\Rule; // Si usas Rule::unique

class RoleController extends Controller
{
    // Lista roles con sus permisos para el tenant actual
    public function index(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        // Usará tu App\Models\Role que ya tiene el scope si BelongsToTenant funciona globalmente
        return Role::with('permissions')->where('tenant_id', $tenantId)->get();
    }

    // Crear rol
    public function store(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $request->validate([
            'name' => [
                'required',
                // Asegúrate de que 'tenant_id' se usa correctamente en la validación unique para multi-tenancy
                Rule::unique('roles', 'name')->where(function ($query) use ($tenantId) {
                    return $query->where('tenant_id', $tenantId);
                })
            ],
        ]);
        return Role::create([
            'name' => $request->name,
            'tenant_id' => $tenantId,
            'guard_name' => 'sanctum',
        ]);
    }

    public function show(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');
        return Role::with('permissions')->where('tenant_id', $tenantId)->findOrFail($id);
    }

    public function update(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $role = Role::where('tenant_id', $tenantId)->findOrFail($id);
        $request->validate([
            'name' => [
                'required',
                // Asegúrate de que 'tenant_id' se usa correctamente en la validación unique para multi-tenancy
                Rule::unique('roles', 'name')->ignore($role->id)->where(function ($query) use ($tenantId) {
                    return $query->where('tenant_id', $tenantId);
                })
            ],
        ]);
        $role->update(['name' => $request->name]);
        return $role;
    }

    public function destroy(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $role = Role::where('tenant_id', $tenantId)->findOrFail($id);
        // El error debería resolverse aquí, ya que $role es ahora una instancia de App\Models\Role
        // que tiene la relación 'users' bien definida.
        $role->delete();
        return response()->noContent();
    }

    // Asignar permisos a un rol (POST /roles/{role}/permissions)
    public function setPermissions(Request $request, $id)
{
    $tenantId = $request->header('X-Tenant-ID');
    $role = Role::where('tenant_id', $tenantId)->findOrFail($id);

    $permissionIds = Permission::whereIn('id', $request->permissions ?? [])
        ->where('tenant_id', $tenantId)
        ->pluck('id')->toArray();

    try {
        $role->syncPermissions($permissionIds);
        Log::info('Permisos sincronizados correctamente para el rol.', ['role_id' => $role->id, 'permissions' => $permissionIds]);
        return $role->load('permissions');
    } catch (\Exception $e) {
        Log::error("Error al sincronizar permisos para el rol: " . $e->getMessage(), ['role_id' => $role->id, 'exception' => $e]);
        return response()->json(['message' => 'Error al asignar permisos: ' . $e->getMessage()], 500);
    }
}
}