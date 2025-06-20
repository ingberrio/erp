<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Permission;

class PermissionController extends Controller
{
    // Lista permisos del tenant actual
    public function index(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        return Permission::where('tenant_id', $tenantId)->get();
    }

    // Crea permiso para el tenant actual
    public function store(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $request->validate([
            'name' => 'required|unique:permissions,name,NULL,id,tenant_id,' . $tenantId,
        ]);
        return Permission::create([
            'name' => $request->name,
            'tenant_id' => $tenantId,
            'guard_name' => 'sanctum',
        ]);
    }

    public function show(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');
        return Permission::where('tenant_id', $tenantId)->findOrFail($id);
    }

    public function update(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $permission = Permission::where('tenant_id', $tenantId)->findOrFail($id);
        $request->validate([
            'name' => 'required|unique:permissions,name,' . $permission->id . ',id,tenant_id,' . $tenantId,
        ]);
        $permission->update(['name' => $request->name]);
        return $permission;
    }

    public function destroy(Request $request, $id)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $permission = Permission::where('tenant_id', $tenantId)->findOrFail($id);
        $permission->delete();
        return response()->noContent();
    }
}
