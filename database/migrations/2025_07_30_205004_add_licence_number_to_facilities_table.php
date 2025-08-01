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
        Schema::table('facilities', function (Blueprint $table) {
            // Añade la columna 'licence_number' después de 'name'
            // Es nullable porque las instalaciones existentes podrían no tenerlo inicialmente
            $table->string('licence_number')->nullable()->after('name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            // Elimina la columna 'licence_number' si se revierte la migración
            $table->dropColumn('licence_number');
        });
    }
};
