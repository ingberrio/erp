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
        Schema::create('cultivation_areas', function (Blueprint $table) {
            $table->id(); // O $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->integer('capacity_units')->nullable();
            $table->string('capacity_unit_type')->nullable(); // Ej: 'plantas', 'm2'
            $table->integer('order')->default(0);
            // Foreign keys
            $table->foreignId('facility_id')->nullable()->constrained('facilities')->onDelete('set null');
            $table->foreignId('current_stage_id')->constrained('stages')->onDelete('restrict'); // No borrar etapa si hay áreas
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cultivation_areas');
    }
};
