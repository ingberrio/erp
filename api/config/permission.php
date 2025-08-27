<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Guard Name
    |--------------------------------------------------------------------------
    |
    | Aquí definimos el guard por defecto que usará Spatie para roles y permisos.
    |
    */
    'defaults' => [
        'guard' => 'sanctum',
    ],

    /*
    |--------------------------------------------------------------------------
    | Guards
    |--------------------------------------------------------------------------
    |
    | Lista de guards soportados. Añadimos 'sanctum' junto a 'web' y 'api'.
    |
    */
    'guards' => [
        'web',
        'api',
        'sanctum',
    ],

    /*
    |--------------------------------------------------------------------------
    | Models
    |--------------------------------------------------------------------------
    |
    | Tus modelos de Rol, Permiso y Usuario.
    |
    */
    'models' => [
        'permission' => App\Models\Permission::class,
        'role'       => App\Models\Role::class,
        'user'       => App\Models\User::class,
    ],

    /*
    |--------------------------------------------------------------------------
    | Table Names
    |--------------------------------------------------------------------------
    |
    | Nombres de las tablas usadas por el paquete.
    |
    */
    'table_names' => [
        'roles'                 => 'roles',
        'permissions'           => 'permissions',
        'model_has_permissions' => 'model_has_permissions',
        'model_has_roles'       => 'model_has_roles',
        'role_has_permissions'  => 'role_has_permissions',
    ],

    /*
    |--------------------------------------------------------------------------
    | Column Names
    |--------------------------------------------------------------------------
    |
    | Personalización de nombres de columnas y pivotes.
    |
    */
    'column_names' => [
        'role_pivot_key'       => null,         // usa role_id
        'permission_pivot_key' => null,         // usa permission_id
        'model_morph_key'      => 'model_id',
        'team_foreign_key'     => 'tenant_id',  // para el feature “teams”
    ],

    /*
    |--------------------------------------------------------------------------
    | Teams Feature
    |--------------------------------------------------------------------------
    |
    | Habilita el soporte multi-tenant usando `team_foreign_key`.
    |
    */
    'teams' => true,
    'columns' => [
        'team_foreign_key' => 'tenant_id', // Cambia a 'tenant_id' para multi-tenant
    ],

    'team_resolver' => \Spatie\Permission\DefaultTeamResolver::class,

    /*
    |--------------------------------------------------------------------------
    | Register Permission Check Method
    |--------------------------------------------------------------------------
    |
    | Si quieres registrar el método de chequeo de permisos en el Gate.
    |
    */
    'register_permission_check_method' => true,

    /*
    |--------------------------------------------------------------------------
    | Octane Reset Listener
    |--------------------------------------------------------------------------
    |
    | Si usas Laravel Octane, refresca permisos en cada operación.
    |
    */
    'register_octane_reset_listener' => false,

    /*
    |--------------------------------------------------------------------------
    | Events
    |--------------------------------------------------------------------------
    |
    | Habilita eventos al adjuntar/desadjuntar roles o permisos.
    |
    */
    'events_enabled' => false,

    /*
    |--------------------------------------------------------------------------
    | Passport Client Credentials
    |--------------------------------------------------------------------------
    |
    | Para usar Passport Client en lugar de checks normales.
    |
    */
    'use_passport_client_credentials' => false,

    /*
    |--------------------------------------------------------------------------
    | Display Names in Exceptions
    |--------------------------------------------------------------------------
    |
    | Si quieres que las excepciones incluyan nombres de roles/permisos.
    |
    */
    'display_permission_in_exception' => false,
    'display_role_in_exception'       => false,

    /*
    |--------------------------------------------------------------------------
    | Wildcard Permissions
    |--------------------------------------------------------------------------
    |
    | Soporte para permisos con comodines.
    |
    */
    'enable_wildcard_permission' => false,
    // 'wildcard_permission' => Spatie\Permission\WildcardPermission::class,

    /*
    |--------------------------------------------------------------------------
    | Cache Settings
    |--------------------------------------------------------------------------
    |
    | Configuración de caché para acelerar la resolución de permisos.
    |
    */
    'cache' => [
        'expiration_time' => \DateInterval::createFromDateString('24 hours'),
        'key'             => 'spatie.permission.cache',
        'store'           => 'file',
    ],
];
