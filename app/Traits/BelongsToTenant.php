<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Scope;
use App\Models\Tenant;
use App\TenantContext;

class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $tenantId = TenantContext::getTenantId();
        if ($tenantId) {
            $builder->where($model->getTable() . '.tenant_id', $tenantId);
        }
    }
}

trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::creating(function (Model $model): void {
            if (! $model->tenant_id) {
                $model->tenant_id = TenantContext::getTenantId();
            }
        });

        static::addGlobalScope(new TenantScope());
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
