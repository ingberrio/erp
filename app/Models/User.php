<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use App\Scopes\TenantScope; // Importa el scope
use Spatie\Permission\Traits\HasRoles; // Importa el trait de Spatie

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'tenant_id', // Asegúrate de que tenant_id esté fillable
        'is_global_admin',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'is_global_admin' => 'boolean',
    ];

    // Aplicar el TenantScope globalmente
    protected static function booted()
    {
        static::addGlobalScope(new TenantScope);
    }

    // Definir la relación con el tenant (opcional, pero buena práctica)
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    // Sobrescribir el método teamsId para Spatie si usas equipos
    // Esto es crucial para que Spatie sepa qué tenant_id usar para roles/permisos
    public function getTeamId(): ?int
    {
        return $this->tenant_id;
    }

    // Si tu modelo User tiene un método para cargar permisos directamente, asegúrate de que sea compatible
    // con la estructura de Spatie.
    // public function permissions()
    // {
    //     // Esto es manejado por HasRoles y HasPermissions de Spatie
    // }
}
