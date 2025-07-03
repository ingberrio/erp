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
        Schema::table('users', function (Blueprint $table) {
            // Cambiar la columna tenant_id para que sea nullable
            // Asegúrate de que el tipo de columna coincida con el original (ej. unsignedBigInteger)
            $table->unsignedBigInteger('tenant_id')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Revertir a not nullable (si es necesario para el rollback)
            // Esto podría fallar si ya hay valores NULL en la columna.
            // Considera si realmente necesitas el down() para esta operación.
            // Para una aplicación multitenant, tenant_id casi siempre debería ser nullable
            // para el super admin.
            $table->unsignedBigInteger('tenant_id')->nullable(false)->change();
        });
    }
};
