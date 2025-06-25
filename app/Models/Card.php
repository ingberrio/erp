<?php
// app/Models/Card.php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToTenant;

class Card extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'title', 'description', 'due_date', 'status', 'order', 'list_id', 'board_id', 'tenant_id', 'user_id',
    ];

    protected $casts = [
        'due_date' => 'date', // Cast para convertir automáticamente la fecha
    ];

    /**
     * Una tarjeta pertenece a una lista.
     */
    public function list()
    {
        return $this->belongsTo(LList::class); // Relaciona con el modelo LList
    }

    /**
     * Una tarjeta pertenece a un tablero.
     */
    public function board()
    {
        return $this->belongsTo(Board::class);
    }

    /**
     * Una tarjeta puede estar asignada a un usuario.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
