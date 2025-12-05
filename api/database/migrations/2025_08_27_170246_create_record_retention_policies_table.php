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
        Schema::create('record_retention_policies', function (Blueprint $table) {
            $table->id();
            $table->string('record_type'); // 'traceability_events', 'batches', 'inventory_counts', etc.
            $table->string('description');
            $table->integer('retention_period_months')->default(24); // Health Canada minimum: 24 months
            $table->boolean('is_active')->default(true);
            $table->json('retention_rules')->nullable(); // Additional rules as JSON
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->onDelete('cascade');
            $table->timestamps();
            
            // Indexes for performance
            $table->index(['record_type', 'is_active']);
            $table->index('tenant_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('record_retention_policies');
    }
};
