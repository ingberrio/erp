<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToTenant; // Asegúrate de tener tu trait BelongsToTenant

class LList extends Model
{
    use HasFactory, BelongsToTenant;

    protected $table = 'lists'; // Asegúrate de que el nombre de la tabla sea 'lists'

    protected $fillable = [
        'name', 'order', 'board_id', 'tenant_id',
    ];

    /**
     * Una lista pertenece a un tablero.
     */
    public function board()
    {
        return $this->belongsTo(Board::class);
    }

    /**
     * Una lista tiene muchas tarjetas.
     * ESPECIFICAMOS LA CLAVE FORÁNEA EXPLÍCITAMENTE COMO 'list_id'.
     */
    public function cards()
    {
        return $this->hasMany(Card::class, 'list_id'); // ¡¡¡CORREGIDO: Ahora usa 'list_id' explícitamente!!!
    }
}
