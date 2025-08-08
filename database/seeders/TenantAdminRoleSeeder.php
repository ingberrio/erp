<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;

class TenantAdminRoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        // Limpiar caché de roles y permisos
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // 1. Permisos exclusivos de empresas (solo super admin)
        $companyExclusivePermissions = [
            'view-companies',
            'manage-companies',
            'create-company',
            'update-company',
            'delete-company',
        ];

        // 2. Crear estos permisos si no existen
        foreach ($companyExclusivePermissions as $permissionName) {
            Permission::firstOrCreate(['name' => $permissionName, 'guard_name' => 'web']);
            Permission::firstOrCreate(['name' => $permissionName, 'guard_name' => 'sanctum']);
        }

        // 3. Obtener todos los permisos
        $allPermissionNames = Permission::pluck('name')->toArray();

        // 4. Quitar los exclusivos de empresa para el rol tenant_admin
        $permissionsForTenantAdmin = array_diff($allPermissionNames, $companyExclusivePermissions);

        // 5. Crear o encontrar el rol tenant_admin
        $tenantAdminRole = Role::firstOrCreate(['name' => 'tenant_admin', 'guard_name' => 'web']);
        $tenantAdminRoleApi = Role::firstOrCreate(['name' => 'tenant_admin', 'guard_name' => 'sanctum']);

        // 6. Asignar permisos al rol tenant_admin (web y sanctum)
        $tenantAdminRole->syncPermissions($permissionsForTenantAdmin);
        $tenantAdminRoleApi->syncPermissions($permissionsForTenantAdmin);

        $this->command->info('Rol "Administrador de Tenant" actualizado correctamente.');

        // 7. Asignar el rol a tu usuario admin de tenant (reemplaza el correo)
        $adminTenantUser = User::where('email', 'user@tenant.com')->first();
        if ($adminTenantUser && !$adminTenantUser->is_global_admin) {
            $adminTenantUser->assignRole($tenantAdminRole);
            $adminTenantUser->assignRole($tenantAdminRoleApi);
            $this->command->info('Usuario de prueba asignado al rol "Administrador de Tenant".');
        }
    }
}
