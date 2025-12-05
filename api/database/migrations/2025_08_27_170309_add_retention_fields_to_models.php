<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add retention fields to traceability_events
        Schema::table('traceability_events', function (Blueprint $table) {
            $table->timestamp('retention_expires_at')->nullable()->after('updated_at');
            $table->boolean('is_archived')->default(false)->after('retention_expires_at');
            $table->timestamp('archived_at')->nullable()->after('is_archived');
            $table->text('archive_reason')->nullable()->after('archived_at');
            
            $table->index(['retention_expires_at', 'is_archived']);
        });
        
        // Add retention fields to batches
        Schema::table('batches', function (Blueprint $table) {
            $table->timestamp('retention_expires_at')->nullable()->after('updated_at');
            $table->boolean('is_archived')->default(false)->after('retention_expires_at');
            $table->timestamp('archived_at')->nullable()->after('is_archived');
            $table->text('archive_reason')->nullable()->after('archived_at');
            
            $table->index(['retention_expires_at', 'is_archived']);
        });
        
        // Add retention fields to inventory_physical_counts
        Schema::table('inventory_physical_counts', function (Blueprint $table) {
            $table->timestamp('retention_expires_at')->nullable()->after('updated_at');
            $table->boolean('is_archived')->default(false)->after('retention_expires_at');
            $table->timestamp('archived_at')->nullable()->after('is_archived');
            $table->text('archive_reason')->nullable()->after('archived_at');
            
            $table->index(['retention_expires_at', 'is_archived']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('traceability_events', function (Blueprint $table) {
            $table->dropColumn([
                'retention_expires_at',
                'is_archived',
                'archived_at',
                'archive_reason'
            ]);
        });
        
        Schema::table('batches', function (Blueprint $table) {
            $table->dropColumn([
                'retention_expires_at',
                'is_archived',
                'archived_at',
                'archive_reason'
            ]);
        });
        
        Schema::table('inventory_physical_counts', function (Blueprint $table) {
            $table->dropColumn([
                'retention_expires_at',
                'is_archived',
                'archived_at',
                'archive_reason'
            ]);
        });
    }
};
