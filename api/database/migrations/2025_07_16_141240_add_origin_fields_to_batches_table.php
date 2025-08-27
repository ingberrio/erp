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
        Schema::table('batches', function (Blueprint $table) {
            // Tipo de origen del lote (semillas, clones, tejido, compra externa)
            $table->string('origin_type')->nullable()->after('variety');
            // Detalles adicionales del origen (ej. ID de planta madre, proveedor de semillas, etc.)
            // Usamos text para flexibilidad, podrías usar JSON si siempre será estructurado.
            $table->text('origin_details')->nullable()->after('origin_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->dropColumn('origin_details');
            $table->dropColumn('origin_type');
        });
    }
};
