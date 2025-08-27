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
        Schema::create('inventory_discrepancies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->constrained('batches')->onDelete('cascade');
            $table->foreignId('physical_count_id')->constrained('physical_inventory_counts')->onDelete('cascade'); // El conteo físico que reveló la discrepancia
            $table->foreignId('facility_id')->constrained('facilities')->onDelete('cascade'); // La instalación donde ocurrió la discrepancia
            $table->foreignId('sub_location_id')->nullable()->constrained('sub_locations')->onDelete('set null'); // Si la discrepancia es a nivel de sub-ubicación

            $table->decimal('logical_quantity', 10, 2); // Cantidad que el sistema esperaba
            $table->decimal('physical_quantity', 10, 2); // Cantidad contada físicamente
            $table->decimal('discrepancy_amount', 10, 2); // physical_quantity - logical_quantity (puede ser negativa)
            $table->string('unit_of_measure', 50);

            $table->foreignId('reason_id')->nullable()->constrained('discrepancy_reasons')->onDelete('set null');
            $table->text('justification_notes')->nullable();
            
            $table->string('status', 50)->default('pending'); // Ej: 'pending', 'justified', 'adjusted', 'ignored'
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by_user_id')->nullable()->constrained('users')->onDelete('set null');

            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade'); // Para multi-tenancy

            $table->timestamps();

            // Índices para búsquedas eficientes
            $table->index(['batch_id', 'facility_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_discrepancies');
    }
};