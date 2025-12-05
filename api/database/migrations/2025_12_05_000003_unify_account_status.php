<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // For PostgreSQL: First drop the check constraint, modify the column, then recreate
        
        // Drop existing check constraint
        DB::statement("ALTER TABLE crm_accounts DROP CONSTRAINT IF EXISTS crm_accounts_account_status_check");
        
        // Change column to varchar temporarily to allow new values
        DB::statement("ALTER TABLE crm_accounts ALTER COLUMN account_status TYPE VARCHAR(50)");
        
        // Update existing records: if is_active = false, set status to 'suspended'
        // if is_active = true and status is 'pending', change to 'active'
        DB::table('crm_accounts')
            ->where('is_active', false)
            ->update(['account_status' => 'suspended']);
        
        DB::table('crm_accounts')
            ->where('is_active', true)
            ->where('account_status', 'pending')
            ->update(['account_status' => 'active']);

        // Set default value
        DB::statement("ALTER TABLE crm_accounts ALTER COLUMN account_status SET DEFAULT 'active'");
        
        // Add new check constraint with 'active' included
        DB::statement("ALTER TABLE crm_accounts ADD CONSTRAINT crm_accounts_account_status_check CHECK (account_status IN ('active', 'pending', 'awaiting_approval', 'approved', 'rejected', 'suspended'))");

        // Drop the is_active column
        Schema::table('crm_accounts', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Add back is_active column
        Schema::table('crm_accounts', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('notes');
        });

        // Restore is_active based on status
        DB::table('crm_accounts')
            ->where('account_status', 'suspended')
            ->update(['is_active' => false]);

        DB::table('crm_accounts')
            ->where('account_status', '!=', 'suspended')
            ->update(['is_active' => true]);

        // Drop check constraint
        DB::statement("ALTER TABLE crm_accounts DROP CONSTRAINT IF EXISTS crm_accounts_account_status_check");
        
        // Revert: convert 'active' to 'pending'
        DB::table('crm_accounts')
            ->where('account_status', 'active')
            ->update(['account_status' => 'pending']);

        // Set default back to pending
        DB::statement("ALTER TABLE crm_accounts ALTER COLUMN account_status SET DEFAULT 'pending'");
        
        // Add constraint without 'active'
        DB::statement("ALTER TABLE crm_accounts ADD CONSTRAINT crm_accounts_account_status_check CHECK (account_status IN ('pending', 'awaiting_approval', 'approved', 'rejected', 'suspended'))");
    }
};
