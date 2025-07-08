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
        Schema::table('cards', function (Blueprint $table) {
            // Añade el nuevo campo 'checklist' como JSON o TEXT
            // JSON es preferible para bases de datos que lo soporten (ej. MySQL 5.7+, PostgreSQL)
            // Si usas una versión antigua de MySQL o SQLite, usa 'text'
            $table->json('checklist')->nullable()->after('status'); 
            // O si tu base de datos no soporta JSON directamente:
            // $table->text('checklist')->nullable()->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cards', function (Blueprint $table) {
            // Elimina el campo 'checklist' si se revierte la migración
            $table->dropColumn('checklist');
        });
    }
};