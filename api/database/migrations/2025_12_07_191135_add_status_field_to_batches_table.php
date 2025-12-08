<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Add batch status field for Health Canada compliance.
     * Status values:
     * - active: Normal batch in production
     * - on_hold: Temporarily held for review
     * - quarantine: Isolated for quality/safety issues
     * - released: Approved for sale/distribution
     * - in_transit: Being moved between locations
     * - destroyed: Batch has been destroyed
     * - sold: Batch has been sold
     */
    public function up(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            // Status field with default 'active'
            $table->string('status', 50)->default('active')->after('is_recalled');
            
            // Status change tracking
            $table->timestamp('status_changed_at')->nullable()->after('status');
            $table->text('status_change_reason')->nullable()->after('status_changed_at');
            $table->foreignId('status_changed_by_user_id')->nullable()->after('status_change_reason')
                  ->constrained('users')->nullOnDelete();
            
            // Index for faster queries by status
            $table->index('status');
        });
        
        // Update existing batches: set status based on current flags
        \DB::statement("
            UPDATE batches 
            SET status = CASE 
                WHEN is_archived = true THEN 'archived'
                WHEN is_recalled = true THEN 'quarantine'
                ELSE 'active'
            END
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->dropForeign(['status_changed_by_user_id']);
            $table->dropIndex(['status']);
            $table->dropColumn([
                'status',
                'status_changed_at',
                'status_change_reason',
                'status_changed_by_user_id'
            ]);
        });
    }
};
