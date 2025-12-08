<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds recall functionality for Health Canada compliance.
     * When a batch is marked as recalled, it should not be included in orders
     * or shipped to customers.
     */
    public function up(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->boolean('is_recalled')->default(false)->after('is_archived');
            $table->timestamp('recalled_at')->nullable()->after('is_recalled');
            $table->text('recall_reason')->nullable()->after('recalled_at');
            $table->foreignId('recalled_by_user_id')->nullable()->after('recall_reason')
                ->constrained('users')->onDelete('set null');
            
            // Index for quick filtering of recalled batches
            $table->index('is_recalled');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->dropForeign(['recalled_by_user_id']);
            $table->dropIndex(['is_recalled']);
            $table->dropColumn([
                'is_recalled',
                'recalled_at',
                'recall_reason',
                'recalled_by_user_id'
            ]);
        });
    }
};
