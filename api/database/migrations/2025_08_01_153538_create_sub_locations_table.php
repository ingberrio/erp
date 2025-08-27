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
        Schema::create('sub_locations', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique(); // Ej: "Estante A1", "Armario 3", "Caja Fría"
            $table->text('description')->nullable();
            
            // Si las sub-ubicaciones pertenecen a una instalación, añade una FK a facilities
            $table->foreignId('facility_id')->constrained('facilities')->onDelete('cascade');
            
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade'); // Para multi-tenancy

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sub_locations');
    }
};