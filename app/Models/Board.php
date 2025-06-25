<?php
// app/Models/Board.php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToTenant; // Asegúrate de tener tu trait BelongsToTenant

class Board extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'name', 'description', 'tenant_id', 'user_id',
    ];

    /**
     * Un tablero pertenece a un usuario (el creador).
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Un tablero tiene muchas listas.
     */
    public function lists()
    {
        return $this->hasMany(LList::class); // Usamos LList para evitar conflicto con la palabra reservada 'List'
    }

    /**
     * Un tablero tiene muchas tarjetas a través de sus listas (relación HasManyThrough).
     */
    public function cards()
    {
        return $this->hasManyThrough(Card::class, LList::class);
    }
}
