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
            // Añadir la columna facility_id
            // unsignedBigInteger es para claves foráneas
            // nullable() si un lote puede existir sin una instalación asignada al inicio,
            // o si la instalación puede ser eliminada sin eliminar los lotes.
            // after('tenant_id') es opcional, solo para ordenar la columna.
            $table->unsignedBigInteger('facility_id')->nullable()->after('tenant_id');

            // Añadir la clave foránea
            // Esto asume que tienes una tabla 'facilities' con una columna 'id'.
            // onDelete('cascade') significa que si se elimina una instalación,
            // todos los lotes asociados a ella también se eliminarán.
            // Considera 'set null' si quieres que los lotes se queden sin facility_id
            // si la instalación es eliminada, o 'restrict' si no quieres permitir la eliminación
            // de una instalación si tiene lotes asociados. 'set null' requiere nullable().
            $table->foreign('facility_id')->references('id')->on('facilities')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            // Eliminar la clave foránea primero
            $table->dropForeign(['facility_id']);
            // Luego, eliminar la columna
            $table->dropColumn('facility_id');
        });
    }
};

