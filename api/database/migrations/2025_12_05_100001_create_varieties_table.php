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
        Schema::create('varieties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->json('strain')->nullable(); // Array of strains: Indica, Sativa, Hybrid
            $table->text('description')->nullable();
            $table->string('thc_range')->nullable(); // e.g., "15-20%"
            $table->string('cbd_range')->nullable(); // e.g., "0.1-1%"
            $table->integer('flowering_time_days')->nullable();
            $table->string('yield_potential')->nullable(); // Low, Medium, High
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            
            // Indexes
            $table->index(['tenant_id', 'name']);
            $table->index(['tenant_id', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('varieties');
    }
};
