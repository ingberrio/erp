<?php
// database/migrations/YYYY_MM_DD_HHMMSS_create_boards_table.php
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
        Schema::create('boards', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id'); // Clave foránea para el multi-tenant
            $table->unsignedBigInteger('user_id');   // Usuario que creó el tablero
            $table->string('name');                 // Nombre del tablero (ej. "Calendario de Proyectos")
            $table->text('description')->nullable(); // Descripción del tablero
            $table->timestamps();

            // Índices y claves foráneas
            $table->index('tenant_id');
            $table->index('user_id');
            // Si tienes una tabla 'tenants', puedes agregar la clave foránea aquí:
            // $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            // Si tienes una tabla 'users', puedes agregar la clave foránea aquí:
            // $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('boards');
    }
};
