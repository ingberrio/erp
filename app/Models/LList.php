<?php
// app/Models/LList.php (Renombrado de List para evitar conflicto con palabra reservada)
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToTenant; // Asegúrate de tener tu trait BelongsToTenant

class LList extends Model // Renombrado de 'List' a 'LList' para evitar conflictos
{
    use HasFactory, BelongsToTenant;

    protected $table = 'lists'; // Especificamos el nombre real de la tabla

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
     */
    public function cards()
    {
        // Ordena las tarjetas por el campo 'order' por defecto
        return $this->hasMany(Card::class)->orderBy('order');
    }
}
