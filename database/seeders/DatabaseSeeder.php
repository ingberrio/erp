<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Tenant;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Crear el rol 'Admin' (si lo necesitas para administradores de tenant)
        $adminRole = Role::firstOrCreate(['name' => 'Admin', 'guard_name' => 'sanctum']); // Usar 'sanctum' si ese es tu guard principal para APIs
        
        // Opcional: Crear algunos permisos y asignarlos al rol 'Admin'
        // $viewUsersPermission = Permission::firstOrCreate(['name' => 'view-users', 'guard_name' => 'sanctum']);
        // $adminRole->givePermissionTo([$viewUsersPermission]);


        // Crear un Tenant si no existe
        $tenant = Tenant::firstOrCreate(
            ['name' => 'Default Tenant']
            // No se incluye 'subdomain' si no existe en la migración de tenants
        );

        // Crear Super Admin (Global Admin)
        $superAdmin = User::firstOrCreate(
            ['email' => 'demo@demo.com'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('12345678'),
                'tenant_id' => null, // ¡CRÍTICO! DEBE SER NULL
                'is_global_admin' => true, // <--- ¡ASEGURARSE DE QUE ESTA LÍNEA ESTÉ AQUÍ!
            ]
        );

        // No asignamos un rol al Super Admin, su acceso completo se maneja en el modelo User.

        // Crear otros usuarios de prueba para el tenant
        $tenantUser = User::firstOrCreate(
            ['email' => 'user@tenant.com'],
            [
                'name' => 'Tenant User',
                'password' => Hash::make('password'),
                'tenant_id' => $tenant->id,
                'is_global_admin' => false,
            ]
        );
        // Opcional: Crear un rol 'User' y asignárselo
        $userRole = Role::firstOrCreate(['name' => 'User', 'guard_name' => 'sanctum']); // Usar 'sanctum'
        $tenantUser->assignRole($userRole);


        // Llamar a otros seeders si los tienes
        // $this->call([
        //     OtherSeeder::class,
        // ]);
    }
}
