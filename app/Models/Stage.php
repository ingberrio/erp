<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\HasTenant; // Importa el Trait

class Stage extends Model
{
    use HasFactory, HasTenant; // <-- ¡Añade HasTenant aquí!

    protected $fillable = [
        'name',
        'order',
        'tenant_id', // <-- ¡Asegúrate de que 'tenant_id' sea fillable!
    ];

    // Si ya tienes el Trait, no necesitas el método 'booted()' aquí.
    // El 'bootHasTenant()' del Trait ya se encargará de todo.
}
