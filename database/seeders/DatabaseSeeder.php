<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Tenant;
use App\TenantContext;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Ensure we have at least one tenant
        $tenant = Tenant::first() ?? Tenant::create(['name' => 'Default Tenant']);

        // Optionally set the context so factories auto assign the tenant_id
        TenantContext::setTenantId($tenant->id);

        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'tenant_id' => $tenant->id,
        ]);
    }
}
