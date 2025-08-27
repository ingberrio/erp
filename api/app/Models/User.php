<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use App\Scopes\TenantScope;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    protected $fillable = [
        'name',
        'email',
        'password',
        'tenant_id',
        'is_global_admin',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'is_global_admin' => 'boolean',
    ];

    protected static function booted()
    {
        static::addGlobalScope(new TenantScope);
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function getTeamId(): ?int
    {
        return $this->tenant_id;
    }

    public function cards()
    {
        return $this->belongsToMany(Card::class, 'card_members', 'user_id', 'card_id');
    }

    public function boards()
    {
        return $this->belongsToMany(Board::class, 'board_members', 'user_id', 'board_id');
    }

    public function traceabilityEvents()
    {
        return $this->hasMany(TraceabilityEvent::class, 'user_id');
    }
}
