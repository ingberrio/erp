<?php

namespace App\Traits;

use App\TenantContext;
use App\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

trait BelongsToTenant
{
    protected static function bootBelongsToTenant(): void
    {
        // This line adds the global scope to any model using this trait.
        // The scope itself now contains the logic to check TenantContext.
        if (!in_array(static::class, config('tenancy.exempt_models', []))) {
             static::addGlobalScope(new TenantScope);
        }

        // This part ensures tenant_id is set when CREATING models,
        // which should now work correctly after TenantContext is set by AuthController/IdentifyTenant.
        static::creating(function (Model $model) {
            if (empty($model->tenant_id) && TenantContext::getTenantId()) {
                $model->tenant_id = TenantContext::getTenantId();
                \Illuminate\Support\Facades\Log::info('BelongsToTenant: creating - Tenant ID auto-set:', ['model' => get_class($model), 'tenant_id' => $model->tenant_id]);
            } else if (empty($model->tenant_id) && !TenantContext::getTenantId()) {
                \Illuminate\Support\Facades\Log::warning('BelongsToTenant: creating - No Tenant ID in context for new model.', ['model' => get_class($model)]);
            }
        });
    }
}