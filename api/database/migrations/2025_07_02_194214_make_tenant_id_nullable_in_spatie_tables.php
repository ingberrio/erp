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
        Schema::table('model_has_roles', function (Blueprint $table) {
            // Asegúrate de que la columna exista antes de intentar cambiarla
            if (Schema::hasColumn('model_has_roles', 'tenant_id')) {
                $table->unsignedBigInteger('tenant_id')->nullable()->change();
            }
        });

        Schema::table('model_has_permissions', function (Blueprint $table) {
            // Asegúrate de que la columna exista antes de intentar cambiarla
            if (Schema::hasColumn('model_has_permissions', 'tenant_id')) {
                $table->unsignedBigInteger('tenant_id')->nullable()->change();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('model_has_roles', function (Blueprint $table) {
            if (Schema::hasColumn('model_has_roles', 'tenant_id')) {
                // Si hay valores NULL, esto fallará. Considera una estrategia para limpiar/migrar datos.
                $table->unsignedBigInteger('tenant_id')->nullable(false)->change();
            }
        });

        Schema::table('model_has_permissions', function (Blueprint $table) {
            if (Schema::hasColumn('model_has_permissions', 'tenant_id')) {
                // Si hay valores NULL, esto fallará. Considera una estrategia para limpiar/migrar datos.
                $table->unsignedBigInteger('tenant_id')->nullable(false)->change();
            }
        });
    }
};
