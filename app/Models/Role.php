<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Traits\BelongsToTenant;
use Spatie\Permission\Models\Role as SpatieRole;

class Role extends SpatieRole
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'name', 'guard_name', 'tenant_id', 'description',
    ];

    // Esto es crucial y debe permanecer para asegurar 'sanctum' por defecto
    protected $attributes = [
        'guard_name' => 'sanctum',
    ];

    protected static function booted()
    {
        static::retrieved(function ($model) {
            if (empty($model->guard_name)) {
                $model->guard_name = 'sanctum';
            }
        });
        // Si tu TenantScope se aplica aquí y no en el trait, déjalo.
        // static::addGlobalScope(new \App\Scopes\TenantScope);
    }
}
