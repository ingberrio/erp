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
        Schema::table('traceability_events', function (Blueprint $table) {
            // Primero, asegúrate de que no haya datos que impidan el cambio si la columna ya tiene valores.
            // Si tienes registros existentes donde batch_id es 0 o un valor no válido,
            // considera actualizarlos a NULL antes de ejecutar esta migración si es necesario.
            // Por ejemplo: DB::table('traceability_events')->where('batch_id', 0)->update(['batch_id' => null]);
            
            $table->unsignedBigInteger('batch_id')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('traceability_events', function (Blueprint $table) {
            // Si necesitas revertir, considera qué hacer con los valores NULL.
            // Esto intentará cambiarla de nuevo a NOT NULL, lo que fallará si hay NULLs.
            // Podrías necesitar un valor por defecto o eliminar los NULLs primero.
            $table->unsignedBigInteger('batch_id')->nullable(false)->change();
        });
    }
};