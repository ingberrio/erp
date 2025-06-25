<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Traits\BelongsToTenant;
use Spatie\Permission\Models\Permission as SpatiePermission;

class Permission extends SpatiePermission
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'name', 'guard_name', 'tenant_id', 'description',
    ];

    // Esto es crucial y debe permanecer
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
    }
}