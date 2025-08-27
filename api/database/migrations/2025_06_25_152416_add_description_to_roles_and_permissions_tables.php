<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        // Añadir campo 'description' a la tabla 'roles'
        Schema::table('roles', function (Blueprint $table) {
            // Asegúrate de que la columna se añada después de 'name' o al final si prefieres
            $table->string('description')->nullable()->after('name');
        });

        // Añadir campo 'description' a la tabla 'permissions'
        Schema::table('permissions', function (Blueprint $table) {
            // Asegúrate de que la columna se añada después de 'name' o al final si prefieres
            $table->string('description')->nullable()->after('name');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        // Revertir la adición del campo 'description' de la tabla 'roles'
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn('description');
        });

        // Revertir la adición del campo 'description' de la tabla 'permissions'
        Schema::table('permissions', function (Blueprint $table) {
            $table->dropColumn('description');
        });
    }
};

