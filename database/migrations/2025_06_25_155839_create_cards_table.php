<?php
// database/migrations/YYYY_MM_DD_HHMMSS_create_cards_table.php
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
        Schema::create('cards', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('list_id');     // Clave foránea a la lista a la que pertenece
            $table->unsignedBigInteger('board_id');    // Clave foránea al tablero (redundante pero útil para consultas directas)
            $table->unsignedBigInteger('tenant_id');   // Clave foránea para el multi-tenant
            $table->unsignedBigInteger('user_id')->nullable(); // Usuario asignado o creador de la tarjeta
            $table->string('title');                   // Título de la tarjeta (tarea)
            $table->text('description')->nullable();   // Descripción detallada
            $table->date('due_date')->nullable();      // Fecha de vencimiento
            $table->string('status')->default('todo'); // Estado de la tarea (ej. 'todo', 'in_progress', 'done')
            $table->integer('order')->default(0);      // Orden de las tarjetas dentro de una lista
            $table->timestamps();

            // Índices y claves foráneas
            $table->index('tenant_id');
            $table->index('user_id');
            $table->foreign('list_id')->references('id')->on('lists')->onDelete('cascade');
            $table->foreign('board_id')->references('id')->on('boards')->onDelete('cascade');
            // Si tienes una tabla 'users', puedes agregar la clave foránea aquí:
            // $table->foreign('user_id')->references('id')->on('users')->onDelete('set null'); // O 'cascade' si la eliminación de usuario implica eliminar sus tarjetas
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('cards');
        Schema::dropIfExists('lists');
        Schema::dropIfExists('boards'); // Drop tables in reverse order of creation
    }
};