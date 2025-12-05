<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\RecordRetentionPolicy;

class RecordRetentionPolicySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('Seeding Health Canada compliant retention policies...');
        
        $policies = RecordRetentionPolicy::getDefaultPolicies();
        
        foreach ($policies as $policyData) {
            $existing = RecordRetentionPolicy::where('record_type', $policyData['record_type'])
                ->whereNull('tenant_id')
                ->first();
                
            if ($existing) {
                $existing->update($policyData);
                $this->command->line("Updated retention policy for: {$policyData['record_type']}");
            } else {
                RecordRetentionPolicy::create($policyData);
                $this->command->line("Created retention policy for: {$policyData['record_type']}");
            }
        }
        
        // Create additional Health Canada specific policies
        $additionalPolicies = [
            [
                'record_type' => 'regulatory_reports',
                'description' => 'CTLS and other regulatory reports must be retained for 5 years minimum',
                'retention_period_months' => 60,
                'is_active' => true,
                'retention_rules' => [
                    'auto_archive' => false, // Keep these accessible
                    'immutable_after_days' => 1,
                    'requires_approval_to_delete' => true,
                ]
            ],
            [
                'record_type' => 'loss_theft_reports',
                'description' => 'Loss and theft reports must be retained for 7 years per Health Canada requirements',
                'retention_period_months' => 84,
                'is_active' => true,
                'retention_rules' => [
                    'auto_archive' => false,
                    'immutable_after_days' => 0, // Immediately immutable
                    'requires_approval_to_delete' => true,
                ]
            ],
            [
                'record_type' => 'audit_logs',
                'description' => 'System audit logs for compliance tracking',
                'retention_period_months' => 36, // 3 years
                'is_active' => true,
                'retention_rules' => [
                    'auto_archive' => true,
                    'immutable_after_days' => 0,
                    'requires_approval_to_delete' => true,
                ]
            ],
        ];
        
        foreach ($additionalPolicies as $policyData) {
            $existing = RecordRetentionPolicy::where('record_type', $policyData['record_type'])
                ->whereNull('tenant_id')
                ->first();
                
            if ($existing) {
                $existing->update($policyData);
                $this->command->line("Updated retention policy for: {$policyData['record_type']}");
            } else {
                RecordRetentionPolicy::create($policyData);
                $this->command->line("Created retention policy for: {$policyData['record_type']}");
            }
        }
        
        $this->command->info('\nRecord retention policies seeded successfully!');
        $this->command->info('All policies meet Health Canada minimum requirements:');
        $this->command->info('- Traceability Events: 2 years minimum');
        $this->command->info('- Batch Records: 2 years minimum');
        $this->command->info('- Inventory Counts: 2 years minimum');
        $this->command->info('- Regulatory Reports: 5 years minimum');
        $this->command->info('- Loss/Theft Reports: 7 years minimum');
    }
}
