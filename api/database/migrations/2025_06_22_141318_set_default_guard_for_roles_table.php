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
        Schema::table('roles', function (Blueprint $table) {
            $table->string('guard_name')
                ->default('sanctum')
                ->change();
        });
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            // vuelve al guard por defecto de tu app (p.ej. 'web')
            $table->string('guard_name')
                ->default(config('auth.defaults.guard'))
                ->change();
        });
    }

};
