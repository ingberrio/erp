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
        // Añadir columna 'sub_location' a la tabla 'batches'
        Schema::table('batches', function (Blueprint $table) {
            $table->string('sub_location', 255)->nullable()->after('cultivation_area_id');
        });

        // Añadir columnas 'from_sub_location' y 'to_sub_location' a la tabla 'traceability_events'
        Schema::table('traceability_events', function (Blueprint $table) {
            $table->string('from_sub_location', 255)->nullable()->after('from_location');
            $table->string('to_sub_location', 255)->nullable()->after('to_location');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revertir los cambios en el orden inverso
        Schema::table('traceability_events', function (Blueprint $table) {
            $table->dropColumn('to_sub_location');
            $table->dropColumn('from_sub_location');
        });

        Schema::table('batches', function (Blueprint $table) {
            $table->dropColumn('sub_location');
        });
    }
};
