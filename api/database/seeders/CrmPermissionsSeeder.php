<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class CrmPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // CRM Permissions
        $permissions = [
            'view-crm-accounts',
            'create-crm-accounts',
            'edit-crm-accounts',
            'delete-crm-accounts',
            'view-crm-orders',
            'create-crm-orders',
            'edit-crm-orders',
            'delete-crm-orders',
            'view-crm-shipments',
            'create-crm-shipments',
            'edit-crm-shipments',
            'delete-crm-shipments',
            'view-crm-analytics',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'sanctum'
            ]);
        }

        // Assign CRM permissions to Admin role
        $adminRole = Role::where('name', 'Admin')->first();
        if ($adminRole) {
            $adminRole->givePermissionTo($permissions);
        }

        $this->command->info('CRM permissions created successfully!');
    }
}
