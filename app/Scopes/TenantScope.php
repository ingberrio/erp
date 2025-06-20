<?php
namespace App\Scopes;

use App\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Log;

class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $tenantId = TenantContext::getTenantId() ?? request()->header('X-Tenant-ID');
        if ($tenantId !== null) {
            $builder->where($model->getTable() . '.tenant_id', $tenantId);
            Log::info('TenantScope: Applied scope for model ' . get_class($model) . ' with tenant_id: ' . $tenantId);
        } else {
            Log::warning('TenantScope: NOT applying scope for model ' . get_class($model) . ' - Tenant ID is null.');
        }
    }
}