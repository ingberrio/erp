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
        Schema::create('physical_inventory_counts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->constrained('batches')->onDelete('cascade');
            $table->foreignId('facility_id')->constrained('facilities')->onDelete('cascade');
            // sub_location_id: Si tu campo 'sub_location' en Batch es un ID y referencia una tabla 'sub_locations'
            $table->foreignId('sub_location_id')->nullable()->constrained('sub_locations')->onDelete('set null');
            // Si 'sub_location' en Batch es un string simple y no hay tabla de sub_locations,
            // considera usar un campo string aquí para el nombre de la sub-ubicación,
            // o crear una tabla de sub_locations para mejor normalización.
            // Por ahora, asumimos que 'sub_locations' existe o que se creará.

            $table->decimal('counted_quantity', 10, 2); // Ajusta la precisión según tus necesidades
            $table->string('unit_of_measure', 50); // Ej: 'grams', 'units', 'each'
            $table->timestamp('count_date'); // Fecha y hora en que se realizó el conteo físico
            $table->foreignId('counted_by_user_id')->constrained('users')->onDelete('restrict'); // Quién hizo el conteo
            $table->text('notes')->nullable(); // Notas opcionales sobre el conteo

            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade'); // Para multi-tenancy

            $table->timestamps(); // created_at y updated_at

            // Opcional: Índice para búsquedas rápidas por lote, instalación o fecha
            $table->index(['batch_id', 'facility_id', 'count_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('physical_inventory_counts');
    }
};