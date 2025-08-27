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
        Schema::create('batches', function (Blueprint $table) {
            $table->id(); // O $table->uuid('id')->primary();
            $table->string('name');
            $table->date('advance_to_harvesting_on')->nullable();
            $table->integer('current_units');
            $table->string('end_type'); // Ej: 'Dried', 'Fresh'
            $table->string('variety');
            $table->decimal('projected_yield', 8, 2)->nullable(); // 8 dígitos en total, 2 decimales

            // Foreign keys
            $table->foreignId('cultivation_area_id')->constrained('cultivation_areas')->onDelete('restrict'); // No borrar área si tiene lotes
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('batches');
    }
};
