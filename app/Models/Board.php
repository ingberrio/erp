<?php
// app/Models/Board.php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToTenant;

class Board extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'name', 'description', 'tenant_id', 'user_id',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function lists()
    {
        return $this->hasMany(LList::class);
    }

    public function cards()
    {
        return $this->hasManyThrough(Card::class, LList::class);
    }

    public function members()
    {
        return $this->belongsToMany(User::class, 'board_members', 'board_id', 'user_id');
    }
}
