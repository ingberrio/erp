<?php
// app/Models/Card.php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToTenant;
use App\Models\User; // <-- ¡IMPORTANTE: Asegúrate de importar el modelo User!

class Card extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'title',
        'description',
        'due_date',
        'status',
        'order',
        'list_id',
        'board_id',
        'tenant_id',
        'user_id',
        'checklist', 
    ];

    protected $casts = [
        'due_date' => 'date',
        'checklist' => 'array',
    ];

    /**
     * Una tarjeta pertenece a una lista.
     */
    public function list()
    {
        return $this->belongsTo(LList::class);
    }

    /**
     * Una tarjeta pertenece a un tablero.
     */
    public function board()
    {
        return $this->belongsTo(Board::class);
    }

    /**
     * Una tarjeta puede estar asignada a un usuario (creador/propietario).
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Una tarjeta puede tener muchos miembros asignados.
     * Esta es la relación muchos a muchos.
     */
    public function members()
    {
        // Asumiendo que la tabla pivote es 'card_members'
        // y que las claves foráneas son 'card_id' y 'user_id'
        return $this->belongsToMany(User::class, 'card_members', 'card_id', 'user_id');
    }
}
