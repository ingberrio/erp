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
        Schema::create('discrepancy_reasons', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique(); // Ej: "Error de Entrada", "Pérdida por Consumo", "Robo", "Muestra de Calidad"
            $table->text('description')->nullable();
            $table->boolean('requires_adjustment')->default(false); // Indica si esta razón típicamente requiere un ajuste de inventario
            
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade'); // Para multi-tenancy

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('discrepancy_reasons');
    }
};